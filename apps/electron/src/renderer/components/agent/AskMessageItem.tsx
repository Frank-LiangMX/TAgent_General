/**
 * AskMessageItem — Composer Ask 档位的单条消息气泡
 *
 * 与 ChatMessageItem / SDKMessageRenderer 平行：
 * - 用户消息：右侧气泡 + 用户头像
 * - 助手消息：左侧气泡 + 模型 logo，带蓝色细左边色条标识 Ask 档位
 *
 * 比 Agent 工具块更轻（无 ProcessBlock，无工具活动，无 Reasoning 元数据展示）。
 */

import { useAtomValue } from 'jotai'
import { Bot } from 'lucide-react'
import * as React from 'react'

import type { AskMessage } from '@tagent/shared'

import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { askStreamErrorsAtom } from '@/atoms/ask-atoms'
import { userProfileAtom } from '@/atoms/user-profile'
import { Message, MessageContent, MessageHeader } from '@/components/ai-elements/message'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface AskMessageItemProps {
  message: AskMessage
  /** 当前消息是否正在流式（最后一个 assistant 消息 + 流式未结束） */
  isStreaming?: boolean
  sessionId?: string
}

/** Ask 助手气泡左侧蓝色色条（视觉区分 Ask 与 Agent 工具块） */
function AskKindBadge(): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5">
      <div className="size-1.5 rounded-full bg-blue-500/80" aria-hidden />
      <span className="text-[10px] font-medium uppercase tracking-wider text-blue-500/80">Ask</span>
    </div>
  )
}

function AssistantLogo({ model }: { model?: string }): React.ReactElement {
  if (model) {
    return (
      <div className="size-[35px] rounded-[25%] bg-blue-500/10 flex items-center justify-center">
        <Bot size={18} className="text-blue-500" />
      </div>
    )
  }
  return (
    <div className="size-[35px] rounded-[25%] bg-blue-500/10 flex items-center justify-center">
      <Bot size={18} className="text-blue-500" />
    </div>
  )
}

/** 简单 Markdown-lite 渲染（不引入完整 MD 解析器） */
function PlainContent({ text }: { text: string }): React.ReactElement {
  return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</div>
}

export const AskMessageItem = React.memo(function AskMessageItem({
  message,
  isStreaming = false,
  sessionId,
}: AskMessageItemProps): React.ReactElement {
  const userProfile = useAtomValue(userProfileAtom)
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const errorsMap = useAtomValue(askStreamErrorsAtom)
  const effectiveSessionId = sessionId ?? currentSessionId
  const error = effectiveSessionId ? errorsMap.get(effectiveSessionId) : undefined

  if (message.role === 'user') {
    return (
      <div className="flex justify-end my-3">
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="flex flex-col items-end gap-1">
            <div className="rounded-2xl rounded-tr-md bg-primary/10 px-4 py-2.5 text-foreground">
              {message.attachments && message.attachments.length > 0 && (
                <div className="text-xs text-muted-foreground mb-1">
                  📎 {message.attachments.length} 个附件
                </div>
              )}
              <PlainContent text={message.content} />
            </div>
          </div>
          {userProfile.avatar ? (
            <img
              src={userProfile.avatar}
              alt="user"
              className="size-7 rounded-full mt-1 object-cover shrink-0"
            />
          ) : (
            <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center mt-1 text-xs font-medium shrink-0">
              {userProfile.userName?.slice(0, 1) ?? '我'}
            </div>
          )}
        </div>
      </div>
    )
  }

  // assistant message
  return (
    <div className="my-3">
      <Message from="assistant">
        <MessageHeader
          model={message.modelId}
          time={new Date(message.createdAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          logo={<AssistantLogo model={message.modelId} />}
        />
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

          {/* 中止 / 错误标记 */}
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

          {/* 流式错误（非 partial 但有 error 字段） */}
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
