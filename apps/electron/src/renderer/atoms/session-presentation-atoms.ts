/**
 * Session presentation atoms — per-session classic / AI Office display preference.
 *
 * This is intentionally a renderer-only preference. It does not change AgentSessionMeta,
 * general / TA capability boundaries, Composer mode, or any Kanban business entity.
 */

import { atom } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'

export type SessionPresentation = 'classic' | 'office'

const STORAGE_KEY = 'tagent-session-presentations-v1'

/** Invalid or legacy values always degrade to the text-first classic workspace. */
export function normalizeSessionPresentation(value: unknown): SessionPresentation {
  return value === 'office' ? 'office' : 'classic'
}

export function normalizeSessionPresentationRecord(
  value: unknown
): Record<string, SessionPresentation> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const normalized: Record<string, SessionPresentation> = {}
  for (const [sessionId, presentation] of Object.entries(value)) {
    if (!sessionId) continue
    normalized[sessionId] = normalizeSessionPresentation(presentation)
  }
  return normalized
}

const sessionPresentationStorageAtom = atomWithStorage<Record<string, SessionPresentation>>(
  STORAGE_KEY,
  {},
  undefined,
  { getOnInit: true }
)

export const sessionPresentationAtomFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => {
      const stored = normalizeSessionPresentationRecord(get(sessionPresentationStorageAtom))
      return normalizeSessionPresentation(stored[sessionId])
    },
    (_get, set, next: SessionPresentation) => {
      set(sessionPresentationStorageAtom, (current) => ({
        ...normalizeSessionPresentationRecord(current),
        [sessionId]: normalizeSessionPresentation(next),
      }))
    }
  )
)
