/**
 * KanbanTaskListItem — 看板任务左栏卡片（简化版）
 *
 * 紧凑显示：状态色条 + 标题 + 迷你进度条 + 耗时 + 模型徽章。
 * 点击整张卡片弹出 KanbanTaskDetailDialog 查看完整详情。
 *
 * running 任务的耗时每秒刷新（组件内部 setInterval），done/failed 显示总耗时。
 */

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import type { KanbanTask, KanbanTaskStatus } from '@tagent/shared'

import { Badge } from '@tagent/ui'
import { cn } from '@/lib/utils'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'

import { KanbanTaskDetailDialog } from './KanbanTaskDetailDialog'

/** 格式化耗时（ms → "12s" / "3m 45s" / "1h 12m"） */
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 1) return '0s'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const remainingM = m % 60
  return `${h}h ${remainingM}m`
}

/** 计算任务耗时（running 时用 Date.now()，否则用 startedAt/finishedAt 差值） */
function computeDuration(task: KanbanTask): number {
  if (!task.startedAt) return 0
  const end = task.finishedAt ?? (task.status === 'running' ? Date.now() : 0)
  if (!end) return 0
  return end - task.startedAt
}

/** 状态 → 徽章样式与中文标签 */
export const STATUS_BADGE: Record<KanbanTaskStatus, { label: string; className: string; dot: string }> = {
  pending: {
    label: '待办',
    className: 'bg-muted text-muted-foreground border-transparent',
    dot: 'bg-muted-foreground/50',
  },
  ready: {
    label: '待派工',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
    dot: 'bg-blue-500',
  },
  running: {
    label: '执行中',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
    dot: 'bg-amber-500',
  },
  blocked: {
    label: '阻塞',
    className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
    dot: 'bg-red-500',
  },
  review: {
    label: '待验收',
    className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-transparent',
    dot: 'bg-purple-500',
  },
  done: {
    label: '完成',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
    dot: 'bg-emerald-500',
  },
  failed: {
    label: '失败',
    className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
    dot: 'bg-red-500',
  },
  cancelled: {
    label: '已取消',
    className: 'bg-muted text-muted-foreground border-transparent',
    dot: 'bg-muted-foreground/30',
  },
}

export interface KanbanTaskListItemProps {
  task: KanbanTask
  selected: boolean
  onSelect: (taskId: string) => void
  /** 点击卡片是否弹出详情弹窗（默认 true）。
   * SessionTeamTab 等已有右栏详情的视图设为 false，避免弹窗+右栏重复。 */
  showDetailDialog?: boolean
}

export function KanbanTaskListItem({
  task,
  selected,
  onSelect,
  showDetailDialog = true,
}: KanbanTaskListItemProps): React.ReactElement {
  const [detailOpen, setDetailOpen] = React.useState(false)
  // running 时每秒触发 re-render 让耗时实时刷新
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (task.status !== 'running') return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [task.status])

  const badge = STATUS_BADGE[task.status]
  const isRunning = task.status === 'running'
  const isDone = task.status === 'done'
  const isFailed = task.status === 'failed'

  // 角色映射：roleId → displayName（首次渲染时触发角色列表加载）
  const roleMap = useAgentRoleMap()
  const roleDisplayName = task.roleId ? roleMap.get(task.roleId) : undefined

  // 进度估算：done=100%、running=50%（未细分阶段）、其他=0%
  const progress = isDone ? 100 : isRunning ? 50 : 0
  // 耗时标签：running 中或已完成（done/failed）且有 startedAt 时显示
  const durationMs = computeDuration(task)
  const showDuration = isRunning || isDone || isFailed

  const handleClick = (): void => {
    onSelect(task.id)
    if (showDetailDialog) setDetailOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'session-glass w-full rounded-glass-popover px-2.5 py-2 text-left transition-all',
          'hover:shadow-md hover:bg-background/60',
          selected && 'ring-2 ring-blue-500/50 bg-background/70'
        )}
      >
        {/* 第一行：状态色点 + 标题 + 状态徽章 */}
        <div className="flex items-center gap-1.5">
          <span className={cn('size-1.5 shrink-0 rounded-full', badge.dot)} />
          <span className="flex min-w-0 flex-1 items-center gap-1 text-xs font-medium text-foreground line-clamp-1">
            {isRunning && <Loader2 className="size-3 shrink-0 animate-spin text-amber-500" />}
            {task.title}
          </span>
          <Badge variant="outline" className={cn('shrink-0 text-[9px] px-1 py-0', badge.className)}>
            {badge.label}
          </Badge>
        </div>

        {/* 第二行：迷你进度条 + 耗时 + 模型 */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isDone && 'bg-emerald-500',
                isRunning && 'bg-amber-500',
                isFailed && 'bg-red-500',
                !isDone && !isRunning && !isFailed && 'bg-transparent'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {showDuration && durationMs > 0 && (
            <span
              className={cn(
                'shrink-0 tabular-nums text-[10px]',
                isRunning ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
              )}
              title="耗时"
            >
              {formatDuration(durationMs)}
            </span>
          )}
          {roleDisplayName && (
            <Badge
              variant="outline"
              className="shrink-0 border-purple-500/30 bg-purple-500/10 px-1 py-0 text-[9px] text-purple-600 dark:text-purple-400"
              title={`角色: ${task.roleId}`}
            >
              {roleDisplayName}
            </Badge>
          )}
          {task.modelId && (
            <span
              className="max-w-[90px] shrink-0 truncate text-[10px] text-muted-foreground"
              title={`模型: ${task.modelId}`}
            >
              {task.modelId}
            </span>
          )}
        </div>
      </button>

      {showDetailDialog ? (
        <KanbanTaskDetailDialog task={task} open={detailOpen} onOpenChange={setDetailOpen} />
      ) : null}
    </>
  )
}
