/**
 * Reasoning - 推理/思考折叠组件
 *
 * 已迁入 @tagent/ui，此文件保留为 re-export 以保持向后兼容。
 * 应用层传入 onOpenExternal 回调以处理外部链接打开。
 */

import {
  Reasoning as BaseReasoning,
  ReasoningTrigger as BaseReasoningTrigger,
  ReasoningContent as BaseReasoningContent,
} from '@tagent/ui'

import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// ===== Reasoning 根组件（包装 onOpenExternal） =====

export type ReasoningProps = ComponentProps<typeof BaseReasoning>

export const Reasoning = function Reasoning(props: ReasoningProps) {
  const handleOpenExternal = (url: string) => {
    window.electronAPI.openExternal(url)
  }

  return <BaseReasoning {...props} onOpenExternal={handleOpenExternal} />
}

// ===== ReasoningTrigger =====

export const ReasoningTrigger = BaseReasoningTrigger

// ===== ReasoningContent =====

export const ReasoningContent = BaseReasoningContent
