/**
 * Btw (By The Way) atoms - 侧面提问状态管理
 *
 * `/btw` 功能：在主对话中快速发起一个不进历史的临时提问。
 * 特点：
 * - 不写入主会话历史
 * - 无工具访问（纯文本对话）
 * - 覆盖层显示
 * - 可并行执行
 */

import { atom } from 'jotai'

import type { BtwMessage } from '@tagent/shared'

/** 侧面提问是否打开 */
export const btwOpenAtom = atom(false)

/** 当前侧面提问会话 ID（临时生成） */
export const btwSessionIdAtom = atom<string | null>(null)

/** 侧面提问消息列表 */
export const btwMessagesAtom = atom<BtwMessage[]>([])

/** 侧面提问是否正在流式输出 */
export const btwStreamingAtom = atom(false)

/** 侧面提问错误信息 */
export const btwErrorAtom = atom<string | null>(null)

/** 侧面提问使用的渠道和模型（复用主会话配置） */
export const btwChannelIdAtom = atom<string | null>(null)
export const btwModelIdAtom = atom<string | null>(null)

/** 父会话 ID（用于上下文共享 + fork 时引用） */
export const btwSourceSessionIdAtom = atom<string | null>(null)