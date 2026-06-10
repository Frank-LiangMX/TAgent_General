/**
 * App Mode Atom - 应用顶层模式状态
 *
 * 顶层模式：
 * - general: 通用模式（原有 chat/agent/scratch）
 * - ta: TA 模式（技术美术专用）
 *
 * 子模式（仅在 general 模式下有效）：
 * - chat: 对话模式
 * - agent: Agent 模式
 * - scratch: 草稿本模式
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

/** 顶层模式：通用 / TA */
export type TopLevelMode = 'general' | 'ta'

/** 子模式：仅在 general 模式下有效 */
export type AppMode = 'chat' | 'agent' | 'scratch'

/** 顶层模式 atom，自动持久化到 localStorage */
export const topLevelModeAtom = atomWithStorage<TopLevelMode>('tagent-top-level-mode', 'general')

/** App 子模式，自动持久化到 localStorage */
export const appModeAtom = atomWithStorage<AppMode>('tagent-app-mode', 'agent')

/** 通用模式下的功能区类型 */
export type GeneralRailItem = 'sessions' | 'files' | 'skills'

/**
 * TA 模式下的功能区类型（含「会话」入口）。
 * TA 模式点击「会话」图标 → 主区显示 TA 会话面板，TA 会话数据与通用模式隔离。
 */
export type TARailItem = 'sessions' | 'assets' | 'review' | 'pipeline' | 'memory' | 'config'

/** 所有功能区类型 */
export type RailItem = GeneralRailItem | TARailItem

/** 能力详情选中项（sidebar 列表点击后，主区域展示详情） */
export interface CapabilitySelection {
  type: 'skill' | 'mcp'
  key: string
}

export const selectedCapabilityAtom = atom<CapabilitySelection | null>(null)

/** 通用模式功能区选中（持久化到 localStorage） */
export const generalRailItemAtom = atomWithStorage<GeneralRailItem>(
  'tagent-general-rail-item',
  'sessions'
)

/** TA 模式功能区选中（持久化到 localStorage） */
export const taActiveTabAtom = atomWithStorage<TARailItem>(
  'tagent-ta-rail-item',
  'sessions'
)

/**
 * 当前激活的功能区（按 topLevelMode 派生）。
 * - general 模式读 generalRailItemAtom
 * - ta 模式读 taActiveTabAtom
 *
 * 切模式时自动切换到对应模式上次选中的功能区（各自独立持久化）。
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
