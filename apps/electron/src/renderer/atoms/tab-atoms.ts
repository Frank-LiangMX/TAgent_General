/**
 * Tab Atoms — 当前工作区入口状态管理
 *
 * 顶部标签页管理（Agent / Draft / Preview）。
 * 通过桥接 atom 与现有 currentAgentSessionIdAtom 同步，
 * 确保所有现有派生 atoms 无需修改。
 */

import { atom } from 'jotai'

import {
  agentRunningSessionIdsAtom,
  agentSessionIndicatorMapAtom,
  agentSessionsAtom,
  unviewedCompletedSessionIdsAtom,
} from './agent-atoms'

import type { SessionIndicatorStatus } from './agent-atoms'
import type { PreviewFile } from './preview-atoms'
import type { TopLevelMode } from '@/atoms/app-mode'

import { topLevelModeAtom } from '@/atoms/app-mode'

// ===== 类型定义 =====

/** 标签页类型（Settings 不作为 Tab，保留独立视图） */
export type TabType = 'agent' | 'draft' | 'preview'

/** Draft Tab 的 ID 前缀 */
export const DRAFT_TAB_PREFIX = '__draft__:'

/** 会话预览 Tab 的 ID 前缀：运行时临时入口，不参与持久化 */
const PREVIEW_TAB_PREFIX = '__preview__:'

/** Draft Tab 的 ID 格式：__draft__:<draftId> */
export function createDraftTabId(draftId: string): string {
  return `${DRAFT_TAB_PREFIX}${draftId}`
}

export function isDraftTab(tab: TabItem): boolean {
  return tab.type === 'draft' || tab.id.startsWith(DRAFT_TAB_PREFIX)
}

export function getDraftIdFromTab(tab: TabItem): string | null {
  if (tab.type !== 'draft') return null
  return tab.id.replace(DRAFT_TAB_PREFIX, '')
}

/** 标签页数据 */
export interface TabItem {
  /** 唯一标签 ID（直接使用 sessionId） */
  id: string
  /** 标签页类型 */
  type: TabType
  /** Agent sessionId */
  sessionId: string
  /** 标签页显示标题 */
  title: string
  /**
   * 顶层模式标记（仅 agent/draft/preview 类型有意义）。
   * - 'general'：通用模式会话，TA 模式 TabBar 不显示
   * - 'ta'：TA 模式会话，通用模式 TabBar 不显示
   * 旧记录不设此字段 → 视为 'general'。
   */
  mode?: 'general' | 'ta'
}

/** Tab 持久化数据（保存到 settings.json） */
export interface PersistedTabState {
  tabs: TabItem[]
  activeTabId: string | null
}

/** 会话上次停留的视图：会话对话 vs 文件预览 */
export type SessionView = 'session' | 'preview'

/**
 * 每会话的视图状态（仅运行期内存态，不持久化到磁盘）。
 * 用于在切走再切回同一会话时，重建预览 Tab 并回到上次停留的视图。
 */
export interface SessionViewState {
  /** 该会话的预览 Tab 是否处于"打开"状态（用户主动关闭后置 false） */
  previewTabOpen: boolean
  /** 上次激活的是会话对话还是文件预览 */
  lastView: SessionView
}

/** 切回会话时重建预览 Tab 的提示（由调用方读取 atom 后传入纯函数 openTab） */
export interface OpenTabRestore {
  /** 该会话是否应重建预览 Tab（previewTabOpen && 存在预览文件时为 true） */
  previewTabOpen: boolean
  /** 预览 Tab 标题（重建时使用） */
  previewTitle: string
  /** 上次停留的视图，决定重建后激活预览 Tab 还是会话 Tab */
  lastView: SessionView
}

// ===== 核心 Atoms =====

/** 顶部入口列表（写入时自动清理孤儿 preview tab） */
export const tabsAtom = atom<TabItem[], [TabItem[] | ((prev: TabItem[]) => TabItem[])], void>(
  (get) => get(rawTabsAtom),
  (get, set, updater: TabItem[] | ((prev: TabItem[]) => TabItem[])) => {
    const prev = get(rawTabsAtom)
    const newTabs = typeof updater === 'function' ? updater(prev) : updater

    // Invariant: preview tab 必须有对应的 agent tab
    const agentSessionIds = new Set(
      newTabs.filter((t) => t.type === 'agent').map((t) => t.sessionId)
    )
    const cleaned = newTabs.filter((t) => t.type !== 'preview' || agentSessionIds.has(t.sessionId))
    set(rawTabsAtom, cleaned)
  }
)

/** 内部原始存储 */
const rawTabsAtom = atom<TabItem[]>([])

/**
 * 每个顶层模式各自的激活 tab ID。
 * 切模式时从该 map 读取对应模式的上次激活 tab，互不干扰。
 * 写入时通过 useSetActiveTabId 钩子同步设置。
 */
const initialActiveTabByMode: Map<TopLevelMode, string | null> = new Map<
  TopLevelMode,
  string | null
>([
  ['general', null],
  ['ta', null],
])
export const activeTabIdByModeAtom = atom<Map<TopLevelMode, string | null>>(initialActiveTabByMode)

/**
 * 当前激活的标签 ID（按当前顶层模式从 activeTabIdByModeAtom 派生）。
 * 切模式时此 atom 自动切换到对应模式的 tab。
 * TabBar / TabContent 等读取此 atom 即可获得当前模式激活的 tab。
 *
 * 写入时：同步设置 activeTabIdByModeAtom[当前 mode] = id，
 * 这样所有现有 useSetAtom(activeTabIdAtom) 调用都自动按模式记忆。
 */
export const activeTabIdAtom = atom<string | null, [string | null], void>(
  (get) => {
    const mode = get(topLevelModeAtom)
    return get(activeTabIdByModeAtom).get(mode) ?? null
  },
  (get, set, newId: string | null) => {
    const mode = get(topLevelModeAtom)
    set(activeTabIdByModeAtom, (prev: Map<TopLevelMode, string | null>) => {
      const next = new Map(prev)
      next.set(mode, newId)
      return next
    })
  }
)

/** 标签页 MRU（最近使用）顺序，最近使用的 ID 排在前面 */
export const tabMruAtom = atom<string[]>([])

/**
 * 每会话视图状态 Map（仅运行期内存态，不持久化）。
 * key = sessionId，value = { previewTabOpen, lastView }。
 * 切走会话时预览 Tab 被 openTab 丢弃，切回时据此重建并回到上次视图。
 */
export const sessionViewStateMapAtom = atom<Map<string, SessionViewState>>(new Map())

/** Tab 迷你地图缓存（每个 Tab 的消息预览列表，在消息组件中填充） */
export interface TabMinimapItem {
  id: string
  role: 'user' | 'assistant' | 'status'
  preview: string
  avatar?: string
  model?: string
}
export const tabMinimapCacheAtom = atom<Map<string, TabMinimapItem[]>>(new Map())

/** Draft 编辑内容（HTML 字符串，供 TipTap 编辑器使用） */
export const draftPlaceholderAtom = atom<string>('')
/** Draft 内容是否已从磁盘加载 */
export const draftPlaceholderLoadedAtom = atom<boolean>(false)

// ===== 派生 Atoms =====

/** 标签列表（标题与会话元数据同步） */
export const syncedTabsAtom = atom<TabItem[]>((get) => {
  const tabs = get(tabsAtom)
  const sessions = get(agentSessionsAtom)
  return tabs.map((tab) => {
    if (tab.type !== 'agent') return tab
    const session = sessions.find((s) => s.id === tab.sessionId)
    const title = session?.title
    return title && title !== tab.title ? { ...tab, title } : tab
  })
})

/** 当前活跃标签（从同步列表读取，标题始终最新） */
export const activeTabAtom = atom<TabItem | null>((get) => {
  const activeId = get(activeTabIdAtom)
  if (!activeId) return null
  const mode = get(topLevelModeAtom)
  return get(syncedTabsAtom).find((t) => t.id === activeId && isTabVisibleInMode(t, mode)) ?? null
})

/**
 * 当前活跃标签所属的会话 ID。
 * 预览 Tab 归一化为其 owner 会话的 sessionId，使"会话高亮"与"Ctrl+Tab 定位"
 * 都把预览 Tab 视为所属会话的一部分（preview tab 的 id 自身不参与这些判定）。
 */
export const activeSessionIdAtom = atom<string | null>((get) => {
  const activeTab = get(activeTabAtom)
  return activeTab?.sessionId ?? null
})

/** 标签是否在流式输出中（派生，从现有流式 atoms 计算） */
export const tabStreamingMapAtom = atom<Map<string, boolean>>((get) => {
  const tabs = get(syncedTabsAtom)
  const agentRunning = get(agentRunningSessionIdsAtom)
  const map = new Map<string, boolean>()
  for (const tab of tabs) {
    if (tab.type === 'draft') continue
    // P3: chat 已退役，仅处理 agent 类型
    if (tab.type === 'agent') {
      map.set(tab.id, agentRunning.has(tab.sessionId))
    }
  }
  return map
})

/** 标签页指示点状态（agent 用完整 SessionIndicatorStatus） */
export const tabIndicatorMapAtom = atom<Map<string, SessionIndicatorStatus>>((get) => {
  const tabs = get(syncedTabsAtom)
  const agentIndicator = get(agentSessionIndicatorMapAtom)
  const unviewedCompletedIds = get(unviewedCompletedSessionIdsAtom)
  const map = new Map<string, SessionIndicatorStatus>()
  for (const tab of tabs) {
    if (tab.type === 'draft') continue
    // P3: chat 已退役，仅处理 agent 类型
    if (tab.type === 'agent') {
      const status =
        agentIndicator.get(tab.sessionId) ??
        (unviewedCompletedIds.has(tab.sessionId) ? 'completed' : 'idle')
      map.set(tab.id, status)
    }
  }
  return map
})

// ===== 操作函数 =====

export function createPreviewTabId(sessionId: string): string {
  return `${PREVIEW_TAB_PREFIX}${sessionId}`
}

export function getFileBaseName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath
}

export function getPreviewTabTitle(filePath: string): string {
  return `预览：${getFileBaseName(filePath)}`
}

export function isPreviewTab(tab: TabItem): boolean {
  return tab.type === 'preview' || tab.id.startsWith(PREVIEW_TAB_PREFIX)
}

export function isTabVisibleInMode(tab: TabItem, mode: TopLevelMode): boolean {
  return tab.type === 'draft' || (tab.mode ?? 'general') === mode
}

export const visibleTabsAtom = atom<TabItem[]>((get) => {
  const mode = get(topLevelModeAtom)
  return get(syncedTabsAtom).filter((tab) => isTabVisibleInMode(tab, mode))
})

export const visibleSessionTabsAtom = atom<TabItem[]>((get) => {
  return get(visibleTabsAtom).filter((tab) => tab.type === 'agent')
})

function isSessionTab(tab: TabItem): boolean {
  return tab.type === 'agent'
}

function getPersistentTabs(tabs: TabItem[]): TabItem[] {
  return tabs.filter((tab) => !isDraftTab(tab) && !isPreviewTab(tab))
}

export function getPersistableTabState(
  tabs: TabItem[],
  activeTabId: string | null
): PersistedTabState {
  const persistentTabs = getPersistentTabs(tabs)
  const activeTab = activeTabId ? tabs.find((tab) => tab.id === activeTabId) : null
  const persistentActiveTabId =
    activeTab && isPreviewTab(activeTab)
      ? (persistentTabs.find((tab) => tab.sessionId === activeTab.sessionId && tab.type === 'agent')
          ?.id ??
        persistentTabs.at(-1)?.id ??
        null)
      : activeTabId

  return {
    tabs: persistentTabs,
    activeTabId: persistentActiveTabId,
  }
}

/** 打开或聚焦会话入口。
 * 保留已有标签页，新标签追加到末尾；复用时更新标题。
 * restore 提示存在时，切回带预览的会话会一并重建其预览 Tab 并回到上次视图。 */
export function openTab(
  tabs: TabItem[],
  item: { type: TabType; sessionId: string; title: string; mode?: 'general' | 'ta' },
  restore?: OpenTabRestore
): { tabs: TabItem[]; activeTabId: string } {
  if (item.type === 'draft') {
    const draftTabId = createDraftTabId(item.sessionId)
    const existingIndex = tabs.findIndex((t) => t.id === draftTabId)
    const draftTab =
      existingIndex !== -1
        ? { ...tabs[existingIndex]!, title: item.title }
        : { id: draftTabId, type: 'draft' as const, sessionId: item.sessionId, title: item.title }
    if (existingIndex !== -1) {
      const newTabs = [...tabs]
      newTabs[existingIndex] = draftTab
      return { tabs: newTabs, activeTabId: draftTabId }
    }
    return { tabs: [...tabs, draftTab], activeTabId: draftTabId }
  }

  if (item.type === 'preview') {
    const ownerAgentTabIndex = tabs.findIndex(
      (t) => t.type === 'agent' && t.sessionId === item.sessionId
    )
    const ownerAgentTab =
      ownerAgentTabIndex !== -1
        ? tabs[ownerAgentTabIndex]!
        : {
            id: item.sessionId,
            type: 'agent' as const,
            sessionId: item.sessionId,
            title: item.title,
          }
    const previewTab: TabItem = {
      id: createPreviewTabId(item.sessionId),
      type: 'preview',
      sessionId: item.sessionId,
      title: item.title,
    }
    const previewIndex = tabs.findIndex((t) => t.id === previewTab.id)
    // 重建：移除旧预览 tab，保留 owner agent tab 原位
    const otherTabs = tabs.filter((t) => t.id !== previewTab.id)
    if (ownerAgentTabIndex === -1) {
      otherTabs.push(ownerAgentTab)
    }
    // 预览 tab 追加到 owner 之后
    const insertAfter = otherTabs.findIndex((t) => t.id === ownerAgentTab.id)
    if (insertAfter !== -1) {
      otherTabs.splice(insertAfter + 1, 0, previewTab)
    } else {
      otherTabs.push(previewTab)
    }
    return {
      tabs: otherTabs,
      activeTabId: previewTab.id,
    }
  }

  const existingIndex = tabs.findIndex(
    (t) => t.sessionId === item.sessionId && t.type === item.type
  )
  const sessionTab: TabItem =
    existingIndex !== -1
      ? { ...tabs[existingIndex]!, title: item.title }
      : {
          id: item.sessionId,
          type: item.type,
          sessionId: item.sessionId,
          title: item.title,
          mode: item.mode ?? 'general',
        }

  // 切回带预览的会话：重建该会话的预览 Tab，并按 lastView 决定激活哪个。
  if (restore?.previewTabOpen) {
    const previewTab: TabItem = {
      id: createPreviewTabId(item.sessionId),
      type: 'preview',
      sessionId: item.sessionId,
      title: restore.previewTitle,
    }
    // 已有 tab 保持原位，只重建预览 tab
    const otherTabs = tabs.filter((t) => t.id !== previewTab.id)
    if (existingIndex !== -1) {
      otherTabs.splice(existingIndex, 1, sessionTab)
    } else {
      otherTabs.push(sessionTab)
    }
    otherTabs.push(previewTab)
    return {
      tabs: otherTabs,
      activeTabId: restore.lastView === 'preview' ? previewTab.id : sessionTab.id,
    }
  }

  // 已有的 tab 保持原位，只更新标题和激活态；新 tab 追加到末尾
  if (existingIndex !== -1) {
    const newTabs = [...tabs]
    newTabs[existingIndex] = sessionTab
    return {
      tabs: newTabs,
      activeTabId: sessionTab.id,
    }
  }

  return {
    tabs: [...tabs, sessionTab],
    activeTabId: sessionTab.id,
  }
}

/**
 * 从视图状态与预览文件 Map 构造 openTab 的 restore 提示。
 * 仅当该会话预览 Tab 处于打开状态且确实有预览文件时才返回提示，否则返回 undefined。
 * 供 useOpenSession / TabSwitcher 等切换入口在调用 openTab 前读取 atom 后传入。
 */
export function buildOpenTabRestore(
  sessionId: string,
  viewStateMap: Map<string, SessionViewState>,
  previewFileMap: Map<string, PreviewFile | null>
): OpenTabRestore | undefined {
  const viewState = viewStateMap.get(sessionId)
  const previewFile = previewFileMap.get(sessionId)
  if (!viewState?.previewTabOpen || !previewFile) return undefined
  return {
    previewTabOpen: true,
    previewTitle: getPreviewTabTitle(previewFile.filePath),
    lastView: viewState.lastView,
  }
}

/** 关闭标签页 */
export function closeTab(
  tabs: TabItem[],
  activeTabId: string | null,
  tabId: string
): { tabs: TabItem[]; activeTabId: string | null } {
  const tabIndex = tabs.findIndex((t) => t.id === tabId)
  if (tabIndex === -1) return { tabs, activeTabId }
  const closingTab = tabs[tabIndex]!
  const boundPreviewId = isSessionTab(closingTab) ? createPreviewTabId(closingTab.sessionId) : null

  const newTabs = tabs.filter((t) => t.id !== tabId && (!boundPreviewId || t.id !== boundPreviewId))

  let newActiveTabId = activeTabId
  if (activeTabId === tabId || (boundPreviewId !== null && activeTabId === boundPreviewId)) {
    if (newTabs.length > 0) {
      const approxIndex = Math.min(tabIndex, newTabs.length - 1)
      newActiveTabId = newTabs[findNearestNonPreviewTab(newTabs, approxIndex)]!.id
    } else {
      newActiveTabId = null
    }
  }

  return { tabs: newTabs, activeTabId: newActiveTabId }
}

/** 从近似位置向两侧扩展，找到最近的非 preview 标签 */
function findNearestNonPreviewTab(tabs: TabItem[], approxIndex: number): number {
  for (let offset = 0; offset < tabs.length; offset++) {
    const right = approxIndex + offset
    if (right < tabs.length && tabs[right]?.type !== 'preview') return right
    const left = approxIndex - offset - 1
    if (left >= 0 && tabs[left]?.type !== 'preview') return left
  }
  return 0
}

/** 重排标签顺序（当前只保留 Scratch + 当前会话，保留函数用于兼容旧调用） */
export function reorderTabs(tabs: TabItem[], fromIndex: number, toIndex: number): TabItem[] {
  if (fromIndex === toIndex) return tabs
  // Scratch 不可移出第 0 位
  if (tabs[0]?.id === DRAFT_TAB_PREFIX && (fromIndex === 0 || toIndex === 0)) return tabs
  const newTabs = [...tabs]
  const [moved] = newTabs.splice(fromIndex, 1)
  newTabs.splice(toIndex, 0, moved!)
  return newTabs
}

/** 更新标签标题 */
export function updateTabTitle(tabs: TabItem[], sessionId: string, title: string): TabItem[] {
  return tabs.map((t) => (t.sessionId === sessionId && !isPreviewTab(t) ? { ...t, title } : t))
}

/** 创建 Draft 标签 */
export function createDraftTab(draftId: string, title: string): TabItem {
  return {
    id: createDraftTabId(draftId),
    type: 'draft',
    sessionId: draftId,
    title,
  }
}
