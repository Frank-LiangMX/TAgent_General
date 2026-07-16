/**
 * TaskProgressDock — 输入框上方的任务进度预览条
 *
 * 仅在「当前流式回合」存在进行中任务（in_progress）时显示。
 * 流式结束后立即隐藏；历史回合遗留的未完成任务不会在下次运行时复活。
 *
 * 与会话流里的 TaskProgressCard 互补：
 * - TaskProgressCard 在消息流中，会随消息滚动走
 * - TaskProgressDock 固定在输入框上方，长任务执行时始终可见
 */

import * as React from 'react'
import { ListTodo, ChevronDown, ChevronUp, Loader2, CheckCircle2, Circle } from 'lucide-react'

import type { SDKMessage, SDKUserMessage } from '@tagent/shared'
import { aggregateTaskItems, type TaskItem } from './task-progress'
import {
  buildAllTaskActivities,
  buildHistoricalTaskSubjects,
  extractUserText,
} from './SDKMessageRenderer'

import { cn } from '@/lib/utils'

export interface TaskProgressDockProps {
  /** 当前会话所有 SDK 消息（持久化 + 实时合并后） */
  allMessages: SDKMessage[]
  /** 是否正在流式输出 */
  streaming: boolean
}

/** 截取最近一次真实用户输入之后的消息（当前回合），排除 tool_result / 合成消息 */
export function sliceCurrentTurnMessages(allMessages: SDKMessage[]): SDKMessage[] {
  let lastUserIdx = -1
  for (let i = allMessages.length - 1; i >= 0; i--) {
    const msg = allMessages[i]
    if (!msg || msg.type !== 'user') continue
    const userMsg = msg as SDKUserMessage
    if (userMsg.parent_tool_use_id) continue
    if (userMsg.isSynthetic) continue
    const content = userMsg.message?.content
    if (Array.isArray(content) && content.some((b) => b.type === 'tool_result')) continue
    if (extractUserText(userMsg) === null) continue
    lastUserIdx = i
    break
  }
  if (lastUserIdx < 0) return []
  return allMessages.slice(lastUserIdx)
}

export function TaskProgressDock({
  allMessages,
  streaming,
}: TaskProgressDockProps): React.ReactElement | null {
  const [expanded, setExpanded] = React.useState(false)

  // 流式结束后立即隐藏，避免输入框长期被进度条占用
  const turnMessages = React.useMemo(
    () => (streaming ? sliceCurrentTurnMessages(allMessages) : []),
    [allMessages, streaming]
  )
  const activities = React.useMemo(() => buildAllTaskActivities(turnMessages), [turnMessages])
  const historicalTaskSubjects = React.useMemo(
    () => buildHistoricalTaskSubjects(allMessages),
    [allMessages]
  )
  const items = React.useMemo(
    () => aggregateTaskItems(activities, !streaming, historicalTaskSubjects),
    [activities, streaming, historicalTaskSubjects]
  )

  if (!streaming) return null

  // 当前回合无进行中任务时不显示（历史遗留 in_progress 已被 turn 切片排除）
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
