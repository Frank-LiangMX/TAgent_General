/**
 * MessageAvatar - 消息头像组件
 *
 * 已迁入 @tagent/ui，此文件保留为 re-export 以保持向后兼容。
 * 应用层传入 logoResolver 回调以解析模型 logo。
 */

import {
  AssistantMessageLogo as BaseAssistantMessageLogo,
  ErrorMessageLogo as BaseErrorMessageLogo,
  MESSAGE_AVATAR_SIZE,
  MESSAGE_AVATAR_CONTENT_INDENT_PX,
} from '@tagent/ui'

import { getModelLogo } from '@/lib/model-logo'
import { SessionAlertIcon, SessionAssistantIcon } from '@/components/agent/session-icons'

import type { ComponentProps } from 'react'

// ===== AssistantMessageLogo（包装 logoResolver） =====

export type AssistantMessageLogoProps = ComponentProps<typeof BaseAssistantMessageLogo>

export function AssistantMessageLogo(props: AssistantMessageLogoProps) {
  const handleLogoResolver = (model: string) => getModelLogo(model)

  return (
    <BaseAssistantMessageLogo
      {...props}
      logoResolver={props.logoResolver ?? handleLogoResolver}
      fallbackIcon={props.fallbackIcon ?? <SessionAssistantIcon className="size-4 text-primary" />}
    />
  )
}

// ===== ErrorMessageLogo（包装 errorIcon） =====

export type ErrorMessageLogoProps = ComponentProps<typeof BaseErrorMessageLogo>

export function ErrorMessageLogo(props: ErrorMessageLogoProps) {
  return (
    <BaseErrorMessageLogo
      {...props}
      errorIcon={props.errorIcon ?? <SessionAlertIcon className="size-4 text-destructive" />}
    />
  )
}

export { MESSAGE_AVATAR_SIZE, MESSAGE_AVATAR_CONTENT_INDENT_PX }
