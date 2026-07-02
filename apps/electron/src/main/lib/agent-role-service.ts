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
 * - 首次运行（文件不存在）→ 写入 DEFAULT_ROLES（4 个内置角色）
 * - 文件存在但缺少内置角色 → 补齐缺失的内置角色（保留用户自定义）
 * - 文件存在且完整 → 直接用
 *
 * 参考 SOUL.md 的 loadSoulMd 模式（agent-prompt-builder.ts）。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { DEFAULT_ROLES, type AgentRoleProfile } from '@tagent/shared'

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
    if (missingBuiltins.length > 0) {
      const merged = [...parsed, ...missingBuiltins]
      saveRoles(merged)
      console.log(
        `[角色库] 补齐 ${missingBuiltins.length} 个内置角色: ${missingBuiltins.map((r) => r.id).join(', ')}`
      )
      return merged
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
