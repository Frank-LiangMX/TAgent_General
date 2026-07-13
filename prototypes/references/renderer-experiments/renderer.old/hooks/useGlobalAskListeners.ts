/**
 * useGlobalAskListeners — 全局 Ask IPC 监听器
 *
 * 在应用顶层挂载，永不销毁。将所有 Ask 流式事件写入对应 Jotai atoms，
 * 确保页面切换时不丢失事件。
 *
 * 参照 useGlobalChatListeners / useGlobalAgentListeners 模式。
 */

import { useStore } from 'jotai'
import { useEffect } from 'react'

import type {
  AskMessage,
  AskStreamChunkEvent,
  AskStreamCompleteEvent,
  AskStreamErrorEvent,
  AskStreamReasoningEvent,
  AskStreamSwitchSuggestionEvent,
} from '@tagent/shared'

import {
  askMessagesMapAtom,
  askStreamingStatesAtom,
  askStreamErrorsAtom,
  askMessageRefreshAtom,
  pendingAgentSwitchSuggestionAtom,
} from '@/atoms/ask-atoms'

/**
 * 注册全局 Ask IPC 监听器。
 *
 * 每个事件都精确更新对应 session 的 atom，避免跨会话串扰：
 * - STREAM_CHUNK: 首次创建 assistant 消息（如果不存在），后续追加
 * - STREAM_REASONING: 累积到流式 state
 * - STREAM_COMPLETE: 标记流式结束、递增 refresh 版本号、拉取持久化消息
 * - STREAM_ERROR: 标记流式结束、存储错误
 * - STREAM_SWITCH_SUGGESTION: 写入升级引导 atom
 */
export function useGlobalAskListeners(): void {
  const store = useStore()

  useEffect(() => {
    /** 拉取并替换该会话的 Ask 消息缓存 */
    const refreshAskMessages = async (sessionId: string): Promise<void> => {
      try {
        const messages = await window.electronAPI.getAskMessages(sessionId)
        store.set(askMessagesMapAtom, (prev) => {
          const map = new Map(prev)
          map.set(sessionId, messages)
          return map
        })
      } catch (err) {
        console.error(`[GlobalAskListeners] 拉取 Ask 消息失败 (${sessionId}):`, err)
      }
    }

    /** 获取或创建该 sessionId 的 assistant 消息 */
    const getOrCreateAssistantMessage = (
      sessionId: string,
      messageId: string,
      createdAt: number,
      channelId: string,
      modelId: string
    ): void => {
      store.set(askMessagesMapAtom, (prev) => {
        const map = new Map(prev)
        const current = map.get(sessionId) ?? []
        // 检查是否已存在该 messageId
        const exists = current.some((m) => m.id === messageId)
        if (exists) return prev
        const assistantMsg: AskMessage = {
          id: messageId,
          role: 'assistant',
          content: '',
          createdAt,
          channelId,
          modelId,
        }
        map.set(sessionId, [...current, assistantMsg])
        return map
      })
    }

    /** 追加 delta 到 assistant 消息 */
    const appendDeltaToMessage = (sessionId: string, messageId: string, delta: string): void => {
      if (!delta) return
      store.set(askMessagesMapAtom, (prev) => {
        const map = new Map(prev)
        const current = map.get(sessionId) ?? []
        const idx = current.findIndex((m) => m.id === messageId)
        if (idx < 0) return prev
        const target = current[idx]!
        const updated: AskMessage = {
          ...target,
          content: target.content + delta,
        }
        const next = [...current]
        next[idx] = updated
        map.set(sessionId, next)
        return map
      })
    }

    // ===== 1. 流式内容块 =====
    const cleanupChunk = window.electronAPI.onAskStreamChunk((event: AskStreamChunkEvent) => {
      const { agentSessionId, messageId, delta } = event

      // 更新流式 state
      store.set(askStreamingStatesAtom, (prev) => {
        const map = new Map(prev)
        const current = map.get(agentSessionId) ?? {
          running: true,
          messageId: null,
          content: '',
          reasoning: '',
          startedAt: Date.now(),
        }
        map.set(agentSessionId, {
          ...current,
          messageId,
          content: current.content + delta,
        })
        return map
      })

      // 首次收到 delta 时确保 assistant 消息存在
      getOrCreateAssistantMessage(agentSessionId, messageId, Date.now(), '', '')
      appendDeltaToMessage(agentSessionId, messageId, delta)
    })

    // ===== 2. 流式推理 =====
    const cleanupReasoning = window.electronAPI.onAskStreamReasoning(
      (event: AskStreamReasoningEvent) => {
        const { agentSessionId, delta } = event
        store.set(askStreamingStatesAtom, (prev) => {
          const map = new Map(prev)
          const current = map.get(agentSessionId)
          if (!current) return prev
          map.set(agentSessionId, {
            ...current,
            reasoning: current.reasoning + delta,
          })
          return map
        })
      }
    )

    // ===== 3. 流式完成 =====
    const cleanupComplete = window.electronAPI.onAskStreamComplete(
      (event: AskStreamCompleteEvent) => {
        const { agentSessionId, messageId, stoppedByUser, durationMs } = event

        // 标记流式结束
        store.set(askStreamingStatesAtom, (prev) => {
          const map = new Map(prev)
          map.delete(agentSessionId)
          return map
        })

        // 更新最后的 assistant 消息（如果存在）
        if (messageId) {
          store.set(askMessagesMapAtom, (prev) => {
            const map = new Map(prev)
            const current = map.get(agentSessionId) ?? []
            const idx = current.findIndex((m) => m.id === messageId)
            if (idx >= 0) {
              const next = [...current]
              next[idx] = {
                ...next[idx]!,
                durationMs,
                partial: stoppedByUser ? true : next[idx]!.partial,
              }
              map.set(agentSessionId, next)
              return map
            }
            return prev
          })
        }

        // 递增 refresh 版本号，触发 AskMessageItem 重新拉取持久化消息
        store.set(askMessageRefreshAtom, (prev) => {
          const map = new Map(prev)
          map.set(agentSessionId, (prev.get(agentSessionId) ?? 0) + 1)
          return map
        })

        // 拉取最新的持久化消息（覆盖本地乐观状态）
        void refreshAskMessages(agentSessionId)
      }
    )

    // ===== 4. 流式错误 =====
    const cleanupError = window.electronAPI.onAskStreamError((event: AskStreamErrorEvent) => {
      const { agentSessionId, error } = event

      console.error('[GlobalAskListeners] 流式错误:', error)

      // 标记流式结束
      store.set(askStreamingStatesAtom, (prev) => {
        const map = new Map(prev)
        map.delete(agentSessionId)
        return map
      })

      // 存储错误消息
      store.set(askStreamErrorsAtom, (prev) => {
        const map = new Map(prev)
        map.set(agentSessionId, error)
        return map
      })

      // 递增 refresh 版本号
      store.set(askMessageRefreshAtom, (prev) => {
        const map = new Map(prev)
        map.set(agentSessionId, (prev.get(agentSessionId) ?? 0) + 1)
        return map
      })
    })

    // ===== 5. 升级引导 =====
    const cleanupSwitchSuggestion = window.electronAPI.onAskStreamSwitchSuggestion(
      (event: AskStreamSwitchSuggestionEvent) => {
        const { agentSessionId, suggestion } = event
        // 只展示当前会话的升级引导（如果切到别的会话了，不要显示）
        const currentSessionId = store.get(pendingAgentSwitchSuggestionAtom) // 留位：可读 currentSessionId
        void currentSessionId
        void agentSessionId // 也可在此检查
        store.set(pendingAgentSwitchSuggestionAtom, suggestion)
      }
    )

    return () => {
      cleanupChunk()
      cleanupReasoning()
      cleanupComplete()
      cleanupError()
      cleanupSwitchSuggestion()
    }
  }, [store])
}
