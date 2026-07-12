/**
 * AskMessageItem — Composer Ask 档位的单条消息气泡
 *
 * - 用户消息：右对齐气泡（无头像，与 Agent 通栏一致）
 * - 助手消息：通栏 + Ask 标识，无左侧模型头像栏
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import type { AskMessage } from '@tagent/shared'

import { Spinner } from '@tagent/ui'
import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { askStreamErrorsAtom } from '@/atoms/ask-atoms'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { cn } from '@/lib/utils'

interface AskMessageItemProps {
  message: AskMessage
  /** 当前消息是否正在流式（最后一个 assistant 消息 + 流式未结束） */
  isStreaming?: boolean
  sessionId?: string
}

/** Ask 标识（视觉区分 Ask 与 Agent） */
function AskKindBadge(): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5">
      <div className="size-1.5 rounded-full bg-blue-500/80" aria-hidden />
      <span className="text-[10px] font-medium uppercase tracking-wider text-blue-500/80">Ask</span>
    </div>
  )
}

function PlainContent({ text }: { text: string }): React.ReactElement {
  return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</div>
}

export const AskMessageItem = React.memo(function AskMessageItem({
  message,
  isStreaming = false,
  sessionId,
}: AskMessageItemProps): React.ReactElement {
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const errorsMap = useAtomValue(askStreamErrorsAtom)
  const effectiveSessionId = sessionId ?? currentSessionId
  const error = effectiveSessionId ? errorsMap.get(effectiveSessionId) : undefined

  if (message.role === 'user') {
    return (
      <div className="flex justify-end my-3">
        <div className="agent-user-bubble max-w-[80%] px-4 py-2.5 text-foreground">
          {message.attachments && message.attachments.length > 0 && (
            <div className="text-xs text-muted-foreground mb-1">
              📎 {message.attachments.length} 个附件
            </div>
          )}
          <PlainContent text={message.content} />
        </div>
      </div>
    )
  }

  // assistant message
  return (
    <div className="my-3">
      <Message from="assistant">
        <div className="mb-1">
          <AskKindBadge />
        </div>
        <MessageContent>
          {message.content ? (
            <>
              <PlainContent text={message.content} />
              {isStreaming && (
                <span className="inline-flex items-center gap-1 ml-1 text-blue-500/70">
                  <Spinner size="sm" className="size-3" />
                </span>
              )}
            </>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size="sm" className="text-blue-500" />
              <span>思考中...</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">（空响应）</div>
          )}

          {message.partial && (
            <div
              className={cn(
                'mt-2 text-xs px-2 py-1 rounded-md inline-block',
                message.error
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              )}
            >
              {message.error ? `出错：${message.error}` : '已被用户中止'}
            </div>
          )}

          {!message.partial && error && effectiveSessionId && (
            <div className="mt-2 text-xs px-2 py-1 rounded-md inline-block bg-destructive/10 text-destructive">
              {error}
            </div>
          )}
        </MessageContent>
      </Message>
    </div>
  )
})
