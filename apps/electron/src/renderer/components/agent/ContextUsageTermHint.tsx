import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getContextUsageDescription,
  getContextUsageLabel,
} from '@/lib/context-usage-labels'
import { cn } from '@/lib/utils'

interface ContextUsageTermHintProps {
  /** 词条 lookup key（SDK 英文名或中文明细名） */
  term: string
  /** 展示文案；默认 getContextUsageLabel(term) 或 term 本身 */
  display?: string
  className?: string
  /** 无说明时是否仍渲染为普通文本（默认 true） */
  plainWhenMissing?: boolean
  /** 行内小标签（与默认样式相同，保留以兼容调用方） */
  inline?: boolean
  children?: React.ReactNode
}

/** Context 面板词条：悬停显示 Tooltip，外观与普通文本一致 */
export function ContextUsageTermHint({
  term,
  display,
  className,
  plainWhenMissing = true,
  children,
}: ContextUsageTermHintProps): React.ReactElement {
  const description = getContextUsageDescription(term)
  const text = display ?? getContextUsageLabel(term) ?? term
  const content = children ?? text

  if (!description) {
    return <span className={className}>{plainWhenMissing ? content : null}</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('cursor-help', className)}>{content}</span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[280px] text-xs leading-relaxed">
        {description}
      </TooltipContent>
    </Tooltip>
  )
}
