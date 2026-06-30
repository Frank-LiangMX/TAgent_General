/**
 * SettingsSegmentedControl - 分段选择器
 *
 * 用于少量选项的快速切换（如外观主题选择）。
 * 基于 @tagent/ui SegmentedTabs 统一样式。
 */

import * as React from 'react'

import { LABEL_CLASS, DESCRIPTION_CLASS } from './SettingsUIConstants'

import { SegmentedTabs, SegmentedTabsItem } from '@/components/ui/segmented-tabs'
import { cn } from '@/lib/utils'

/** 分段选项定义 */
interface SegmentOption {
  value: string
  label: string
}

interface SettingsSegmentedControlProps {
  /** 标签文本 */
  label: string
  /** 描述文本（可选） */
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
    <div className="px-4 py-3 space-y-2">
      <div>
        <div className={LABEL_CLASS}>{label}</div>
        {description && <div className={cn(DESCRIPTION_CLASS, 'mt-0.5')}>{description}</div>}
      </div>
      <SegmentedTabs className="max-w-md" value={value} onValueChange={onValueChange}>
        {options.map((option) => (
          <SegmentedTabsItem key={option.value} value={option.value} disabled={disabled}>
            {option.label}
          </SegmentedTabsItem>
        ))}
      </SegmentedTabs>
    </div>
  )
}
