/**
 * Agent 角色库服务
 *
 * 管理 ~/.tagent/agent-roles.json 的读写，提供角色 CRUD。
 *
 * 与 SOUL.md 的关系：
 * - SOUL.md 是全局身份层（主会话），模式级，单文件
 * - 角色库是任务职责层（worker），任务级，多角色并存
 * - 两者正交，worker 子会话 system prompt = SOUL.md + 角色 prompt
 *
 * 初始化策略：
 * - 首次运行（文件不存在）→ 写入 DEFAULT_ROLES（编程向 4 + 非编程向 4）
 * - 文件存在但缺少内置角色 → 补齐缺失的内置角色（保留用户自定义）
 * - 文件存在且完整 → 直接用
 *
 * 参考 SOUL.md 的 loadSoulMd 模式（agent-prompt-builder.ts）。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname } from 'node:path'

import { DEFAULT_ROLES, type AgentRoleProfile, type ImportRoleFromMdResult } from '@tagent/shared'

import { getAgentRolesPath } from './config-paths'

/** 内置角色 ID 集合（用于区分内置 vs 自定义，内置不可删除） */
const BUILTIN_ROLE_IDS = new Set(DEFAULT_ROLES.map((r) => r.id))

/**
 * 加载所有角色（内置 + 自定义）
 *
 * 初始化逻辑：
 * 1. 文件不存在 → 写入 DEFAULT_ROLES 并返回
 * 2. 文件存在 → 解析 JSON，补齐缺失的内置角色（用户可能删过又想恢复）
 * 3. 解析失败 → 回退到 DEFAULT_ROLES（不覆盖文件，避免丢用户数据）
 *
 * @returns 角色列表（内置在前，自定义在后）
 */
export function loadRoles(): AgentRoleProfile[] {
  const path = getAgentRolesPath()

  if (!existsSync(path)) {
    // 首次运行：初始化默认角色
    saveRoles(DEFAULT_ROLES)
    console.log(`[角色库] 已初始化默认角色: ${path}`)
    return [...DEFAULT_ROLES]
  }

  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as AgentRoleProfile[]

    if (!Array.isArray(parsed)) {
      console.warn('[角色库] agent-roles.json 内容不是数组，回退到默认角色')
      return [...DEFAULT_ROLES]
    }

    // 补齐缺失的内置角色（用户可能删过，或版本升级新增了内置角色）
    const existingIds = new Set(parsed.map((r) => r.id))
    const missingBuiltins = DEFAULT_ROLES.filter((r) => !existingIds.has(r.id))

    // 检测内置角色是否需要更新（版本升级时 systemPrompt 可能变化）
    let needsUpdate = false
    const updated = parsed.map((r) => {
      const builtin = DEFAULT_ROLES.find((d) => d.id === r.id)
      if (builtin && builtin.systemPrompt !== r.systemPrompt) {
        // 内置角色的 systemPrompt 已更新，同步覆盖
        needsUpdate = true
        console.log(`[角色库] 内置角色已更新: ${r.id} (${r.displayName} → ${builtin.displayName})`)
        return { ...builtin }
      }
      return r
    })

    // 追加缺失的内置角色
    if (missingBuiltins.length > 0) {
      updated.push(...missingBuiltins)
      console.log(
        `[角色库] 补齐 ${missingBuiltins.length} 个内置角色: ${missingBuiltins.map((r) => r.id).join(', ')}`
      )
      needsUpdate = true
    }

    if (needsUpdate) {
      saveRoles(updated)
      return updated
    }

    return parsed
  } catch (err) {
    console.warn('[角色库] 读取 agent-roles.json 失败，回退到默认角色:', err)
    return [...DEFAULT_ROLES]
  }
}

/** 保存角色列表到文件 */
export function saveRoles(roles: AgentRoleProfile[]): void {
  const path = getAgentRolesPath()
  try {
    writeFileSync(path, JSON.stringify(roles, null, 2), 'utf-8')
  } catch (err) {
    console.error('[角色库] 保存 agent-roles.json 失败:', err)
    throw err
  }
}

/** 获取单个角色 by id，不存在返回 undefined */
export function getRoleById(id: string): AgentRoleProfile | undefined {
  return loadRoles().find((r) => r.id === id)
}

/** 保存单个角色（新增或覆盖） */
export function saveRole(role: AgentRoleProfile): AgentRoleProfile[] {
  const roles = loadRoles()
  const idx = roles.findIndex((r) => r.id === role.id)
  if (idx >= 0) {
    roles[idx] = role
  } else {
    roles.push(role)
  }
  saveRoles(roles)
  console.log(`[角色库] 已保存角色: ${role.id} (${role.displayName})`)
  return roles
}

/** 删除角色（内置角色不可删，返回 false） */
export function deleteRole(roleId: string): {
  roles: AgentRoleProfile[]
  deleted: boolean
  reason?: string
} {
  if (BUILTIN_ROLE_IDS.has(roleId)) {
    return {
      roles: loadRoles(),
      deleted: false,
      reason: '内置角色不可删除，可编辑覆盖或重置全部',
    }
  }
  const roles = loadRoles()
  const idx = roles.findIndex((r) => r.id === roleId)
  if (idx < 0) {
    return { roles, deleted: false, reason: '角色不存在' }
  }
  roles.splice(idx, 1)
  saveRoles(roles)
  console.log(`[角色库] 已删除角色: ${roleId}`)
  return { roles, deleted: true }
}

/** 重置为默认角色（清空自定义，恢复 4 个内置） */
export function resetDefaultRoles(): AgentRoleProfile[] {
  saveRoles(DEFAULT_ROLES)
  console.log('[角色库] 已重置为默认角色')
  return [...DEFAULT_ROLES]
}

/** 判断角色是否为内置 */
export function isBuiltinRole(roleId: string): boolean {
  return BUILTIN_ROLE_IDS.has(roleId)
}

/**
 * 查找与给定 displayName 相似的角色
 *
 * 使用简单的字符串相似度检测：
 * - 完全匹配
 * - 包含关系（如 "前端开发" 和 "前端开发工程师"）
 * - 编辑距离 <= 2（如 "前端开发者" 和 "前端开发专家"）
 */
export function findSimilarRoles(displayName: string): AgentRoleProfile[] {
  const roles = loadRoles()
  const normalizedName = displayName.toLowerCase().trim()

  return roles.filter((r) => {
    const existing = r.displayName.toLowerCase().trim()
    // 完全匹配
    if (existing === normalizedName) return true
    // 包含关系
    if (existing.includes(normalizedName) || normalizedName.includes(existing)) return true
    // 编辑距离检测（短文本且长度相近时）
    if (
      Math.abs(existing.length - normalizedName.length) <= 2 &&
      levenshteinDistance(existing, normalizedName) <= 2
    ) {
      return true
    }
    return false
  })
}

/** 批量删除角色（内置角色自动跳过） */
export function deleteRoles(roleIds: string[]): {
  roles: AgentRoleProfile[]
  deleted: string[]
  skipped: Array<{ id: string; reason: string }>
} {
  const roles = loadRoles()
  const deleted: string[] = []
  const skipped: Array<{ id: string; reason: string }> = []

  for (const roleId of roleIds) {
    if (BUILTIN_ROLE_IDS.has(roleId)) {
      skipped.push({ id: roleId, reason: '内置角色不可删除' })
      continue
    }
    const idx = roles.findIndex((r) => r.id === roleId)
    if (idx < 0) {
      skipped.push({ id: roleId, reason: '角色不存在' })
      continue
    }
    roles.splice(idx, 1)
    deleted.push(roleId)
  }

  if (deleted.length > 0) {
    saveRoles(roles)
    console.log(`[角色库] 批量删除 ${deleted.length} 个角色: ${deleted.join(', ')}`)
  }

  return { roles, deleted, skipped }
}

/** 计算两个字符串的编辑距离（Levenshtein Distance） */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1, // 删除
        dp[i]![j - 1]! + 1, // 插入
        dp[i - 1]![j - 1]! + cost // 替换
      )
    }
  }

  return dp[m]![n]!
}

// ─── .md 导入 ────────────────────────────────────────────────

/**
 * 从 .md 文件导入角色
 *
 * 解析 YAML frontmatter（name/description/emoji/color）+ markdown body 为 AgentRoleProfile。
 * 支持的 frontmatter 字段：
 * - name → displayName
 * - description → description
 * - 其余忽略（emoji/color 等 UI 属性在 TAgent 中不使用）
 *
 * body（去除 frontmatter 后的 markdown 全文）→ systemPrompt
 */
export function importRoleFromMd(filePath: string): ImportRoleFromMdResult {
  if (!existsSync(filePath)) {
    return { role: null, imported: false, reason: '文件不存在' }
  }

  const ext = extname(filePath).toLowerCase()
  if (ext !== '.md') {
    return { role: null, imported: false, reason: '仅支持 .md 文件' }
  }

  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    return { role: null, imported: false, reason: '读取文件失败' }
  }

  const { meta, body } = parseMdFrontmatter(content)

  if (!body) {
    return { role: null, imported: false, reason: '文件内容为空' }
  }

  // 生成 id：优先用 frontmatter name 转 kebab-case，兜底用文件名
  const displayName = meta.name || basename(filePath, '.md')
  const id = toKebabCase(displayName)

  const role: AgentRoleProfile = {
    id,
    displayName,
    description: meta.description || `${displayName}专业角色`,
    systemPrompt: body,
    permissionMode: 'bypassPermissions',
    modelPool: [],
    maxConcurrentPerModel: 2,
    fallbackToChannelDefault: true,
  }

  // 检查是否已存在
  const existing = loadRoles()
  if (existing.some((r) => r.id === id)) {
    return { role: null, imported: false, reason: `角色 "${displayName}" 已存在（id: ${id}）` }
  }

  saveRole(role)
  console.log(`[角色库] 从 .md 导入角色: ${displayName} (${id})`)
  return { role, imported: true }
}

/** 解析 YAML frontmatter */
function parseMdFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { meta: {}, body: content.trim() }
  }

  const yamlStr = match[1]!
  const body = match[2]!.trim()
  const meta: Record<string, string> = {}

  for (const line of yamlStr.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) {
      meta[kv[1]!] = kv[2]!.trim()
    }
  }

  return { meta, body }
}

/** 中文/英文名转 kebab-case id */
function toKebabCase(str: string): string {
  return (
    str
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9一-鿿-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'imported-role'
  )
}
