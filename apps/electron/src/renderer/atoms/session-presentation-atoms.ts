/**
 * Session presentation atoms — classic / AI Office display preference.
 *
 * - `globalOfficeModeAtom`: application-level Office mode toggle
 * - `sessionPresentationAtomFamily`: per-session override (legacy, used for fallback)
 *
 * This is intentionally a renderer-only preference. It does not change AgentSessionMeta,
 * general / TA capability boundaries, Composer mode, or any Kanban business entity.
 */

import { atom } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'

export type SessionPresentation = 'classic' | 'office'
export type OfficeMotionMode = 'full' | 'reduced'

export interface OfficeCameraState {
  scale: number
  offsetX: number
  offsetY: number
}

export interface OfficeChatPosition {
  x: number
  y: number
}

export type OfficeChatUISize = 'small' | 'medium' | 'large'

export interface OfficeSessionViewState {
  chatCollapsed: boolean
  chatWidth: number
  chatHeight: number
  chatPosition: OfficeChatPosition
  chatUISize: OfficeChatUISize
  camera: OfficeCameraState
}

const STORAGE_KEY = 'tagent-session-presentations-v1'
const VIEW_STATE_STORAGE_KEY = 'tagent-office-session-view-states-v1'

const DEFAULT_OFFICE_VIEW_STATE: OfficeSessionViewState = {
  chatCollapsed: false,
  chatWidth: 440,
  chatHeight: 600,
  chatPosition: { x: -1, y: -1 },
  chatUISize: 'medium',
  camera: { scale: 1, offsetX: 0, offsetY: 0 },
}

export const defaultSessionPresentationAtom = atomWithStorage<SessionPresentation>(
  'tagent-default-session-presentation-v1',
  'classic',
  undefined,
  { getOnInit: true }
)

export const officeMotionModeAtom = atomWithStorage<OfficeMotionMode>(
  'tagent-office-motion-mode-v1',
  'full',
  undefined,
  { getOnInit: true }
)

/**
 * Global Office mode toggle.
 *
 * When true, the active session renders in Office immersive shell.
 * When false, classic workspace is used.
 */
export const globalOfficeModeAtom = atomWithStorage<boolean>(
  'tagent-global-office-mode-v1',
  false,
  undefined,
  { getOnInit: true }
)

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

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeOfficeSessionViewState(value: unknown): OfficeSessionViewState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...DEFAULT_OFFICE_VIEW_STATE,
      chatPosition: { ...DEFAULT_OFFICE_VIEW_STATE.chatPosition },
      camera: { ...DEFAULT_OFFICE_VIEW_STATE.camera },
    }
  }
  const candidate = value as Partial<OfficeSessionViewState>
  const camera = candidate.camera
  const chatPosition = candidate.chatPosition
  const validUISizes: OfficeChatUISize[] = ['small', 'medium', 'large']
  const chatUISize = validUISizes.includes(candidate.chatUISize as OfficeChatUISize)
    ? (candidate.chatUISize as OfficeChatUISize)
    : DEFAULT_OFFICE_VIEW_STATE.chatUISize
  return {
    chatCollapsed:
      typeof candidate.chatCollapsed === 'boolean'
        ? candidate.chatCollapsed
        : DEFAULT_OFFICE_VIEW_STATE.chatCollapsed,
    chatWidth: Math.max(
      360,
      Math.min(620, finiteNumber(candidate.chatWidth, DEFAULT_OFFICE_VIEW_STATE.chatWidth))
    ),
    chatHeight: Math.max(
      300,
      Math.min(900, finiteNumber(candidate.chatHeight, DEFAULT_OFFICE_VIEW_STATE.chatHeight))
    ),
    chatPosition: {
      x: finiteNumber(chatPosition?.x, DEFAULT_OFFICE_VIEW_STATE.chatPosition.x),
      y: finiteNumber(chatPosition?.y, DEFAULT_OFFICE_VIEW_STATE.chatPosition.y),
    },
    chatUISize,
    camera: {
      scale: Math.max(
        0.3,
        Math.min(3, finiteNumber(camera?.scale, DEFAULT_OFFICE_VIEW_STATE.camera.scale))
      ),
      offsetX: finiteNumber(camera?.offsetX, DEFAULT_OFFICE_VIEW_STATE.camera.offsetX),
      offsetY: finiteNumber(camera?.offsetY, DEFAULT_OFFICE_VIEW_STATE.camera.offsetY),
    },
  }
}

function officeViewStatesEqual(a: OfficeSessionViewState, b: OfficeSessionViewState): boolean {
  return (
    a.chatCollapsed === b.chatCollapsed &&
    a.chatWidth === b.chatWidth &&
    a.chatHeight === b.chatHeight &&
    a.chatPosition.x === b.chatPosition.x &&
    a.chatPosition.y === b.chatPosition.y &&
    a.chatUISize === b.chatUISize &&
    a.camera.scale === b.camera.scale &&
    a.camera.offsetX === b.camera.offsetX &&
    a.camera.offsetY === b.camera.offsetY
  )
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
      return stored[sessionId] ?? normalizeSessionPresentation(get(defaultSessionPresentationAtom))
    },
    (_get, set, next: SessionPresentation) => {
      set(sessionPresentationStorageAtom, (current) => ({
        ...normalizeSessionPresentationRecord(current),
        [sessionId]: normalizeSessionPresentation(next),
      }))
    }
  )
)

const officeSessionViewStateStorageAtom = atomWithStorage<Record<string, OfficeSessionViewState>>(
  VIEW_STATE_STORAGE_KEY,
  {},
  undefined,
  { getOnInit: true }
)

export const officeSessionViewStateAtomFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => normalizeOfficeSessionViewState(get(officeSessionViewStateStorageAtom)[sessionId]),
    (
      get,
      set,
      update:
        | Partial<OfficeSessionViewState>
        | ((current: OfficeSessionViewState) => OfficeSessionViewState)
    ) => {
      const current = normalizeOfficeSessionViewState(
        get(officeSessionViewStateStorageAtom)[sessionId]
      )
      const next = typeof update === 'function' ? update(current) : { ...current, ...update }
      const normalized = normalizeOfficeSessionViewState(next)
      if (officeViewStatesEqual(current, normalized)) return
      set(officeSessionViewStateStorageAtom, (stored) => ({
        ...stored,
        [sessionId]: normalized,
      }))
    }
  )
)
