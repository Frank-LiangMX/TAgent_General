/**
 * Skill 调用埋点：从 tool_use / mention 中解析 slug 并写入 .usage.json
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { getGlobalSkillsDir, getWorkspaceSkillsDir } from './config-paths'
import { recordSkillUsage } from './skill-usage-tracker'

/** 从 qualified name / 路径中抽出 slug */
export function extractSkillSlug(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  // tagent-workspace-foo:weekly-speed-test → weekly-speed-test
  const colon = text.lastIndexOf(':')
  let candidate = colon >= 0 ? text.slice(colon + 1) : text
  candidate = candidate.replace(/\\/g, '/')
  const parts = candidate.split('/').filter(Boolean)
  let leaf = parts[parts.length - 1] ?? candidate
  // skills/brandkit/SKILL.md → brandkit
  if (/^skill\.md$/i.test(leaf) && parts.length >= 2) {
    leaf = parts[parts.length - 2]!
  }
  candidate = leaf.replace(/\.md$/i, '').trim().toLowerCase()
  if (!/^[a-z][a-z0-9-]*$/.test(candidate)) return null
  return candidate
}

/**
 * 从 tool_use 名称 + input 推断 skill slug
 * 兼容 Skill 工具、skill_manage、以及带 skill 字段的 MCP 包装
 */
export function extractSkillSlugFromToolUse(
  toolName: string,
  input: unknown
): string | null {
  const name = toolName.trim()
  const lower = name.toLowerCase()

  // skill_manage：create/patch 等带 slug
  if (
    lower === 'skill_manage' ||
    lower.endsWith('__skill_manage') ||
    lower.includes('skill_manage')
  ) {
    if (input && typeof input === 'object') {
      const slug = (input as { slug?: unknown }).slug
      if (typeof slug === 'string') return extractSkillSlug(slug)
    }
    return null
  }

  // Claude Code / Agent SDK Skill 工具
  const isSkillTool =
    lower === 'skill' ||
    lower === 'invoke_skill' ||
    lower === 'use_skill' ||
    lower.endsWith('__skill') ||
    lower.endsWith(':skill')

  if (isSkillTool && input && typeof input === 'object') {
    const obj = input as Record<string, unknown>
    for (const key of ['skill', 'name', 'skill_name', 'skillName', 'command', 'slug']) {
      const v = obj[key]
      if (typeof v === 'string' && v.trim()) {
        const slug = extractSkillSlug(v)
        if (slug) return slug
      }
    }
  }

  // 工具名本身像 skill slug 且 input 空（少见）
  return null
}

/** 解析 skill 落在 global 还是 workspace */
export function resolveSkillUsageScope(
  slug: string,
  workspaceSlug?: string
): { scope: 'global' | 'workspace'; workspaceSlug?: string } {
  if (workspaceSlug) {
    const wsDir = join(getWorkspaceSkillsDir(workspaceSlug), slug)
    if (existsSync(wsDir)) {
      return { scope: 'workspace', workspaceSlug }
    }
  }
  const globalDir = join(getGlobalSkillsDir(), slug)
  if (existsSync(globalDir)) {
    return { scope: 'global' }
  }
  // 默认记到 workspace（若有），否则 global
  if (workspaceSlug) return { scope: 'workspace', workspaceSlug }
  return { scope: 'global' }
}

/**
 * 记录一次 skill 调用（吞错，不影响主链路）
 */
export function noteSkillInvocation(slug: string, workspaceSlug?: string): void {
  try {
    const safe = extractSkillSlug(slug)
    if (!safe) return
    const { scope, workspaceSlug: ws } = resolveSkillUsageScope(safe, workspaceSlug)
    recordSkillUsage(safe, scope, ws)
  } catch (err) {
    console.warn('[SkillUsage] 埋点失败:', err)
  }
}

/** 批量 mention 埋点 */
export function noteMentionedSkills(slugs: string[], workspaceSlug?: string): void {
  for (const slug of slugs) {
    noteSkillInvocation(slug, workspaceSlug)
  }
}
