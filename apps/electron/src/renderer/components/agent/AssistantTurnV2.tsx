/**
 * AssistantTurnV2 — 新版 Assistant Turn 渲染
 *
 * 使用 streaming-message-parser 状态机替代旧的 800 行 if/else。
 */

import * as React from 'react'

import type { SDKMessage, SDKAssistantMessage, AgentEventUsage } from '@tagent/shared'
import { Message, MessageContent, MessageActions, MessageAction } from '@/components/ai-elements/message'
import { AgentStatusBadge } from './AgentMessages'
import { MessagePartRenderer } from './MessagePartRenderer'
import { parseSDKMessagesToParts } from '@/lib/streaming-message-parser'
import { resolveModelDisplayName } from '@/lib/model-logo'
import { channelsAtom } from '@/atoms/model-atoms'
import { useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'

interface AssistantTurnV2Props {
  /** 该 turn 的所有消息（assistant + tool_result + system） */
  messages: SDKMessage[]
  /** 所有消息（用于构建 tool_result 映射） */
  allMessages: SDKMessage[]
  /** 模型 ID */
  modelId?: string
  /** 是否处于流式中 */
  isStreaming?: boolean
  /** 流式文本 */
  streamingText?: string
  /** 流式思考 */
  streamingThinking?: string
  /** 流式开始时间 */
  streamStartedAt?: number
  /** 重试状态 */
  retrying?: { currentAttempt: number; maxAttempts: number; failed?: boolean }
  /** 是否被用户中断 */
  stoppedByUser?: boolean
  /** 是否正在压缩上下文 */
  isContextCompacting?: boolean
  /** Fork */
  onFork?: (upToMessageUuid: string) => void
  /** Rewind */
  onRewind?: (assistantMessageUuid: string) => void
  /** Retry */
  onRetry?: () => void
  /** Retry in new session */
  onRetryInNewSession?: () => void
  /** Compact */
  onCompact?: () => void
}

export function AssistantTurnV2({
  messages,
  allMessages,
  modelId,
  isStreaming,
  streamingText,
  streamingThinking,
  streamStartedAt,
  retrying,
  stoppedByUser,
  isContextCompacting,
  onFork,
  onRewind,
  onRetry,
  onRetryInNewSession,
  onCompact,
}: AssistantTurnV2Props): React.ReactElement {
  // 解析为 MessagePart[]
  const parts = React.useMemo(() => {
    return parseSDKMessagesToParts(allMessages, {
      isStreaming: !!isStreaming,
      streamingText,
      streamingThinking,
      sessionModelId: modelId,
    })
  }, [allMessages, isStreaming, streamingText, streamingThinking, modelId])

  // 提取该 turn 的 assistant messages（用于功能按钮）
  const assistantMsgs = messages.filter(
    (m): m is SDKAssistantMessage => m.type === 'assistant'
  )
  const firstAssistant = assistantMsgs[0]
  const lastAssistant = assistantMsgs[assistantMsgs.length - 1]

  // 模型显示名
  const channels = useAtomValue(channelsAtom)
  const modelName = React.useMemo(() => {
    const channelModelId = firstAssistant?._channelModelId || firstAssistant?.message?.model || modelId
    return resolveModelDisplayName(channelModelId ?? '', channels)
  }, [firstAssistant, modelId, channels])

  // 计算总 usage
  const totalUsage = React.useMemo((): AgentEventUsage | undefined => {
    let inputTokens = 0
    let outputTokens = 0
    let cacheReadTokens = 0
    let cacheCreationTokens = 0
    let hasUsage = false

    for (const msg of assistantMsgs) {
      const usage = msg.message?.usage
      if (usage) {
        hasUsage = true
        inputTokens += usage.input_tokens ?? 0
        outputTokens += usage.output_tokens ?? 0
        cacheReadTokens += usage.cache_read_input_tokens ?? 0
        cacheCreationTokens += usage.cache_creation_input_tokens ?? 0
      }
    }

    if (!hasUsage) return undefined
    return { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens }
  }, [assistantMsgs])

  // 错误信息
  const error = lastAssistant?.error

  return (
    <Message from="assistant">
      {/* 模型名标签 */}
      {modelName && (
        <div className="agent-turn-title">{modelName}</div>
      )}

      <MessageContent>
        {/* 过程区 + 回答区 */}
        <div className="agent-turn flex flex-col gap-3">
          <MessagePartRenderer parts={parts} isStreaming={isStreaming} />
        </div>
      </MessageContent>

      {/* Footer：状态 + 功能按钮 */}
      <div className="agent-turn-footer">
        <div className="agent-turn-footer__meta">
          {error ? (
            <span className="text-xs text-destructive">{error.message}</span>
          ) : isStreaming ? (
            <AgentStatusBadge status="running" startedAt={streamStartedAt} />
          ) : totalUsage ? (
            <AgentStatusBadge status="completed" durationMs={0} usage={totalUsage} />
          ) : null}
          {stoppedByUser && <span className="text-xs text-muted-foreground">已中断</span>}
          {isContextCompacting && <span className="text-xs text-muted-foreground">压缩中…</span>}
        </div>

        <MessageActions>
          {onFork && lastAssistant?.uuid && (
            <MessageAction onClick={() => onFork(lastAssistant.uuid!)} title="Fork">
              Fork
            </MessageAction>
          )}
          {onRewind && lastAssistant?.uuid && (
            <MessageAction onClick={() => onRewind(lastAssistant.uuid!)} title="Rewind">
              Rewind
            </MessageAction>
          )}
          {onRetry && (
            <MessageAction onClick={onRetry} title="Retry">
              Retry
            </MessageAction>
          )}
          {onRetryInNewSession && (
            <MessageAction onClick={onRetryInNewSession} title="New Session">
              New
            </MessageAction>
          )}
          {onCompact && (
            <MessageAction onClick={onCompact} title="Compact">
              Compact
            </MessageAction>
          )}
        </MessageActions>
      </div>
    </Message>
  )
}
