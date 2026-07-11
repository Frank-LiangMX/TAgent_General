/**
 * 消息组件 - 应用层适配
 *
 * 已迁入 @tagent/ui，此文件保留为 re-export + 回调注入以保持向后兼容。
 * 应用层传入 Electron API 回调。
 */

import {
  Message,
  MessageHeader,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageResponse as BaseMessageResponse,
  UserMessageContent as BaseUserMessageContent,
  MessageAttachments as BaseMessageAttachments,
  MessageLoading,
  MessageStopped,
  StreamingIndicator,
  BasePathsProvider,
  remarkMentions,
  remarkPreserveBreaks,
  type RemarkPluginFn,
} from '@tagent/ui'

import type { ComponentProps } from 'react'

// ===== MessageResponse（注入 onOpenExternal） =====

interface MessageResponseProps extends ComponentProps<typeof BaseMessageResponse> {}

export const MessageResponse = function MessageResponse(props: MessageResponseProps) {
  const handleOpenExternal = (url: string) => {
    window.electronAPI.openExternal(url)
  }

  return <BaseMessageResponse {...props} onOpenExternal={handleOpenExternal} />
}

// ===== UserMessageContent（注入 onOpenExternal） =====

interface UserMessageContentProps extends ComponentProps<typeof BaseUserMessageContent> {}

export const UserMessageContent = function UserMessageContent(props: UserMessageContentProps) {
  const handleOpenExternal = (url: string) => {
    window.electronAPI.openExternal(url)
  }

  return <BaseUserMessageContent {...props} />
}

// ===== MessageAttachments（注入 Electron API 回调） =====

interface MessageAttachmentsProps extends ComponentProps<typeof BaseMessageAttachments> {}

export const MessageAttachments = function MessageAttachments(props: MessageAttachmentsProps) {
  const handleReadAttachment = async (localPath: string): Promise<string> => {
    return window.electronAPI.readAttachment(localPath)
  }

  const handleSaveImage = (localPath: string, filename: string) => {
    window.electronAPI.saveImageAs(localPath, filename)
  }

  return (
    <BaseMessageAttachments
      {...props}
      onReadAttachment={handleReadAttachment}
      onSaveImage={handleSaveImage}
    />
  )
}

// ===== 重新导出其他纯 UI 组件 =====

export {
  Message,
  MessageHeader,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageLoading,
  MessageStopped,
  StreamingIndicator,
  BasePathsProvider,
  remarkMentions,
  remarkPreserveBreaks,
}

export type {
  MessageResponseProps,
  UserMessageContentProps,
  MessageAttachmentsProps,
  RemarkPluginFn,
}

/** 重新导出类型 */
export type { FileAttachment } from '@tagent/shared'
