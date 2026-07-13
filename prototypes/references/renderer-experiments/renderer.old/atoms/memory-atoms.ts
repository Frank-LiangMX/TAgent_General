/**
 * Memory 模块 atoms
 *
 * 左栏 MemoryRailContent 点击 L0-L5 层级时，通过这个 atom 通知
 * 主区 MemoryMonitorPanel 滚动定位到对应层卡片并展开。
 */

import { atom } from 'jotai'

export type MemoryLayerKey = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'

/**
 * 选中的记忆层
 *
 * - null：无选中（默认）
 * - 'L0'-'L5'：主区应滚动定位到对应卡片并展开
 *
 * 主区消费后会将 atom 重置为 null，避免重复触发。
 */
export const memorySelectedLayerAtom = atom<MemoryLayerKey | null>(null)

/**
 * 选中的 L4 会话 ID
 *
 * 左栏会话列表点击后设值，主区 L4 卡片高亮对应会话。
 * - null：无选中
 * - number：sessions.db 中的 id
 *
 * 不会自动重置 — 选中态持续到用户切换或清空搜索。
 */
export const memorySelectedSessionAtom = atom<number | null>(null)

/**
 * 记忆页视图模式
 *
 * 左栏快捷入口点击后设值，主区根据此 atom 切换视图。
 * - 'layers'：层视图（6 个层卡片网格）
 * - 'graph'：Memory Graph 星图
 * - 'pending'：待审批列表（StageQueueCard 独立视图）
 */
export type MemoryViewMode = 'layers' | 'graph' | 'pending'
export const memoryViewModeAtom = atom<MemoryViewMode>('layers')
