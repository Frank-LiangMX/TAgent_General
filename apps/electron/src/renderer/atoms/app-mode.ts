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

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

import type { TabItem } from './tab-atoms'

import { activeTabIdAtom, activeTabIdByModeAtom, isTabVisibleInMode, tabsAtom } from './tab-atoms'

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
export type GeneralRailItem = 'sessions' | 'skills' | 'automation' | 'draft' | 'kanban'

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
