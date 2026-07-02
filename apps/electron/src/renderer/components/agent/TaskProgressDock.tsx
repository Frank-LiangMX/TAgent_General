/**
 * TaskProgressDock — 输入框上方的任务进度预览条
 *
 * 当会话中有进行中的任务（in_progress）时，在输入框上方显示单行预览。
 * 点击展开查看完整任务列表。所有任务完成（无 in_progress）时自动隐藏。
 *
 * 与会话流里的 TaskProgressCard 互补：
 * - TaskProgressCard 在消息流中，会随消息滚动走
 * - TaskProgressDock 固定在输入框上方，长任务执行时始终可见
 */

import * as React from 'react'
import { ListTodo, ChevronDown, ChevronUp, Loader2, CheckCircle2, Circle } from 'lucide-react'

import { aggregateTaskItems, type TaskItem } from './task-progress'
import { buildAllTaskActivities, buildHistoricalTaskSubjects } from './SDKMessageRenderer'

import type { SDKMessage } from '@tagent/shared'

import { cn } from '@/lib/utils'

export interface TaskProgressDockProps {
  /** 当前会话所有 SDK 消息（用于聚合任务状态） */
  allMessages: SDKMessage[]
  /** 是否正在流式输出 */
  streaming: boolean
}

export function TaskProgressDock({
  allMessages,
  streaming,
}: TaskProgressDockProps): React.ReactElement | null {
  const [expanded, setExpanded] = React.useState(false)

  const activities = React.useMemo(() => buildAllTaskActivities(allMessages), [allMessages])
  const historicalTaskSubjects = React.useMemo(
    () => buildHistoricalTaskSubjects(allMessages),
    [allMessages]
  )
  const items = React.useMemo(
    () => aggregateTaskItems(activities, !streaming, historicalTaskSubjects),
    [activities, streaming, historicalTaskSubjects]
  )

  // 无任务或无进行中任务时不显示
  const hasInProgress = items.some((t) => t.status === 'in_progress')
  if (items.length === 0 || !hasInProgress) return null

  const completedCount = items.filter((t) => t.status === 'completed').length
  const totalCount = items.length
  const currentTask = items.find((t) => t.status === 'in_progress')
  const currentText = currentTask?.activeForm ?? currentTask?.subject ?? ''
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="mx-4 mb-1.5">
      {/* 单行预览按钮 */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'session-glass w-full flex items-center gap-2 px-3 py-1.5 rounded-glass-popover',
          'transition-colors hover:bg-muted/40'
        )}
        aria-expanded={expanded}
      >
        <ListTodo className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground/80 shrink-0">任务进度</span>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {completedCount}/{totalCount}
        </span>
        {/* 迷你进度条 */}
        <div className="h-1 flex-1 min-w-[40px] max-w-[80px] bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        {/* 当前进行中任务 */}
        {currentText && (
          <span className="text-[11px] text-muted-foreground truncate flex-1 min-w-0 flex items-center gap-1">
            <Loader2 className="size-3 animate-spin text-blue-500 shrink-0" />
            <span className="truncate">{currentText}</span>
          </span>
        )}
        {expanded ? (
          <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* 展开态：完整任务列表 */}
      {expanded && (
        <div className="session-glass mt-1 rounded-glass-popover px-3 py-2 animate-in fade-in duration-200">
          {items.map((item) => (
            <DockTaskRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

// ===== 任务行（与 TaskProgressCard 视觉一致，紧凑风格） =====

interface DockTaskRowProps {
  item: TaskItem
}

function DockTaskRow({ item }: DockTaskRowProps): React.ReactElement {
  const isCompleted = item.status === 'completed'
  const isInProgress = item.status === 'in_progress'

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-[13px] py-[3px]',
        'transition-colors duration-200',
        isCompleted && 'opacity-50'
      )}
    >
      <span className="flex items-center justify-center size-2.5 shrink-0">
        {item.status === 'pending' && <Circle className="size-2.5 text-muted-foreground/40" />}
        {isInProgress && <Loader2 className="size-2 animate-spin text-blue-500" />}
        {isCompleted && <CheckCircle2 className="size-2.5 text-green-500" />}
      </span>
      <span
        className={cn(
          'truncate flex-1',
          isCompleted && 'text-muted-foreground line-through',
          isInProgress && 'text-foreground/90',
          !isCompleted && !isInProgress && 'text-muted-foreground'
        )}
      >
        {isInProgress && item.activeForm ? item.activeForm : item.subject}
      </span>
    </div>
  )
}
