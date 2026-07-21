/**
 * Skill Curator — 静态状态机治理（方案 D）
 *
 * 复用 ScheduledCleanup 周日 04:00 / 启动补跑：
 * - draft + useCount ≥ 5 → active
 * - active + 30 天未用 → stale
 * - stale + 90 天未用 → archived
 * - 仅 background 来源；pinned 跳过
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { SkillLifecycleStatus, SkillProvenance } from '@tagent/shared'

import { getGlobalSkillsDir, getWorkspaceSkillsDir } from './config-paths'
import { listAgentWorkspaces } from './agent-workspace-manager'
import { archiveSkill, patchSkill } from './skill-manage-core'
import { readSkillUsage, type SkillUsageMap } from './skill-usage-tracker'

const MS_DAY = 24 * 60 * 60 * 1000
const DRAFT_TO_ACTIVE_USES = 5
const ACTIVE_TO_STALE_MS = 30 * MS_DAY
const STALE_TO_ARCHIVE_MS = 90 * MS_DAY

export interface CuratorTransition {
  slug: string
  scope: 'global' | 'workspace'
  workspaceSlug?: string
  from: SkillLifecycleStatus
  to: SkillLifecycleStatus
  reason: string
}

export interface CuratorRunResult {
  scanned: number
  transitions: CuratorTransition[]
  errors: string[]
}

interface SkillFrontmatterLite {
  provenance: SkillProvenance
  status: SkillLifecycleStatus
  pinned: boolean
}

function parseLiteFrontmatter(content: string): SkillFrontmatterLite {
  const meta: SkillFrontmatterLite = {
    provenance: 'foreground',
    status: 'active',
    pinned: false,
  }
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!fm?.[1]) return meta
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1]!
    const raw = m[2]!.trim().replace(/^["']|["']$/g, '')
    if (key === 'provenance' && (raw === 'foreground' || raw === 'background')) {
      meta.provenance = raw
    } else if (key === 'created_by' && raw === 'agent') {
      // agent 创建默认视为 background
      if (meta.provenance === 'foreground') meta.provenance = 'background'
    } else if (
      key === 'status' &&
      (raw === 'draft' || raw === 'active' || raw === 'stale' || raw === 'archived')
    ) {
      meta.status = raw
    } else if (key === 'pinned') {
      meta.pinned = raw === 'true' || raw === 'yes' || raw === '1'
    }
  }
  return meta
}

function listSkillDirs(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
}

function decideNext(
  status: SkillLifecycleStatus,
  useCount: number,
  lastUsedAt: number,
  now: number
): { next: SkillLifecycleStatus; reason: string } | null {
  if (status === 'archived') return null

  if (status === 'draft' && useCount >= DRAFT_TO_ACTIVE_USES) {
    return { next: 'active', reason: `draft 使用 ${useCount} 次 ≥ ${DRAFT_TO_ACTIVE_USES}` }
  }

  // 无埋点 lastUsedAt 时不做闲置降级，避免新 skill 被立刻 stale
  if (lastUsedAt <= 0) return null
  if (status === 'draft') return null

  const idleMs = now - lastUsedAt

  if (status === 'active' && idleMs >= ACTIVE_TO_STALE_MS) {
    return {
      next: 'stale',
      reason: `active 已闲置 ${Math.floor(idleMs / MS_DAY)} 天 ≥ 30`,
    }
  }

  if (status === 'stale' && idleMs >= STALE_TO_ARCHIVE_MS) {
    return {
      next: 'archived',
      reason: `stale 已闲置 ${Math.floor(idleMs / MS_DAY)} 天 ≥ 90`,
    }
  }

  return null
}

function curateScope(
  scope: 'global' | 'workspace',
  workspaceSlug: string | undefined,
  usage: SkillUsageMap,
  now: number,
  result: CuratorRunResult
): void {
  const root = scope === 'global' ? getGlobalSkillsDir() : getWorkspaceSkillsDir(workspaceSlug!)
  for (const slug of listSkillDirs(root)) {
    result.scanned++
    const skillMd = join(root, slug, 'SKILL.md')
    if (!existsSync(skillMd)) continue
    let content: string
    try {
      content = readFileSync(skillMd, 'utf-8')
    } catch (err) {
      result.errors.push(`${slug}: 读取失败 ${String(err)}`)
      continue
    }
    const lite = parseLiteFrontmatter(content)
    if (lite.provenance !== 'background') continue
    if (lite.pinned) continue

    const entry = usage[slug] ?? { useCount: 0, lastUsedAt: 0 }
    const decision = decideNext(lite.status, entry.useCount, entry.lastUsedAt, now)
    if (!decision) continue

    try {
      if (decision.next === 'archived') {
        archiveSkill(slug, scope, workspaceSlug)
      } else {
        patchSkill({
          slug,
          scope,
          workspaceSlug,
          status: decision.next,
        })
      }
      result.transitions.push({
        slug,
        scope,
        workspaceSlug,
        from: lite.status,
        to: decision.next,
        reason: decision.reason,
      })
    } catch (err) {
      result.errors.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

/**
 * 跑一轮 Curator（全局 + 全部工作区）
 */
export function runSkillCurator(now: number = Date.now()): CuratorRunResult {
  const result: CuratorRunResult = { scanned: 0, transitions: [], errors: [] }

  try {
    const globalUsage = readSkillUsage('global')
    curateScope('global', undefined, globalUsage, now, result)
  } catch (err) {
    result.errors.push(`global: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    const workspaces = listAgentWorkspaces()
    for (const ws of workspaces) {
      const usage = readSkillUsage('workspace', ws.slug)
      curateScope('workspace', ws.slug, usage, now, result)
    }
  } catch (err) {
    result.errors.push(`workspaces: ${err instanceof Error ? err.message : String(err)}`)
  }

  console.log(
    `[SkillCurator] 扫描 ${result.scanned} 个 skill，转换 ${result.transitions.length}，错误 ${result.errors.length}`
  )
  return result
}

/** 导出供测试 */
export const __testing = {
  parseLiteFrontmatter,
  decideNext,
  DRAFT_TO_ACTIVE_USES,
  ACTIVE_TO_STALE_MS,
  STALE_TO_ARCHIVE_MS,
}
