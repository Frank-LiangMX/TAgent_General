/**
 * Model Atoms — 模型/渠道相关的 Jotai 状态
 *
 * 从 chat-atoms.ts 迁移出的共享 atom，被 Agent 和其他模块使用。
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

import type { Channel } from '@tagent/shared'

/** 全局渠道列表缓存（启动时加载一次，设置变更时刷新） */
export const channelsAtom = atom<Channel[]>([])

/** 渠道列表是否已完成首次加载 */
export const channelsLoadedAtom = atom(false)

/** 选中的模型信息 */
export interface SelectedModel {
  channelId: string
  modelId: string
}

/** 选中的模型（持久化到 localStorage） */
export const selectedModelAtom = atomWithStorage<SelectedModel | null>(
  'tagent-selected-model',
  null
)

/** 思考块默认展开偏好（持久化到 localStorage） */
export const thinkingExpandedAtom = atomWithStorage<boolean>('tagent-thinking-expanded', false)
