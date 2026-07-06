/**
 * 角色商店服务
 *
 * 提供角色商店 catalog 的加载（远程优先 + 本地缓存 + 内置兜底）和安装能力。
 *
 * 数据流：
 * 1. 启动时从 GitHub Raw 拉取最新 catalog → 写入本地缓存
 * 2. 拉取失败 → 读本地缓存
 * 3. 缓存不存在 → 回退内置 catalog（硬编码在代码中）
 *
 * 安装：从 catalog 中提取 AgentRoleProfile → 调用 saveRole 写入 agent-roles.json
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import type {
  AgentRoleProfile,
  InstallStoreRoleResult,
  RoleStoreCatalog,
  RoleStoreCatalogResult,
} from '@tagent/shared'
import { getBuiltinRoleStoreCatalog } from '@tagent/shared'

import { getRoleStoreCatalogPath } from './config-paths'
import { loadRoles, saveRole } from './agent-role-service'

/** GitHub Raw URL（远程 catalog 源） */
const REMOTE_CATALOG_URL =
  'https://raw.githubusercontent.com/Frank-LiangMX/TAgent_General/main/packages/shared/src/role-store-catalog.json'

/** 远程拉取超时（毫秒） */
const FETCH_TIMEOUT_MS = 5000

/** 内存缓存（避免每次 IPC 都读文件） */
let cachedCatalog: RoleStoreCatalog | null = null

/** 加载角色商店 catalog（远程优先，失败降级本地） */
export async function loadRoleStoreCatalog(): Promise<RoleStoreCatalogResult> {
  // 尝试远程拉取
  try {
    const catalog = await fetchRemoteCatalog()
    cachedCatalog = catalog
    // 写入本地缓存
    writeLocalCache(catalog)
    return { catalog, source: 'remote', stale: false }
  } catch (err) {
    console.warn('[角色商店] 远程拉取失败，降级本地:', err)
  }

  // 降级：读本地缓存
  const cached = readLocalCache()
  if (cached) {
    cachedCatalog = cached
    return { catalog: cached, source: 'cached', stale: true }
  }

  // 最终兜底：内置 catalog
  const builtin = getBuiltinRoleStoreCatalog()
  cachedCatalog = builtin
  return { catalog: builtin, source: 'builtin', stale: false }
}

/** 从 catalog 中安装单个角色到本地角色库 */
export function installStoreRole(roleId: string): InstallStoreRoleResult {
  const catalog = cachedCatalog || getBuiltinRoleStoreCatalog()
  const entry = catalog.entries.find((e) => e.id === roleId)

  if (!entry) {
    return { role: null, installed: false, reason: '角色不存在于商店 catalog' }
  }

  // 检查是否已存在
  const existing = loadRoles()
  if (existing.some((r) => r.id === roleId)) {
    return { role: null, installed: false, reason: '角色已存在' }
  }

  // 安装：写入 agent-roles.json
  saveRole(entry.role)
  console.log(`[角色商店] 已安装角色: ${entry.displayName} (${roleId})`)
  return { role: entry.role, installed: true }
}

/** 从远程 GitHub Raw 拉取 catalog */
async function fetchRemoteCatalog(): Promise<RoleStoreCatalog> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const resp = await fetch(REMOTE_CATALOG_URL, { signal: controller.signal })
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    }
    const data = (await resp.json()) as RoleStoreCatalog
    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error('Invalid catalog format: missing entries array')
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

/** 读本地缓存 */
function readLocalCache(): RoleStoreCatalog | null {
  const path = getRoleStoreCatalogPath()
  if (!existsSync(path)) return null

  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as RoleStoreCatalog
    if (!parsed.entries || !Array.isArray(parsed.entries)) return null
    return parsed
  } catch {
    return null
  }
}

/** 写入本地缓存 */
function writeLocalCache(catalog: RoleStoreCatalog): void {
  try {
    const path = getRoleStoreCatalogPath()
    writeFileSync(path, JSON.stringify(catalog, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[角色商店] 写入本地缓存失败:', err)
  }
}
