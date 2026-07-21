/**
 * SettingsToggle - 设置开关行
 */

import * as React from 'react'

import { Switch } from '../switch'
import { cn } from '../../lib/utils'
import { FieldLabel } from './FieldLabel'
import { ROW_CLASS } from './SettingsUIConstants'

interface SettingsToggleProps {
  label: string
  description?: string
  icon?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
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
    <div className={cn(ROW_CLASS, 'settings-row--toggle')}>
      <div className="settings-row-main min-w-0 flex-1">
        <FieldLabel label={label} icon={icon} description={description} />
      </div>
      <div className="settings-row-control shrink-0">
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
    </div>
  )
}
