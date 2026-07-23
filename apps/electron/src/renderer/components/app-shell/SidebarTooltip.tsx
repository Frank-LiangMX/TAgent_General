/**
 * 侧栏统一 Tooltip — 使用 @tagent/ui（session-glass-tooltip 主题材质）
 * 禁止侧栏再用原生 title= 浏览器气泡。
 */

import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { cn } from '@/lib/utils'

export interface SidebarTooltipProps {
  /** 提示文案；空则直接渲染 children */
  label: React.ReactNode
  children: React.ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** 长路径/长标题允许换行 */
  multiline?: boolean
  className?: string
}

export function SidebarTooltip({
  label,
  children,
  side = 'top',
  multiline = false,
  className,
}: SidebarTooltipProps): React.ReactElement {
  if (label == null || label === '') {
    return children
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn(multiline && 'max-w-[280px] break-all', className)}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
