/**
 * ScheduleEditor - 调度类型与参数编辑
 */

import * as React from 'react'

import type { AutomationScheduleType } from '@tagent/shared'

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tagent/ui'
import { cn } from '@/lib/utils'

export interface ScheduleEditorValue {
  scheduleType: AutomationScheduleType
  intervalMinutes: number
  timeOfDay?: string
  dayOfWeek?: number
  dayOfMonth?: number
  scheduledAt?: number
}

interface ScheduleEditorProps {
  value: ScheduleEditorValue
  onChange: (value: ScheduleEditorValue) => void
  disabled?: boolean
}

const SCHEDULE_TYPES: Array<{ value: AutomationScheduleType; label: string; desc: string }> = [
  { value: 'interval', label: '间隔', desc: '按固定分钟数重复' },
  { value: 'daily', label: '每天', desc: '每天固定时刻' },
  { value: 'weekly', label: '每周', desc: '每周固定日时刻' },
  { value: 'monthly', label: '每月', desc: '每月固定日时刻' },
  { value: 'once', label: '一次', desc: '仅运行一次' },
]

const INTERVAL_PRESETS = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 120, label: '2 小时' },
  { value: 360, label: '6 小时' },
  { value: 1440, label: '1 天' },
]

const WEEKDAY_OPTIONS = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const CONTROL_CLASS = 'h-8 border-foreground/[0.08] bg-foreground/[0.04] text-xs shadow-none'

export function ScheduleEditor({
  value,
  onChange,
  disabled,
}: ScheduleEditorProps): React.ReactElement {
  const patch = (partial: Partial<ScheduleEditorValue>): void => {
    onChange({ ...value, ...partial })
  }

  const timeParts = React.useMemo(() => {
    const raw = value.timeOfDay ?? '09:00'
    const [h = '09', m = '00'] = raw.split(':')
    return {
      hour: HOURS.includes(h) ? h : '09',
      minute: MINUTES.includes(m) ? m : '00',
    }
  }, [value.timeOfDay])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {SCHEDULE_TYPES.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={disabled}
            onClick={() => patch({ scheduleType: item.value })}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs transition-colors titlebar-no-drag',
              value.scheduleType === item.value
                ? 'bg-primary/15 text-foreground font-medium'
                : 'text-foreground/60 hover:bg-muted/60 hover:text-foreground'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {value.scheduleType === 'interval' ? (
        <div className="space-y-2">
          <Label className="text-xs text-foreground/80">运行间隔</Label>
          <Select
            value={String(value.intervalMinutes)}
            onValueChange={(v) => patch({ intervalMinutes: Number(v) })}
            disabled={disabled}
          >
            <SelectTrigger className={CONTROL_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={String(preset.value)} className="text-xs">
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {value.scheduleType === 'daily' ||
      value.scheduleType === 'weekly' ||
      value.scheduleType === 'monthly' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {value.scheduleType === 'weekly' ? (
            <div className="space-y-2">
              <Label className="text-xs text-foreground/80">星期</Label>
              <Select
                value={String(value.dayOfWeek ?? 1)}
                onValueChange={(v) => patch({ dayOfWeek: Number(v) })}
                disabled={disabled}
              >
                <SelectTrigger className={CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_OPTIONS.map((day) => (
                    <SelectItem key={day.value} value={String(day.value)} className="text-xs">
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {value.scheduleType === 'monthly' ? (
            <div className="space-y-2">
              <Label className="text-xs text-foreground/80">日期（1-31）</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={value.dayOfMonth ?? 1}
                disabled={disabled}
                className={CONTROL_CLASS}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, '')
                  const n = Number(digits)
                  const clamped = Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : 1
                  patch({ dayOfMonth: clamped })
                }}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-xs text-foreground/80">时刻</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={timeParts.hour}
                onValueChange={(hour) => patch({ timeOfDay: `${hour}:${timeParts.minute}` })}
                disabled={disabled}
              >
                <SelectTrigger className={CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((hour) => (
                    <SelectItem key={hour} value={hour} className="text-xs">
                      {hour} 时
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={timeParts.minute}
                onValueChange={(minute) => patch({ timeOfDay: `${timeParts.hour}:${minute}` })}
                disabled={disabled}
              >
                <SelectTrigger className={CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTES.map((minute) => (
                    <SelectItem key={minute} value={minute} className="text-xs">
                      {minute} 分
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      {value.scheduleType === 'once' ? (
        <div className="space-y-2">
          <Label className="text-xs text-foreground/80">触发时间</Label>
          <Input
            type="datetime-local"
            disabled={disabled}
            className={CONTROL_CLASS}
            value={toDatetimeLocalValue(value.scheduledAt)}
            onChange={(e) => {
              const ts = e.target.value ? new Date(e.target.value).getTime() : undefined
              patch({ scheduledAt: ts })
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function toDatetimeLocalValue(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
