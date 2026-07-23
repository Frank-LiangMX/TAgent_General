/**
 * Browser 预览面板 — 按 Agent 会话隔离的状态
 *
 * 与 Design Preview 同套路：产物身份绑会话；localhost URL 只是运行时派生，不当唯一真相。
 * CSV 看板：csvSessionId + filePath 稳定；打开时 ensureLiveServer 再得到 url。
 */

import { atom } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'

import { currentAgentSessionIdAtom } from './agent-atoms'

/** 单个 Agent 会话在「预览」栏的状态 */
export interface BrowserSessionState {
  /** 最近一次成功打开的 URL（可能过期；打开时会 ensure 刷新） */
  url: string | null
  /** CSV cache session id（稳定身份） */
  csvSessionId: string | null
  /** dashboard.html 绝对路径 */
  filePath: string | null
  /** 展示标题 */
  title: string | null
  /** 每次 openCsvDashboard 成功递增；URL 不变时也强制 webview reload */
  reloadNonce?: number
}

export const DEFAULT_BROWSER_SESSION_STATE: BrowserSessionState = {
  url: null,
  csvSessionId: null,
  filePath: null,
  title: null,
}

const STORAGE_KEY = 'tagent-browser-session-states'

const browserSessionStatesStorageAtom = atomWithStorage<Record<string, BrowserSessionState>>(
  STORAGE_KEY,
  {}
)

function migrateState(raw: unknown): BrowserSessionState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BROWSER_SESSION_STATE }
  const v = raw as Record<string, unknown>
  return {
    url: typeof v.url === 'string' ? v.url : null,
    csvSessionId: typeof v.csvSessionId === 'string' ? v.csvSessionId : null,
    filePath: typeof v.filePath === 'string' ? v.filePath : null,
    title: typeof v.title === 'string' ? v.title : null,
    reloadNonce: typeof v.reloadNonce === 'number' ? v.reloadNonce : undefined,
  }
}

/** 写入会话状态 Map 并同步 localStorage */
export const writeBrowserSessionStatesAtom = atom(
  null,
  (
    _get,
    set,
    update: (prev: Map<string, BrowserSessionState>) => Map<string, BrowserSessionState>
  ) => {
    const stored = _get(browserSessionStatesStorageAtom)
    const prev = new Map(Object.entries(stored).map(([k, v]) => [k, migrateState(v)] as const))
    const next = update(prev)
    const obj: Record<string, BrowserSessionState> = {}
    next.forEach((value, key) => {
      obj[key] = value
    })
    set(browserSessionStatesStorageAtom, obj)
  }
)

export const browserSessionStatesAtom = atom<Map<string, BrowserSessionState>>((get) => {
  const stored = get(browserSessionStatesStorageAtom)
  return new Map(Object.entries(stored).map(([k, v]) => [k, migrateState(v)] as const))
})

/** 按 Agent sessionId 读写预览状态 */
export const browserSessionStateFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => get(browserSessionStatesAtom).get(sessionId) ?? DEFAULT_BROWSER_SESSION_STATE,
    (
      _get,
      set,
      update: Partial<BrowserSessionState> | ((prev: BrowserSessionState) => BrowserSessionState)
    ) => {
      set(writeBrowserSessionStatesAtom, (prev) => {
        const current = prev.get(sessionId) ?? DEFAULT_BROWSER_SESSION_STATE
        const next = typeof update === 'function' ? update(current) : { ...current, ...update }
        const map = new Map(prev)
        map.set(sessionId, next)
        return map
      })
    }
  )
)

/** 当前 Agent 会话的预览状态 */
export const currentBrowserSessionAtom = atom<BrowserSessionState>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return DEFAULT_BROWSER_SESSION_STATE
  return get(browserSessionStateFamily(sessionId))
})

/**
 * @deprecated 兼容旧全局 key；读写转发到当前会话。
 * 新代码请用 browserSessionStateFamily / openCsvDashboard。
 */
export const browserPanelUrlAtom = atom(
  (get) => get(currentBrowserSessionAtom).url,
  (get, set, url: string | null) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(browserSessionStateFamily(sessionId), { url })
  }
)

/**
 * @deprecated 兼容旧全局 key；读写转发到当前会话。
 */
export const browserPanelCsvSessionIdAtom = atom(
  (get) => get(currentBrowserSessionAtom).csvSessionId,
  (get, set, csvSessionId: string | null) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(browserSessionStateFamily(sessionId), { csvSessionId })
  }
)
