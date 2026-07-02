/**
 * SettingsToggle - 设置开关控件
 *
 * 封装 ShadcnUI Switch，集成标签和描述。
 * 用于布尔值设置项。
 *
 * description 默认隐藏到 ? 图标 tooltip，避免满屏文字。
 */

import * as React from 'react'

import { Switch } from '../switch'
import { cn } from '../../lib/utils'
import { FieldLabel } from './FieldLabel'
import { ROW_CLASS } from './SettingsUIConstants'


interface SettingsToggleProps {
  /** 标签文本 */
  label: string
  /** 描述文本（可选，hover ? 图标显示 tooltip） */
  description?: string
  /** 标签左侧图标（可选） */
  icon?: React.ReactNode
  /** 是否选中 */
  checked: boolean
  /** 变更回调 */
  onCheckedChange: (checked: boolean) => void
  /** 是否禁用 */
  disabled?: boolean
}

export function SettingsToggle({
  label,
  description,
  icon,
  checked,
  onCheckedChange,
  disabled,
}: SettingsToggleProps): React.ReactElement {
  return (
    <div className={cn(ROW_CLASS)}>
      <div className="flex-1 min-w-0 mr-4">
        <FieldLabel label={label} icon={icon} description={description} />
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}
