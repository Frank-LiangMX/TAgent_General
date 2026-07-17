/**
 * Skill 使用埋点
 *
 * 读写 .usage.json：{ [slug]: { useCount, lastUsedAt } }
 * 并发安全：读-改-写 + 临时文件 rename。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { getSkillUsagePath } from './config-paths'

export interface SkillUsageEntry {
  useCount: number
  lastUsedAt: number
}

export type SkillUsageMap = Record<string, SkillUsageEntry>

function emptyMap(): SkillUsageMap {
  return {}
}

function normalizeMap(raw: unknown): SkillUsageMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyMap()
  const out: SkillUsageMap = {}
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!slug || !value || typeof value !== 'object') continue
    const entry = value as Partial<SkillUsageEntry>
    const useCount =
      typeof entry.useCount === 'number' && Number.isFinite(entry.useCount) && entry.useCount >= 0
        ? Math.floor(entry.useCount)
        : 0
    const lastUsedAt =
      typeof entry.lastUsedAt === 'number' && Number.isFinite(entry.lastUsedAt)
        ? entry.lastUsedAt
        : 0
    out[slug] = { useCount, lastUsedAt }
  }
  return out
}

/** 读取 usage map；文件不存在返回空对象 */
export function readSkillUsage(
  scope: 'global' | 'workspace',
  workspaceSlug?: string
): SkillUsageMap {
  const path = getSkillUsagePath(scope, workspaceSlug)
  if (!existsSync(path)) return emptyMap()
  try {
    const text = readFileSync(path, 'utf-8')
    return normalizeMap(JSON.parse(text) as unknown)
  } catch (err) {
    console.warn('[SkillUsage] 读取失败，回退空 map:', err)
    return emptyMap()
  }
}

/** 原子写入 usage map */
export function writeSkillUsage(
  scope: 'global' | 'workspace',
  map: SkillUsageMap,
  workspaceSlug?: string
): void {
  const path = getSkillUsagePath(scope, workspaceSlug)
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(map, null, 2), 'utf-8')
  renameSync(tmp, path)
}

/**
 * 记录一次 skill 使用（useCount +1，更新 lastUsedAt）
 */
export function recordSkillUsage(
  slug: string,
  scope: 'global' | 'workspace',
  workspaceSlug?: string,
  at: number = Date.now()
): SkillUsageEntry {
  const normalizedSlug = slug.trim()
  if (!normalizedSlug) {
    throw new Error('skill slug 不能为空')
  }
  const map = readSkillUsage(scope, workspaceSlug)
  const prev = map[normalizedSlug] ?? { useCount: 0, lastUsedAt: 0 }
  const next: SkillUsageEntry = {
    useCount: prev.useCount + 1,
    lastUsedAt: at,
  }
  map[normalizedSlug] = next
  writeSkillUsage(scope, map, workspaceSlug)
  return next
}

/** 读取单 skill 的 usage，不存在返回 0 */
export function getSkillUsageEntry(
  slug: string,
  scope: 'global' | 'workspace',
  workspaceSlug?: string
): SkillUsageEntry {
  const map = readSkillUsage(scope, workspaceSlug)
  return map[slug] ?? { useCount: 0, lastUsedAt: 0 }
}

/**
 * 合并两个 scope 的 usage（同 slug 取 max useCount / max lastUsedAt）
 * 用于 UI 列表展示。
 */
export function mergeSkillUsage(...maps: SkillUsageMap[]): SkillUsageMap {
  const out: SkillUsageMap = {}
  for (const map of maps) {
    for (const [slug, entry] of Object.entries(map)) {
      const prev = out[slug]
      if (!prev) {
        out[slug] = { ...entry }
        continue
      }
      out[slug] = {
        useCount: Math.max(prev.useCount, entry.useCount),
        lastUsedAt: Math.max(prev.lastUsedAt, entry.lastUsedAt),
      }
    }
  }
  return out
}
