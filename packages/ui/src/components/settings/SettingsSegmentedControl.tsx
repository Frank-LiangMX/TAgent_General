/**
 * SettingsSegmentedControl - 分段选择器
 *
 * 用于少量选项的快速切换（如外观主题选择）。
 * 基于 SegmentedTabs 统一样式。
 *
 * 左右结构：左侧 label + ? tooltip，右侧分段控件。
 */

import * as React from 'react'

import { SegmentedTabs, SegmentedTabsItem } from '../segmented-tabs'
import { cn } from '../../lib/utils'
import { FieldLabel } from './FieldLabel'
import { ROW_CLASS } from './SettingsUIConstants'

/** 分段选项定义 */
interface SegmentOption {
  value: string
  label: string
}

interface SettingsSegmentedControlProps {
  /** 标签文本 */
  label: string
  /** 描述文本（可选，hover ? 图标显示 tooltip） */
  description?: string
  /** 当前值 */
  value: string
  /** 变更回调 */
  onValueChange: (value: string) => void
  /** 选项列表 */
  options: SegmentOption[]
  /** 是否禁用 */
  disabled?: boolean
}

export function SettingsSegmentedControl({
  label,
  description,
  value,
  onValueChange,
  options,
  disabled,
}: SettingsSegmentedControlProps): React.ReactElement {
  return (
    <div className={cn(ROW_CLASS)}>
      <div className="flex-1 min-w-0 mr-4">
        <FieldLabel label={label} description={description} />
      </div>
      <SegmentedTabs className="shrink-0" value={value} onValueChange={onValueChange}>
        {options.map((option) => (
          <SegmentedTabsItem key={option.value} value={option.value} disabled={disabled}>
            {option.label}
          </SegmentedTabsItem>
        ))}
      </SegmentedTabs>
    </div>
  )
}
