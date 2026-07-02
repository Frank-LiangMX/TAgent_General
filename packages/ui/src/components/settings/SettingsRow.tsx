/**
 * SettingsRow - 设置行布局
 *
 * 左侧显示标签，右侧显示操作控件。
 * 通常用于 SettingsCard 内部。
 *
 * description 默认隐藏到 ? 图标 tooltip，避免满屏文字。
 */

import * as React from 'react'

import { cn } from '../../lib/utils'
import { FieldLabel } from './FieldLabel'
import { ROW_CLASS } from './SettingsUIConstants'

interface SettingsRowProps {
  /** 行标签 */
  label: string
  /** 标签左侧图标（可选） */
  icon?: React.ReactNode
  /** 行描述（可选，hover ? 图标显示 tooltip） */
  description?: string
  /** 右侧控件 */
  children?: React.ReactNode
  /** description 下方的额外内容（如测速 badge 列） */
  bottomSlot?: React.ReactNode
  /** 额外 className */
  className?: string
}

export function SettingsRow({
  label,
  icon,
  description,
  children,
  bottomSlot,
  className,
}: SettingsRowProps): React.ReactElement {
  return (
    <div className={cn(ROW_CLASS, className)}>
      <div className="flex-1 min-w-0 mr-4">
        <FieldLabel label={label} icon={icon} description={description} />
        {bottomSlot && <div className="flex flex-wrap gap-1 mt-1">{bottomSlot}</div>}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  )
}
