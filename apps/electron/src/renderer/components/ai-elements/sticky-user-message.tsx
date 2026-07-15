/**
 * StickyUserMessage — 用户消息悬浮置顶条
 *
 * 已迁入 @tagent/ui，此文件保留为 re-export + 回调注入。
 * 应用层从 Jotai atom 读取 enabled 状态并传入。
 */

import { useAtomValue } from 'jotai'

import { StickyUserMessage as BaseStickyUserMessage } from '@tagent/ui'

import type { ComponentProps } from 'react'

import { stickyUserMessageEnabledAtom } from '@/atoms/ui-preferences'

export type StickyUserMessageProps = ComponentProps<typeof BaseStickyUserMessage>

export function StickyUserMessage(props: StickyUserMessageProps) {
  const stickyEnabled = useAtomValue(stickyUserMessageEnabledAtom)

  return <BaseStickyUserMessage {...props} enabled={stickyEnabled} />
}
