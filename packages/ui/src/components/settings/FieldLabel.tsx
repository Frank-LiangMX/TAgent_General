/**
 * FieldLabel - 设置项标签 + 可选 tooltip 说明
 *
 * 替代"label + 行内 description"的旧模式：
 * - 默认只显示 label（text-sm font-medium）
 * - 传 description 时，label 右侧出现 ? 图标，hover 显示 tooltip
 * - 一屏只剩 label + 控件，description 不再淹没用户
 */

import * as React from 'react'
import { Info } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip'
import { cn } from '../../lib/utils'
import { LABEL_CLASS } from './SettingsUIConstants'

interface FieldLabelProps {
  /** 标签文本 */
  label: React.ReactNode
  /** 描述文本（可选，传则显示 ? 图标 hover tooltip） */
  description?: string
  /** label 左侧图标（可选） */
  icon?: React.ReactNode
}

export function FieldLabel({ label, description, icon }: FieldLabelProps): React.ReactElement {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {icon && <div className="flex-shrink-0 text-muted-foreground">{icon}</div>}
      <span className={LABEL_CLASS}>{label}</span>
      {description && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex-shrink-0 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px]">
            <p className="text-xs leading-relaxed">{description}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
