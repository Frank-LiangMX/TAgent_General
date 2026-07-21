/**
 * RoleStatsCard — 角色上岗统计（详情左栏用，尽量克制）
 */

import * as React from 'react'

import type { RoleWorkStats } from '@tagent/shared'

import { SegmentedTabs, SegmentedTabsItem } from '@tagent/ui'

/** 格式化时长：ms → "12s" / "3m 45s" / "1h 12m" */
function formatDuration(ms: number): string {
  if (ms < 1000) return '0s'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remainingM = m % 60
  return remainingM > 0 ? `${h}h ${remainingM}m` : `${h}h`
}

type Period = 'day' | 'week' | 'month'

function StatCell({ value, label }: { value: string | number; label: string }): React.ReactElement {
  return (
    <div className="min-w-0 text-center">
      <div className="truncate text-[13px] font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-foreground/45">{label}</div>
    </div>
  )
}

export function RoleStatsCard({ stats }: { stats: RoleWorkStats }): React.ReactElement {
  const [period, setPeriod] = React.useState<Period>('week')
  const periodStats = stats.windows[period]
  const periodLabel = period === 'day' ? '今日' : period === 'week' ? '本周' : '本月'

  return (
    <div className="space-y-3 rounded-[14px] border border-foreground/[0.06] bg-foreground/[0.03] p-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCell value={stats.totalTasks} label="累计上岗" />
        <StatCell value={formatDuration(stats.totalDurationMs)} label="累计工时" />
        <StatCell value={formatDuration(stats.avgDurationMs)} label="平均工时" />
      </div>

      <SegmentedTabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <SegmentedTabsItem value="day">今日</SegmentedTabsItem>
        <SegmentedTabsItem value="week">本周</SegmentedTabsItem>
        <SegmentedTabsItem value="month">本月</SegmentedTabsItem>
      </SegmentedTabs>

      <p className="text-[11px] leading-relaxed text-foreground/60">
        <span className="text-foreground/45">{periodLabel}</span>
        <span className="mx-1.5 text-foreground/25">·</span>
        <span className="tabular-nums text-foreground/85">{periodStats.taskCount}</span> 次
        <span className="mx-1.5 text-foreground/25">·</span>
        <span className="tabular-nums text-foreground/85">
          {formatDuration(periodStats.totalDurationMs)}
        </span>
        {stats.failedCount > 0 ? (
          <>
            <span className="mx-1.5 text-foreground/25">·</span>
            <span className="text-red-600/80 dark:text-red-400/80">失败 {stats.failedCount}</span>
          </>
        ) : null}
      </p>
    </div>
  )
}
