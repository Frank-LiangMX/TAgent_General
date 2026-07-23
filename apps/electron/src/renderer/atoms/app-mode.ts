/**
 * App Mode Atom - 应用顶层模式状态
 *
 * 顶层模式：
 * - general: 通用模式（原有 chat/agent/draft）
 * - ta: TA 模式（技术美术专用）
 *
 * 子模式（仅在 general 模式下有效）：
 * - chat: 对话模式
 * - agent: Agent 模式
 * - draft: 需求草稿模式
 */

import { atom, type createStore } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'

import { currentAgentSessionIdAtom } from './agent-atoms'
import { activeTabIdAtom, activeTabIdByModeAtom, isTabVisibleInMode, tabsAtom } from './tab-atoms'

/** jotai store（createStore / useStore 返回值），供非 React 写指定会话 chrome */
export type JotaiStore = ReturnType<typeof createStore>

/** 顶层模式：通用 / TA */
export type TopLevelMode = 'general' | 'ta'

/** 子模式：仅在 general 模式下有效（P3 已退役 chat） */
export type AppMode = 'agent' | 'draft'

/** 顶层模式存储（内部使用，外部通过 topLevelModeAtom 读写） */
const topLevelModeStorageAtom = atomWithStorage<TopLevelMode>('tagent-top-level-mode', 'general')

/**
 * 顶层模式 atom（带副作用）。
 * 切换模式时自动恢复目标模式的 activeTabId，避免 activeTab 被过滤为 null。
 */
export const topLevelModeAtom = atom<TopLevelMode, [TopLevelMode], void>(
  (get) => get(topLevelModeStorageAtom),
  (get, set, newMode: TopLevelMode) => {
    const prevMode = get(topLevelModeStorageAtom)
    if (prevMode === newMode) return
    set(topLevelModeStorageAtom, newMode)

    const activeTabByMode = get(activeTabIdByModeAtom)
    const candidateId = activeTabByMode.get(newMode) ?? null
    if (candidateId) {
      const tabs = get(tabsAtom)
      const tab = tabs.find((t) => t.id === candidateId)
      if (tab && isTabVisibleInMode(tab, newMode)) {
        set(activeTabIdAtom, candidateId)
      }
    }
  }
)

/** App 子模式，自动持久化到 localStorage */
export const appModeAtom = atomWithStorage<AppMode>('tagent-app-mode', 'agent')

export type PluginKindTab = 'mcp' | 'skill'

/** 插件侧栏：市场分类或已安装列表 */
export type PluginSidebarSection =
  | 'recommended'
  | 'dev'
  | 'workflow'
  | 'office'
  | 'planning'
  | 'meta'
  | 'ta'
  | 'installed'

export const pluginSidebarSectionAtom = atomWithStorage<PluginSidebarSection>(
  'tagent-plugin-sidebar-section',
  'recommended'
)

/** 已安装页侧栏筛选（概览 / 整合包 / 单独安装 / MCP / Skill） */
export type InstalledPluginNavFilter = 'overview' | 'orphan' | 'mcp' | 'skill' | `bundle:${string}`

export const installedPluginNavAtom = atom<InstalledPluginNavFilter>('overview')

// ===== Rail Item Atoms =====

/** 通用模式下的侧栏功能项（文件功能已迁移至右侧边栏） */
export type GeneralRailItem = 'sessions' | 'skills' | 'automation' | 'draft' | 'kanban' | 'memory'

/** TA 模式下的侧栏功能项 */
export type TARailItem =
  | 'sessions'
  | 'assets'
  | 'review'
  | 'pipeline'
  | 'memory'
  | 'config'
  | 'kanban'

/** 侧栏功能项联合类型 */
export type RailItem = GeneralRailItem | TARailItem

/** 通用模式侧栏功能项 atom */
export const generalRailItemAtom = atomWithStorage<GeneralRailItem>(
  'tagent-general-rail',
  'sessions'
)

/** TA 模式侧栏功能项 atom */
export const taActiveTabAtom = atomWithStorage<TARailItem>('tagent-ta-active-tab', 'assets')

/**
 * 侧栏功能项 atom（读写派生）。
 * 读取时根据当前顶层模式路由到对应子 atom；
 * 写入时同步设置对应 atom（setter 根据当前模式路由）。
 */
export const activeRailItemAtom = atom<RailItem, [RailItem], void>(
  (get) => {
    const mode = get(topLevelModeAtom)
    if (mode === 'ta') return get(taActiveTabAtom)
    return get(generalRailItemAtom)
  },
  (get, set, newItem: RailItem) => {
    const mode = get(topLevelModeAtom)
    if (mode === 'ta') {
      set(taActiveTabAtom, newItem as TARailItem)
    } else {
      set(generalRailItemAtom, newItem as GeneralRailItem)
    }
  }
)

/** 左侧 Sidebar 展开状态；Rail 始终保留，Sidebar 可回收到当前 Rail 项。 */
export const navigationSidebarOpenAtom = atom<boolean>(true)

const INSPECTOR_EXCLUSIVE_BY_SESSION_KEY = 'tagent-inspector-exclusive-by-session'
const LEGACY_INSPECTOR_EXCLUSIVE_KEY = 'tagent-inspector-exclusive'

/** 校验并规范化持久化的右栏独占开关 */
export function migrateInspectorExclusive(raw: unknown): boolean {
  return typeof raw === 'boolean' ? raw : false
}

function readLegacyInspectorExclusive(): boolean | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(LEGACY_INSPECTOR_EXCLUSIVE_KEY)
    if (raw == null) return undefined
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'boolean' ? parsed : undefined
  } catch {
    return undefined
  }
}

/** 按 sessionId 持久化的右栏独占模式 */
const inspectorExclusiveBySessionStorageAtom = atomWithStorage<Record<string, boolean>>(
  INSPECTOR_EXCLUSIVE_BY_SESSION_KEY,
  {}
)

const writeInspectorExclusiveBySessionAtom = atom(
  null,
  (_get, set, update: (prev: Map<string, boolean>) => Map<string, boolean>) => {
    const stored = _get(inspectorExclusiveBySessionStorageAtom)
    const prev = new Map(
      Object.entries(stored).map(([k, v]) => [k, migrateInspectorExclusive(v)] as const)
    )
    const next = update(prev)
    const obj: Record<string, boolean> = {}
    next.forEach((value, key) => {
      obj[key] = value
    })
    set(inspectorExclusiveBySessionStorageAtom, obj)
  }
)

/** 按 Agent sessionId 读写右栏独占；无 per-session 记录时 fallback 旧全局 key */
export const inspectorExclusiveFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => {
      const stored = get(inspectorExclusiveBySessionStorageAtom)
      if (Object.hasOwn(stored, sessionId)) {
        return migrateInspectorExclusive(stored[sessionId])
      }
      return readLegacyInspectorExclusive() ?? false
    },
    (_get, set, exclusive: boolean) => {
      set(writeInspectorExclusiveBySessionAtom, (prev) => {
        const map = new Map(prev)
        map.set(sessionId, migrateInspectorExclusive(exclusive))
        return map
      })
    }
  )
)

/**
 * 右栏独占模式：隐藏主会话区，右栏吃满可用宽度（预览 / Design Preview 交互用）。
 * 与 Design 沉浸全屏（designImmersive）独立；Esc 可退出（非 design immersive 时）。
 *
 * 当前 Agent 会话的读写 facade；无当前会话时读 false；写入在无会话时 no-op。
 */
export const inspectorExclusiveAtom = atom(
  (get) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return false
    return get(inspectorExclusiveFamily(sessionId))
  },
  (get, set, exclusive: boolean) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(inspectorExclusiveFamily(sessionId), exclusive)
  }
)

// ===== Right Rail Item Atoms（右侧边栏功能切换，按 Agent 会话隔离） =====

/** 右侧边栏功能项：文件面板 / 旁注 / 浏览器预览 / Design 预览 / 班组墙 */
export type RightRailItem = 'files' | 'btw' | 'browser' | 'design' | 'crew'

const VALID_RIGHT_RAIL_ITEMS: ReadonlySet<string> = new Set([
  'files',
  'btw',
  'browser',
  'design',
  'crew',
])

/** 未记录过的会话默认落在「文件」 */
export const DEFAULT_RIGHT_RAIL_ITEM: RightRailItem = 'files'

const RIGHT_RAIL_BY_SESSION_KEY = 'tagent-right-rail-by-session'

function migrateRightRailItem(raw: unknown): RightRailItem {
  return typeof raw === 'string' && VALID_RIGHT_RAIL_ITEMS.has(raw)
    ? (raw as RightRailItem)
    : DEFAULT_RIGHT_RAIL_ITEM
}

/** 按 sessionId 持久化的右栏选中项 */
const rightRailBySessionStorageAtom = atomWithStorage<Record<string, RightRailItem>>(
  RIGHT_RAIL_BY_SESSION_KEY,
  {}
)

const writeRightRailBySessionAtom = atom(
  null,
  (_get, set, update: (prev: Map<string, RightRailItem>) => Map<string, RightRailItem>) => {
    const stored = _get(rightRailBySessionStorageAtom)
    const prev = new Map(
      Object.entries(stored).map(([k, v]) => [k, migrateRightRailItem(v)] as const)
    )
    const next = update(prev)
    const obj: Record<string, RightRailItem> = {}
    next.forEach((value, key) => {
      obj[key] = value
    })
    set(rightRailBySessionStorageAtom, obj)
  }
)

/** 按 Agent sessionId 读写右栏功能项 */
export const rightRailItemFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => {
      const stored = get(rightRailBySessionStorageAtom)
      return migrateRightRailItem(stored[sessionId])
    },
    (_get, set, item: RightRailItem) => {
      set(writeRightRailBySessionAtom, (prev) => {
        const map = new Map(prev)
        map.set(sessionId, migrateRightRailItem(item))
        return map
      })
    }
  )
)

/**
 * 为指定 Agent 会话设置右栏选中项（不必是当前会话）。
 * UI 侧订阅当前会话请继续用 rightRailItemAtom。
 */
export function setRightRailItemForSession(
  store: JotaiStore,
  sessionId: string,
  item: RightRailItem
): void {
  if (!sessionId) return
  store.set(rightRailItemFamily(sessionId), migrateRightRailItem(item))
}

/**
 * 当前 Agent 会话的右栏功能项（读写 facade，兼容旧调用点）。
 * 无当前会话时读默认 'files'；写入在无会话时 no-op。
 */
export const rightRailItemAtom = atom(
  (get) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return DEFAULT_RIGHT_RAIL_ITEM
    return get(rightRailItemFamily(sessionId))
  },
  (get, set, item: RightRailItem) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(rightRailItemFamily(sessionId), migrateRightRailItem(item))
  }
)

// Browser 预览（CSV 看板等）已改为按 Agent 会话隔离 — 见 browser-panel-atoms.ts
export {
  browserPanelUrlAtom,
  browserPanelCsvSessionIdAtom,
  browserSessionStateFamily,
  currentBrowserSessionAtom,
  type BrowserSessionState,
} from './browser-panel-atoms'
