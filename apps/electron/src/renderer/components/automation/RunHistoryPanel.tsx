/**
 * RunHistoryPanel - 运行历史时间线
 */

import { CheckCircle2, Clock3, ExternalLink, SkipForward, XCircle } from 'lucide-react'
import * as React from 'react'

import type { AutomationRun } from '@tagent/shared'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RunHistoryPanelProps {
  runs: AutomationRun[]
  onOpenSession?: (sessionId: string) => void
}

export function RunHistoryPanel({ runs, onOpenSession }: RunHistoryPanelProps): React.ReactElement {
  const ordered = [...runs].reverse()

  if (ordered.length === 0) {
    return (
      <div className="rounded-xl bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
        暂无运行记录
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {ordered.map((run, index) => (
        <RunHistoryItem key={`${run.runAt}-${index}`} run={run} onOpenSession={onOpenSession} />
      ))}
    </div>
  )
}

function RunHistoryItem({
  run,
  onOpenSession,
}: {
  run: AutomationRun
  onOpenSession?: (sessionId: string) => void
}): React.ReactElement {
  const statusMeta = getStatusMeta(run.status)

  return (
    <div className="flex gap-3 rounded-xl border border-border/40 bg-card/40 px-3 py-2.5 shadow-sm">
      <div className={cn('mt-0.5 shrink-0', statusMeta.className)}>{statusMeta.icon}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">{statusMeta.label}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(run.runAt).toLocaleString('zh-CN')}
          </span>
        </div>
        {run.durationMs != null ? (
          <p className="text-[10px] text-muted-foreground">耗时 {formatDuration(run.durationMs)}</p>
        ) : null}
        {run.error ? <p className="text-[10px] text-destructive">{run.error}</p> : null}
        {run.skipReason ? (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">{run.skipReason}</p>
        ) : null}
        {run.sessionId && onOpenSession ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-blue-500 hover:text-blue-400"
            onClick={() => onOpenSession(run.sessionId)}
          >
            <ExternalLink size={12} className="mr-1" />
            查看会话
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function getStatusMeta(status: AutomationRun['status']): {
  label: string
  icon: React.ReactNode
  className: string
} {
  switch (status) {
    case 'succeeded':
      return {
        label: '成功',
        icon: <CheckCircle2 size={14} />,
        className: 'text-emerald-500',
      }
    case 'failed':
      return {
        label: '失败',
        icon: <XCircle size={14} />,
        className: 'text-red-500 dark:text-red-400',
      }
    case 'skipped':
      return {
        label: '跳过',
        icon: <SkipForward size={14} />,
        className: 'text-amber-500 dark:text-amber-400',
      }
    case 'cancelled':
      return {
        label: '已取消',
        icon: <XCircle size={14} />,
        className: 'text-muted-foreground',
      }
    default:
      return {
        label: '运行中',
        icon: <Clock3 size={14} className="animate-pulse" />,
        className: 'text-blue-500 dark:text-blue-400',
      }
  }
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} 秒`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} 分钟`
  return `${(ms / 3_600_000).toFixed(1)} 小时`
}
