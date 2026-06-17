/**
 * Ask 档位 Atoms
 *
 * 与 chat-atoms 平行，但面向 Composer Ask 档位：
 * - Ask 消息列表（agentSessionId → AskMessage[]）
 * - Ask 流式状态（agentSessionId → AskStreamState）
 * - Ask 错误 / 刷新版本号 / 升级引导
 *
 * 不与 chat-atoms 共享（避免 Chat IPC 与 Ask IPC 互相污染）。
 */

import { atom } from 'jotai'

import { currentAgentSessionIdAtom } from './agent-atoms'

import type { AskMessage, AgentSwitchSuggestion } from '@tagent/shared'

/** 全局 Ask 消息缓存 Map — agentSessionId → AskMessage[] */
export const askMessagesMapAtom = atom<Map<string, AskMessage[]>>(new Map())

/** 当前会话的 Ask 消息列表（派生只读） */
export const currentAskMessagesAtom = atom<AskMessage[]>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return []
  return get(askMessagesMapAtom).get(sessionId) ?? []
})

/** Ask 单个会话的流式状态 */
export interface AskStreamState {
  running: boolean
  /** 当前正在累积的 assistant message id（与 STREAM_CHUNK 携带的 messageId 一致） */
  messageId: string | null
  /** 已累积的文本（流式中） */
  content: string
  /** 已累积的推理 */
  reasoning: string
  /** 流式开始时间戳（用于竞态保护 + 耗时计算） */
  startedAt?: number
}

/** 全局 Ask 流式状态 Map — agentSessionId → AskStreamState */
export const askStreamingStatesAtom = atom<Map<string, AskStreamState>>(new Map())

/** 当前会话的 Ask 流式状态（派生只读） */
export const currentAskStreamStateAtom = atom<AskStreamState | null>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return null
  return get(askStreamingStatesAtom).get(sessionId) ?? null
})

/** 当前会话是否正在 Ask 流式（派生只读） */
export const askStreamingAtom = atom<boolean>((get) => {
  return get(currentAskStreamStateAtom)?.running ?? false
})

/** Ask 错误消息 Map — agentSessionId → error string */
export const askStreamErrorsAtom = atom<Map<string, string>>(new Map())

/** 当前会话的 Ask 错误（派生只读） */
export const currentAskErrorAtom = atom<string | null>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return null
  return get(askStreamErrorsAtom).get(sessionId) ?? null
})

/**
 * Ask 消息刷新版本号 Map — agentSessionId → version
 *
 * 监听器在 STREAM_COMPLETE / STREAM_ERROR 时递增，
 * AskMessageItem 订阅此 atom 触发从主进程重新拉取消息列表。
 */
export const askMessageRefreshAtom = atom<Map<string, number>>(new Map())

/** 当前会话的 Ask 消息刷新版本号（派生只读） */
export const currentAskRefreshVersionAtom = atom<number>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return 0
  return get(askMessageRefreshAtom).get(sessionId) ?? 0
})

/** 待处理的 Ask → Agent 升级引导（per-session Map，但通常只展示当前会话） */
export const pendingAgentSwitchSuggestionAtom = atom<AgentSwitchSuggestion | null>(null)
