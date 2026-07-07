/**
 * 会话消息头像 — 用户 / Agent 统一尺寸与圆角
 */

import * as React from 'react'

import { SessionAlertIcon, SessionAssistantIcon } from '@/components/agent/session-icons'
import { getModelLogo } from '@/lib/model-logo'
import { cn } from '@/lib/utils'

/** 会话区头像边长（px）— 用户与 Agent 统一 */
export const MESSAGE_AVATAR_SIZE = 32

/**
 * Agent 正文相对会话左缘的缩进（Message px-2.5 + avatar + gap-2.5）
 * 用于运行指示器等与 assistant 正文对齐
 */
export const MESSAGE_AVATAR_CONTENT_INDENT_PX = 52

interface AssistantMessageLogoProps {
  model?: string
  className?: string
}

/** Agent / 模型头像（与 UserAvatar 同尺寸） */
export function AssistantMessageLogo({
  model,
  className,
}: AssistantMessageLogoProps): React.ReactElement {
  if (model) {
    return (
      <img
        src={getModelLogo(model)}
        alt={model}
        className={cn('size-[32px] rounded-[25%] object-cover', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'size-[32px] rounded-[25%] bg-primary/10 flex items-center justify-center',
        className
      )}
    >
      <SessionAssistantIcon className="size-4 text-primary" />
    </div>
  )
}

interface ErrorMessageLogoProps {
  className?: string
}

/** 错误消息头像占位 */
export function ErrorMessageLogo({ className }: ErrorMessageLogoProps): React.ReactElement {
  return (
    <div
      className={cn(
        'size-[32px] rounded-[25%] bg-destructive/10 flex items-center justify-center',
        className
      )}
    >
      <SessionAlertIcon className="size-4 text-destructive" />
    </div>
  )
}
