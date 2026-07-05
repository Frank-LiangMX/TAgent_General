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
