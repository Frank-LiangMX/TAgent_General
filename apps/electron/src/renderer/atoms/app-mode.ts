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

/** 功能区 atom，根据 topLevelMode 自动切换默认值
 * - general 模式默认 'sessions'
 * - ta 模式默认 'assets'
 */
export const activeRailItemAtom = atomWithStorage<RailItem>('tagent-active-rail-item', 'sessions')

/**
 * TA 模式主区 Tab（与 FunctionalRail 的 TA_RAIL_ITEMS 对应）。
 * TA 模式下主区 Tab 和 rail 图标同步选中状态。
 */
export type TAActiveTab = 'sessions' | 'assets' | 'review' | 'pipeline' | 'memory' | 'config'

export const taActiveTabAtom = atomWithStorage<TAActiveTab>('tagent-ta-active-tab', 'assets')
