/**
 * KanbanTaskListItem — 数字员工卡（跨 MD / glass / soft 三材质）
 *
 * 表面走 session-list-row / session-list-item-active，不写死 border/shadow。
 * 隐喻：工牌上的数字员工（角色 + 工号 + 人态），不是 Jira 小票。
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { Loader2, Square, CheckCircle2, XCircle, Clock } from 'lucide-react'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { KanbanTask } from '@tagent/shared'

import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { KanbanTaskDetailDialog } from './KanbanTaskDetailDialog'
import { taskProgressLogsAtomFamily } from '@/atoms/kanban-atoms'
import { cn } from '@/lib/utils'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import {
  CREW_STATUS_BADGE,
  parseCrewBadge,
  roleAvatarTint,
} from '@/lib/kanban-crew-status'

/** @deprecated 使用 CREW_STATUS_BADGE；保留导出供详情弹窗兼容 */
export const STATUS_BADGE = CREW_STATUS_BADGE

/** 格式化开始时间（timestamp → "今天 14:23" / "昨天 09:00" / "07-05 12:30"） */
function formatStartTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  if (isToday) return `今天 ${timeStr}`
  if (isYesterday) return `昨天 ${timeStr}`
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + timeStr
}

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

export interface KanbanTaskListItemProps {
  task: KanbanTask
  /** 点击卡片是否弹出详情弹窗（默认 true）。
   * SessionTeamTab 等已有右栏详情的视图设为 false，避免弹窗+右栏重复。 */
  showDetailDialog?: boolean
  /**
   * 角色显示标签（含同角色多实例编号，如「通用执行者 01」）
   * 由父组件用 buildKanbanRoleInstanceLabels 基于整板任务计算后传入。
   */
  roleLabel?: string
}

export function KanbanTaskListItem({
  task,
  showDetailDialog = true,
  roleLabel,
}: KanbanTaskListItemProps): React.ReactElement {
  const [detailOpen, setDetailOpen] = React.useState(false)
  const progressLogs = useAtomValue(taskProgressLogsAtomFamily(task.id))
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (task.status !== 'running') return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [task.status])

  const logsEndRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [progressLogs.length])

  const badge = CREW_STATUS_BADGE[task.status]
  const isRunning = task.status === 'running'
  const isDone = task.status === 'done'
  const isFailed = task.status === 'failed'
  const hasLogs = progressLogs.length > 0

  const roleMap = useAgentRoleMap()
  const roleDisplayName = task.roleId ? roleMap.get(task.roleId) : undefined
  const roleTitle = roleLabel ?? roleDisplayName
  const roleInitial = roleDisplayName?.charAt(0) ?? roleTitle?.charAt(0) ?? '?'
  const crewNo = parseCrewBadge(roleLabel)
  const avatarTint = roleAvatarTint(task.roleId)

  const progress = isDone ? 100 : isRunning ? 50 : 0
  const durationMs = computeDuration(task)
  const showDuration = isRunning || isDone || isFailed
  const latestLog = progressLogs.length > 0 ? progressLogs[progressLogs.length - 1] : undefined

  const handleClick = (): void => {
    if (showDetailDialog) setDetailOpen(true)
  }

  const handleAbort = (e: React.MouseEvent): void => {
    e.stopPropagation()
    void window.electronAPI.kanban.abortTask(task.id)
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick()
        }}
        className={cn(
          'group w-full text-left titlebar-no-drag ui-pressable cursor-pointer',
          'session-list-row rounded-glass-popover',
          (isRunning || detailOpen) && 'session-list-item-active'
        )}
      >
        <div className="p-3.5">
          {/* 工牌头：头像 + 角色/工号 + 人态 */}
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="relative shrink-0">
              <div
                className={cn(
                  'size-9 rounded-full flex items-center justify-center font-semibold text-sm',
                  roleTitle ? avatarTint.wrap : 'bg-muted text-muted-foreground'
                )}
              >
                {roleInitial}
              </div>
              {crewNo && (
                <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-background text-[9px] font-mono tabular-nums flex items-center justify-center text-muted-foreground ring-1 ring-border/60">
                  {crewNo}
                </span>
              )}
              {isRunning && (
                <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-amber-500 animate-pulse ring-2 ring-background" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate">
                {roleTitle ?? '未分配角色'}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="truncate">{task.title}</span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn('shrink-0 text-[9px] px-1.5 py-0', badge.className)}
            >
              <span
                className={cn('inline-block size-1.5 rounded-full mr-1 align-middle', badge.dot)}
              />
              {badge.label}
            </Badge>
          </div>

          {/* 忙碌时：一行工作汇报 */}
          {isRunning && (
            <div className="mb-2 flex items-start gap-1.5 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 shrink-0 mt-0.5 animate-spin text-amber-500" />
              <span className="line-clamp-2 break-words">
                {latestLog?.text?.trim() || '正在上岗…'}
              </span>
            </div>
          )}

          {/* 展开进度日志（有多条时） */}
          {(hasLogs || isRunning) && progressLogs.length > 1 && (
            <div
              className={cn(
                'mb-2 rounded-glass-chip overflow-y-auto scrollbar-thin bg-foreground/[0.03]',
                isRunning && 'bg-amber-500/5'
              )}
              style={{ maxHeight: '72px' }}
            >
              <div className="p-2 space-y-1">
                {progressLogs.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[10px] leading-tight">
                    <span className="text-muted-foreground/60 tabular-nums shrink-0">
                      {new Date(entry.ts).toLocaleTimeString('zh-CN', {
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <div className="text-foreground/80 break-words min-w-0">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <span className="m-0">{children}</span>,
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              className="underline text-blue-500"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {children}
                            </a>
                          ),
                          code: ({ children }) => (
                            <code className="text-[9px] px-1 py-0.5 rounded bg-muted font-mono">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => <span className="m-0 block">{children}</span>,
                        }}
                      >
                        {entry.text}
                      </Markdown>
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {isDone && task.resultSummary && (
            <div className="mb-2 rounded-glass-chip bg-emerald-500/5 p-2">
              <div className="flex items-start gap-1.5 text-[10px] leading-tight">
                <CheckCircle2 className="size-3 mt-0.5 shrink-0 text-emerald-500" />
                <span className="text-foreground/80 line-clamp-3 break-words">
                  {task.resultSummary}
                </span>
              </div>
            </div>
          )}
          {isFailed && task.error && (
            <div className="mb-2 rounded-glass-chip bg-red-500/5 p-2">
              <div className="flex items-start gap-1.5 text-[10px] leading-tight">
                <XCircle className="size-3 mt-0.5 shrink-0 text-red-500" />
                <span className="text-red-600/80 dark:text-red-400/80 line-clamp-3 break-words">
                  {task.error}
                </span>
              </div>
            </div>
          )}

          {/* 底栏：进度 + 耗时 + 停止 */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isDone && 'bg-emerald-500',
                    isRunning && 'bg-amber-500',
                    isFailed && 'bg-red-500',
                    !isDone && !isRunning && !isFailed && 'bg-transparent'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            {task.startedAt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0 flex items-center gap-0.5">
                    <Clock className="size-2.5" />
                    {showDuration && durationMs > 0
                      ? formatDuration(durationMs)
                      : formatStartTime(task.startedAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>开始于 {formatStartTime(task.startedAt)}</TooltipContent>
              </Tooltip>
            )}
            {task.modelId && (
              <span
                className="text-[9px] text-muted-foreground font-mono truncate max-w-[64px] shrink-0"
                title={task.modelId}
              >
                {task.modelId}
              </span>
            )}
            {isRunning && (
              <button
                type="button"
                onClick={handleAbort}
                title="停止这位员工"
                className="size-6 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-500 shrink-0"
              >
                <Square className="size-3 fill-current" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showDetailDialog ? (
        <KanbanTaskDetailDialog
          task={task}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          roleLabel={roleTitle}
        />
      ) : null}
    </>
  )
}
