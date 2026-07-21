/**
 * Skill 文件管理核心（无 SDK 依赖，可单测）
 *
 * 供 skill_manage MCP 工具与 Curator 共用。
 * 路径白名单：仅允许写全局 skills 目录与指定工作区 skills 目录。
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'

import type {
  SkillCreatedBy,
  SkillLifecycleStatus,
  SkillProvenance,
  SkillScope,
} from '@tagent/shared'

import {
  getGlobalSkillsArchivedDir,
  getGlobalSkillsDir,
  getInactiveSkillsDir,
  getWorkspaceSkillsDir,
} from './config-paths'

/** slug：小写字母开头，仅 a-z 0-9 与连字符 */
export const SKILL_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/

export const MAX_DESCRIPTION_SOFT = 1024
export const MAX_DESCRIPTION_HARD = 2000

export interface SkillManageCreateInput {
  slug: string
  name: string
  description: string
  body?: string
  /** 默认 global */
  scope?: SkillScope
  workspaceSlug?: string
  provenance?: SkillProvenance
  createdBy?: SkillCreatedBy
  status?: SkillLifecycleStatus
  pinned?: boolean
  version?: string
}

export interface SkillManagePatchInput {
  slug: string
  scope?: SkillScope
  workspaceSlug?: string
  name?: string
  description?: string
  body?: string
  status?: SkillLifecycleStatus
  pinned?: boolean
  version?: string
}

export interface SkillManageResult {
  ok: boolean
  slug: string
  scope: SkillScope
  path: string
  message: string
}

function assertValidSlug(slug: string): string {
  const s = slug.trim().toLowerCase()
  if (!SKILL_SLUG_PATTERN.test(s)) {
    throw new Error(
      `非法 skill slug: "${slug}"（需匹配 ${SKILL_SLUG_PATTERN}，例如 weekly-speed-test）`
    )
  }
  if (s.length > 64) {
    throw new Error('skill slug 过长（最多 64 字符）')
  }
  return s
}

function clampDescription(description: string): string {
  const text = description.trim()
  if (text.length > MAX_DESCRIPTION_HARD) {
    return text.slice(0, MAX_DESCRIPTION_HARD)
  }
  return text
}

function resolveSkillsRoot(scope: SkillScope, workspaceSlug?: string): string {
  if (scope === 'global') {
    return getGlobalSkillsDir()
  }
  if (!workspaceSlug?.trim()) {
    throw new Error('workspace scope 需要 workspaceSlug')
  }
  return getWorkspaceSkillsDir(workspaceSlug.trim())
}

function resolveArchivedRoot(scope: SkillScope, workspaceSlug?: string): string {
  if (scope === 'global') {
    return getGlobalSkillsArchivedDir()
  }
  // 工作区归档：复用 skills-inactive 旁的 skills-archived
  if (!workspaceSlug?.trim()) {
    throw new Error('workspace scope 需要 workspaceSlug')
  }
  const dir = join(getInactiveSkillsDir(workspaceSlug.trim()), '..', 'skills-archived')
  const resolved = resolve(dir)
  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true })
  }
  return resolved
}

/** 确保 skill 目录在允许根内（防 path traversal） */
export function assertSkillPathInRoot(skillDir: string, root: string): void {
  const resolvedSkill = resolve(skillDir)
  const resolvedRoot = resolve(root)
  const prefix = resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep
  if (resolvedSkill !== resolvedRoot && !resolvedSkill.startsWith(prefix)) {
    throw new Error(`路径越界：skill 必须位于 ${resolvedRoot} 内`)
  }
}

export function getSkillDir(
  slug: string,
  scope: SkillScope = 'global',
  workspaceSlug?: string
): string {
  const safe = assertValidSlug(slug)
  const root = resolveSkillsRoot(scope, workspaceSlug)
  const dir = join(root, safe)
  assertSkillPathInRoot(dir, root)
  return dir
}

function buildFrontmatter(input: {
  name: string
  description: string
  version: string
  provenance: SkillProvenance
  createdBy: SkillCreatedBy
  status: SkillLifecycleStatus
  pinned: boolean
}): string {
  const desc = clampDescription(input.description).replace(/\r?\n/g, ' ')
  return [
    '---',
    `name: ${JSON.stringify(input.name)}`,
    `description: ${JSON.stringify(desc)}`,
    `version: ${JSON.stringify(input.version)}`,
    `provenance: ${input.provenance}`,
    `created_by: ${input.createdBy}`,
    `status: ${input.status}`,
    `pinned: ${input.pinned ? 'true' : 'false'}`,
    '---',
    '',
  ].join('\n')
}

function defaultBody(name: string, description: string): string {
  return [
    `# ${name}`,
    '',
    description,
    '',
    '## 使用说明',
    '',
    '当任务匹配 description 中的触发场景时，按下列步骤执行。',
    '',
    '1. 确认当前目标与约束',
    '2. 按既定流程逐步完成',
    '3. 完成后用简短清单汇报结果',
    '',
  ].join('\n')
}

/** 创建 skill（目录已存在则失败） */
export function createSkill(input: SkillManageCreateInput): SkillManageResult {
  const scope: SkillScope = input.scope ?? 'global'
  const slug = assertValidSlug(input.slug)
  const name = input.name.trim() || slug
  const description = clampDescription(input.description || name)
  const dir = getSkillDir(slug, scope, input.workspaceSlug)

  if (existsSync(dir)) {
    throw new Error(`skill 已存在: ${slug} (${scope})`)
  }

  mkdirSync(dir, { recursive: true })
  const frontmatter = buildFrontmatter({
    name,
    description,
    version: input.version?.trim() || '0.1.0',
    provenance: input.provenance ?? 'background',
    createdBy: input.createdBy ?? 'agent',
    status: input.status ?? 'draft',
    pinned: input.pinned ?? false,
  })
  const body = input.body?.trim() ? input.body.trim() + '\n' : defaultBody(name, description)
  const skillMd = join(dir, 'SKILL.md')
  writeFileSync(skillMd, frontmatter + body, 'utf-8')

  return {
    ok: true,
    slug,
    scope,
    path: skillMd,
    message: `已创建 skill ${slug}（${scope}/${input.status ?? 'draft'}）`,
  }
}

/** 读取 SKILL.md 全文 */
export function readSkillMarkdown(
  slug: string,
  scope: SkillScope = 'global',
  workspaceSlug?: string
): string {
  const dir = getSkillDir(slug, scope, workspaceSlug)
  const skillMd = join(dir, 'SKILL.md')
  if (!existsSync(skillMd)) {
    throw new Error(`SKILL.md 不存在: ${slug}`)
  }
  return readFileSync(skillMd, 'utf-8')
}

/**
 * 更新 frontmatter 字段和/或 body。
 * body 为 SKILL.md 中 frontmatter 之后的内容。
 */
export function patchSkill(input: SkillManagePatchInput): SkillManageResult {
  const scope: SkillScope = input.scope ?? 'global'
  const slug = assertValidSlug(input.slug)
  const dir = getSkillDir(slug, scope, input.workspaceSlug)
  const skillMd = join(dir, 'SKILL.md')
  if (!existsSync(skillMd)) {
    throw new Error(`skill 不存在: ${slug}`)
  }

  const current = readFileSync(skillMd, 'utf-8')
  const fmMatch = current.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  let fmBlock = fmMatch?.[1] ?? ''
  let body = fmMatch?.[2] ?? current

  const setFm = (key: string, value: string): void => {
    const line = `${key}: ${value}`
    const re = new RegExp(`^${key}\\s*:.*$`, 'm')
    if (re.test(fmBlock)) {
      fmBlock = fmBlock.replace(re, line)
    } else {
      fmBlock = fmBlock ? `${fmBlock.trimEnd()}\n${line}` : line
    }
  }

  if (input.name !== undefined) setFm('name', JSON.stringify(input.name.trim()))
  if (input.description !== undefined) {
    setFm('description', JSON.stringify(clampDescription(input.description)))
  }
  if (input.version !== undefined) setFm('version', JSON.stringify(input.version.trim()))
  if (input.status !== undefined) setFm('status', input.status)
  if (input.pinned !== undefined) setFm('pinned', input.pinned ? 'true' : 'false')
  if (input.body !== undefined) body = input.body.endsWith('\n') ? input.body : input.body + '\n'

  const next = `---\n${fmBlock.trim()}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`
  writeFileSync(skillMd, next, 'utf-8')

  return {
    ok: true,
    slug,
    scope,
    path: skillMd,
    message: `已更新 skill ${slug}`,
  }
}

/** 删除 skill 目录（不可恢复；归档请用 archiveSkill） */
export function deleteSkill(
  slug: string,
  scope: SkillScope = 'global',
  workspaceSlug?: string
): SkillManageResult {
  const safe = assertValidSlug(slug)
  const dir = getSkillDir(safe, scope, workspaceSlug)
  if (!existsSync(dir)) {
    throw new Error(`skill 不存在: ${safe}`)
  }
  rmSync(dir, { recursive: true, force: true })
  return {
    ok: true,
    slug: safe,
    scope,
    path: dir,
    message: `已删除 skill ${safe}`,
  }
}

/** 归档：移到 skills-archived/，不进 SDK 扫描 */
export function archiveSkill(
  slug: string,
  scope: SkillScope = 'global',
  workspaceSlug?: string
): SkillManageResult {
  const safe = assertValidSlug(slug)
  const dir = getSkillDir(safe, scope, workspaceSlug)
  if (!existsSync(dir)) {
    throw new Error(`skill 不存在: ${safe}`)
  }
  const archivedRoot = resolveArchivedRoot(scope, workspaceSlug)
  const dest = join(archivedRoot, safe)
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true })
  }
  renameSync(dir, dest)
  // 标记 status=archived（若仍有 SKILL.md）
  const skillMd = join(dest, 'SKILL.md')
  if (existsSync(skillMd)) {
    try {
      // 临时把 archived 根当作 skills 根不可行；直接改文件
      const content = readFileSync(skillMd, 'utf-8')
      const next = content.replace(/^status:\s*.*$/m, 'status: archived')
      if (next === content && /^---/m.test(content)) {
        writeFileSync(skillMd, content.replace(/^---\s*\n/, '---\nstatus: archived\n'), 'utf-8')
      } else {
        writeFileSync(skillMd, next, 'utf-8')
      }
    } catch {
      // 忽略 frontmatter 修补失败
    }
  }
  return {
    ok: true,
    slug: safe,
    scope,
    path: dest,
    message: `已归档 skill ${safe}`,
  }
}

/** 从归档恢复到活跃 skills/ */
export function restoreArchivedSkill(
  slug: string,
  scope: SkillScope = 'global',
  workspaceSlug?: string
): SkillManageResult {
  const safe = assertValidSlug(slug)
  const archivedRoot = resolveArchivedRoot(scope, workspaceSlug)
  const src = join(archivedRoot, safe)
  if (!existsSync(src)) {
    throw new Error(`归档中不存在 skill: ${safe}`)
  }
  const dest = getSkillDir(safe, scope, workspaceSlug)
  if (existsSync(dest)) {
    throw new Error(`活跃目录已存在 skill: ${safe}`)
  }
  renameSync(src, dest)
  patchSkill({
    slug: safe,
    scope,
    workspaceSlug,
    status: 'active',
  })
  return {
    ok: true,
    slug: safe,
    scope,
    path: dest,
    message: `已恢复 skill ${safe}`,
  }
}

/** 列出 scope 下所有 skill slug */
export function listSkillSlugs(scope: SkillScope, workspaceSlug?: string): string[] {
  const root = resolveSkillsRoot(scope, workspaceSlug)
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .filter((name) => SKILL_SLUG_PATTERN.test(name))
    .sort()
}

/** 是否已有同名 skill（全局或指定工作区） */
export function skillExistsAnywhere(slug: string, workspaceSlug?: string): boolean {
  const safe = assertValidSlug(slug)
  if (existsSync(getSkillDir(safe, 'global'))) return true
  if (workspaceSlug && existsSync(getSkillDir(safe, 'workspace', workspaceSlug))) return true
  return false
}

/** 从目录名得到 basename 安全 slug 建议 */
export function suggestSlugFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const candidate = base && /^[a-z]/.test(base) ? base : `skill-${base || 'auto'}`
  return SKILL_SLUG_PATTERN.test(candidate) ? candidate : `skill-${Date.now().toString(36)}`
}

export function skillDirBasename(path: string): string {
  return basename(path)
}
