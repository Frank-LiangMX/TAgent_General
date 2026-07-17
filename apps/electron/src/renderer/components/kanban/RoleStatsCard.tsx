/**
 * RoleStatsCard — 数字员工统计面板
 *
 * 显示某个角色的累计工作统计：上岗次数、总工时、均时，
 * 以及今天/本周/本月分段数据（SegmentedTabs 切换）。
 */

import * as React from 'react'

import type { RoleWorkStats } from '@tagent/shared'

import { SegmentedTabs, SegmentedTabsItem } from '@tagent/ui'
import { cn } from '@/lib/utils'

/** 格式化时长：ms → "12s" / "3m 45s" / "1h 12m" / "3h 28m" */
function formatDuration(ms: number): string {
  if (ms < 1000) return '0s'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m${s > 0 ? ` ${s}s` : ''}`
  const h = Math.floor(m / 60)
  const remainingM = m % 60
  return `${h}h${remainingM > 0 ? ` ${remainingM}m` : ''}`
}

/** 进度条（最大 totalMax 下的占比，0–1） */
function MiniBar({
  value,
  total,
  color = 'bg-blue-500',
}: {
  value: number
  total: number
  color?: string
}): React.ReactElement {
  const pct = total > 0 ? Math.min(value / total, 1) : 0
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  )
}

type Period = 'day' | 'week' | 'month'

function PeriodRow({
  label,
  stats,
  color,
}: {
  label: string
  stats: RoleWorkStats['windows'][Period]
  color: string
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] tabular-nums">
          <span className="font-medium text-foreground">{stats.taskCount}</span>
          <span className="text-muted-foreground"> 次 · </span>
          <span className="text-foreground">{formatDuration(stats.totalDurationMs)}</span>
        </span>
      </div>
      <MiniBar value={stats.taskCount} total={Math.max(stats.taskCount, 1)} color={color} />
    </div>
  )
}

export function RoleStatsCard({ stats }: { stats: RoleWorkStats }): React.ReactElement {
  const [period, setPeriod] = React.useState<Period>('week')
  const periodStats = stats.windows[period]
  const periodLabel = period === 'day' ? '今日' : period === 'week' ? '本周' : '本月'

  const maxTasks = React.useMemo(() => {
    return Math.max(
      stats.windows.day.taskCount,
      stats.windows.week.taskCount,
      stats.windows.month.taskCount,
      1
    )
  }, [stats])

  return (
    <div className="space-y-3">
      {/* 顶部数字 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-muted/30 p-2.5 text-center">
          <div className="text-lg font-semibold tabular-nums text-foreground">
            {stats.totalTasks}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">累计上岗</div>
        </div>
        <div className="rounded-xl bg-muted/30 p-2.5 text-center">
          <div className="text-lg font-semibold tabular-nums text-foreground">
            {formatDuration(stats.totalDurationMs)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">累计工时</div>
        </div>
        <div className="rounded-xl bg-muted/30 p-2.5 text-center">
          <div className="text-lg font-semibold tabular-nums text-foreground">
            {formatDuration(stats.avgDurationMs)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">平均工时</div>
        </div>
      </div>

      {/* 分段切换 */}
      <SegmentedTabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <SegmentedTabsItem value="day">今日</SegmentedTabsItem>
        <SegmentedTabsItem value="week">本周</SegmentedTabsItem>
        <SegmentedTabsItem value="month">本月</SegmentedTabsItem>
      </SegmentedTabs>

      {/* 分段数据 */}
      <div className="space-y-2">
        <PeriodRow label={periodLabel} stats={periodStats} color="bg-blue-500" />
        <div className="flex gap-1.5 text-[10px] text-muted-foreground">
          <span>失败 {stats.failedCount} 次</span>
          <span>·</span>
          <span>均 {formatDuration(periodStats.avgDurationMs)} / 次</span>
        </div>
        <MiniBar value={stats.windows.month.taskCount} total={maxTasks} color="bg-violet-500/60" />
        <div className="flex justify-between text-[9px] text-muted-foreground/60">
          <span>今日 {stats.windows.day.taskCount} 次</span>
          <span>本周 {stats.windows.week.taskCount} 次</span>
          <span>本月 {stats.windows.month.taskCount} 次</span>
        </div>
      </div>
    </div>
  )
}
