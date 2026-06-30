/**
 * KanbanTaskListItem — 看板任务左栏卡片
 *
 * 显示任务标题、状态徽章、modelId/role、一行 summary。
 * 点击选中后高亮，由父组件 SessionTeamTab 控制选中态。
 */

import * as React from 'react'

import type { KanbanTask, KanbanTaskStatus } from '@tagent/shared'

import { Badge } from '@tagent/ui'
import { cn } from '@/lib/utils'

/** 状态 → 徽章样式与中文标签 */
const STATUS_BADGE: Record<KanbanTaskStatus, { label: string; className: string }> = {
  pending: { label: '待办', className: 'bg-muted text-muted-foreground border-transparent' },
  ready: { label: '可领取', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent' },
  running: { label: '执行中', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent' },
  blocked: { label: '阻塞', className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent' },
  review: { label: '待验收', className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-transparent' },
  done: { label: '完成', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent' },
  failed: { label: '失败', className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent' },
  cancelled: { label: '已取消', className: 'bg-muted text-muted-foreground border-transparent' },
}

export interface KanbanTaskListItemProps {
  task: KanbanTask
  selected: boolean
  onSelect: (taskId: string) => void
}

export function KanbanTaskListItem({
  task,
  selected,
  onSelect,
}: KanbanTaskListItemProps): React.ReactElement {
  const badge = STATUS_BADGE[task.status]
  const summary = task.resultSummary ?? task.blockedReason ?? task.error

  return (
    <button
      type="button"
      onClick={() => onSelect(task.id)}
      className={cn(
        'session-glass w-full rounded-glass-popover px-3 py-2.5 text-left transition-all',
        'hover:shadow-md hover:bg-background/60',
        selected && 'ring-2 ring-blue-500/50 bg-background/70'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground line-clamp-2 flex-1">
          {task.title}
        </span>
        <Badge variant="outline" className={cn('shrink-0 text-[10px] px-1.5 py-0', badge.className)}>
          {badge.label}
        </Badge>
      </div>
      {summary && (
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{summary}</p>
      )}
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        {task.modelId && <span className="truncate">{task.modelId}</span>}
        {task.roleId && <span className="truncate">· {task.roleId}</span>}
        <span className="ml-auto truncate">{task.id}</span>
      </div>
    </button>
  )
}
