/**
 * Skill 固化候选存储：~/.tagent/skill-suggestions.json
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { getSkillSuggestionsPath } from './config-paths'

export interface SkillSuggestionCandidate {
  type: 'repeated_workflow' | 'frustration_signal'
  pattern: string
  tools?: string[]
  occurrences: number
  sessionIds: string[]
  firstSeenAt: number
  lastSeenAt: number
  suggestedSkillName: string
  suggestedDescription: string
  avgSimilarity?: number
  /** open | dismissed | created */
  status: 'open' | 'dismissed' | 'created'
}

export interface SkillSuggestionsStore {
  candidates: SkillSuggestionCandidate[]
  lastUpdatedAt: number
}

function emptyStore(): SkillSuggestionsStore {
  return { candidates: [], lastUpdatedAt: 0 }
}

export function loadSkillSuggestions(): SkillSuggestionsStore {
  const path = getSkillSuggestionsPath()
  if (!existsSync(path)) return emptyStore()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Partial<SkillSuggestionsStore>
    if (!raw || !Array.isArray(raw.candidates)) return emptyStore()
    return {
      candidates: raw.candidates.filter(
        (c): c is SkillSuggestionCandidate =>
          !!c &&
          typeof c === 'object' &&
          typeof c.suggestedSkillName === 'string' &&
          typeof c.pattern === 'string'
      ),
      lastUpdatedAt: typeof raw.lastUpdatedAt === 'number' ? raw.lastUpdatedAt : 0,
    }
  } catch (err) {
    console.warn('[SkillSuggestions] 读取失败:', err)
    return emptyStore()
  }
}

export function saveSkillSuggestions(store: SkillSuggestionsStore): void {
  const path = getSkillSuggestionsPath()
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const next: SkillSuggestionsStore = {
    candidates: store.candidates,
    lastUpdatedAt: Date.now(),
  }
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
  renameSync(tmp, path)
}

/** 按 pattern 幂等 upsert（更新 occurrences / sessionIds） */
export function upsertSkillSuggestion(candidate: SkillSuggestionCandidate): void {
  const store = loadSkillSuggestions()
  const idx = store.candidates.findIndex(
    (c) => c.pattern === candidate.pattern && c.status === 'open'
  )
  if (idx >= 0) {
    const prev = store.candidates[idx]!
    const sessionIds = Array.from(new Set([...prev.sessionIds, ...candidate.sessionIds]))
    store.candidates[idx] = {
      ...prev,
      ...candidate,
      sessionIds,
      occurrences: Math.max(prev.occurrences, candidate.occurrences, sessionIds.length),
      firstSeenAt: Math.min(prev.firstSeenAt, candidate.firstSeenAt),
      lastSeenAt: Math.max(prev.lastSeenAt, candidate.lastSeenAt),
    }
  } else {
    store.candidates.push(candidate)
  }
  // 只保留最近 50 条 open+created
  store.candidates = store.candidates.sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 50)
  saveSkillSuggestions(store)
}
