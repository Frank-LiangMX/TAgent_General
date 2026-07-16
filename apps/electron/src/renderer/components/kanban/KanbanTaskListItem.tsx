/**
 * KanbanTaskListItem — 看板任务卡片（带实时进度日志滚动区域）
 *
 * running 任务展示实时进度日志（TASK_PROGRESS IPC 推送）；
 * done/failed 展示结果摘要或错误信息。
 * 角色标识突出 + 模型 + 开始时间 + 进度条。
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { Loader2, Square, CheckCircle2, XCircle, Clock } from 'lucide-react'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { KanbanTask, KanbanTaskStatus } from '@tagent/shared'

import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { KanbanTaskDetailDialog } from './KanbanTaskDetailDialog'
import { taskProgressLogsAtomFamily } from '@/atoms/kanban-atoms'
import { cn } from '@/lib/utils'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'

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

/** 状态 → 徽章样式与中文标签 */
export const STATUS_BADGE: Record<
  KanbanTaskStatus,
  { label: string; className: string; dot: string }
> = {
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
  /** 点击卡片是否弹出详情弹窗（默认 true）。
   * SessionTeamTab 等已有右栏详情的视图设为 false，避免弹窗+右栏重复。 */
  showDetailDialog?: boolean
}

export function KanbanTaskListItem({
  task,
  showDetailDialog = true,
}: KanbanTaskListItemProps): React.ReactElement {
  const [detailOpen, setDetailOpen] = React.useState(false)
  // 订阅实时进度日志
  const progressLogs = useAtomValue(taskProgressLogsAtomFamily(task.id))
  // running 时每秒触发 re-render 让耗时实时刷新
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (task.status !== 'running') return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [task.status])

  // 新日志到达时自动滚动到底部
  const logsEndRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [progressLogs.length])

  const badge = STATUS_BADGE[task.status]
  const isRunning = task.status === 'running'
  const isDone = task.status === 'done'
  const isFailed = task.status === 'failed'
  const hasLogs = progressLogs.length > 0

  // 角色映射：roleId → displayName（首次渲染时触发角色列表加载）
  const roleMap = useAgentRoleMap()
  const roleDisplayName = task.roleId ? roleMap.get(task.roleId) : undefined

  // 进度估算：done=100%、running=50%（未细分阶段）、其他=0%
  const progress = isDone ? 100 : isRunning ? 50 : 0
  // 耗时标签：running 中或已完成（done/failed）且有 startedAt 时显示
  const durationMs = computeDuration(task)
  const showDuration = isRunning || isDone || isFailed

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
          'group w-full text-left titlebar-no-drag rounded-xl transition-all cursor-pointer',
          'bg-card hover:bg-muted/40 border border-border/60 hover:border-border shadow-sm hover:shadow-md'
        )}
      >
        <div className="p-4">
          {/* 第一行：角色头像 + 名称 + 模型 */}
          <div className="flex items-center gap-2 mb-2">
            {roleDisplayName ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="size-7 shrink-0 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    {roleDisplayName.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {roleDisplayName}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    {task.modelId && (
                      <span className="font-mono truncate max-w-[80px]" title={task.modelId}>
                        {task.modelId}
                      </span>
                    )}
                    {!task.modelId && task.roleId && (
                      <span className="font-mono truncate max-w-[80px]" title={task.roleId}>
                        {task.roleId.slice(0, 12)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 flex-1">
                <div className="size-7 rounded-lg bg-muted border border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <span className="text-xs">?</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs truncate">未分配角色</div>
                  {task.modelId && (
                    <div
                      className="text-[9px] text-muted-foreground font-mono truncate max-w-[80px]"
                      title={task.modelId}
                    >
                      {task.modelId}
                    </div>
                  )}
                </div>
              </div>
            )}
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

          {/* 第二行：任务标题（一行） */}
          <div className="flex items-center gap-1 mb-2">
            {isRunning && <Loader2 className="size-3 shrink-0 animate-spin text-amber-500" />}
            <span className="text-[11px] text-foreground line-clamp-1 flex-1">{task.title}</span>
          </div>

          {/* 第三行：开始时间 */}
          {task.startedAt && (
            <div className="mb-2 text-[9px] text-muted-foreground tabular-nums">
              <Clock className="inline-block size-3 mr-1 align-middle" />
              {formatStartTime(task.startedAt)}
            </div>
          )}

          {/* ── 第五行（条件显示）：进度日志滚动区域 ── */}
          {(isRunning || hasLogs) && (
            <div
              className={cn(
                'mb-2 rounded-lg border overflow-y-auto scrollbar-thin',
                isRunning
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : isFailed
                    ? 'border-red-500/20 bg-red-500/5'
                    : isDone
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-border/40 bg-muted/20'
              )}
              style={{ maxHeight: '96px', minHeight: progressLogs.length > 0 ? '48px' : '32px' }}
            >
              {progressLogs.length > 0 ? (
                <div className="p-2 space-y-1">
                  {progressLogs.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[10px] leading-tight">
                      {isRunning && idx === progressLogs.length - 1 ? (
                        <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
                      ) : (
                        <span
                          className={cn(
                            'mt-0.5 size-1.5 shrink-0 rounded-full',
                            isDone
                              ? 'bg-emerald-500'
                              : isFailed
                                ? 'bg-red-500'
                                : 'bg-muted-foreground/40'
                          )}
                        />
                      )}
                      <span className="text-muted-foreground/60 tabular-nums shrink-0">
                        {new Date(entry.ts).toLocaleTimeString('zh-CN', {
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      <div className="text-foreground/80 break-words min-w-0 prose-sm">
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
              ) : isRunning ? (
                <div className="flex items-center gap-2 p-2 text-[10px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin shrink-0" />
                  <span>等待进度...</span>
                </div>
              ) : null}
            </div>
          )}

          {/* 结果摘要 / 错误信息（done/failed 时显示） */}
          {isDone && task.resultSummary && (
            <div className="mb-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
              <div className="flex items-start gap-1.5 text-[10px] leading-tight">
                <CheckCircle2 className="size-3 mt-0.5 shrink-0 text-emerald-500" />
                <span className="text-foreground/80 line-clamp-3 break-words">
                  {task.resultSummary}
                </span>
              </div>
            </div>
          )}
          {isFailed && task.error && (
            <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2">
              <div className="flex items-start gap-1.5 text-[10px] leading-tight">
                <XCircle className="size-3 mt-0.5 shrink-0 text-red-500" />
                <span className="text-red-600/80 dark:text-red-400/80 line-clamp-3 break-words">
                  {task.error}
                </span>
              </div>
            </div>
          )}

          {/* 第六行：迷你进度条 + 耗时 + 停止 */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted/60">
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
            {showDuration && durationMs > 0 && (
              <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                {formatDuration(durationMs)}
              </span>
            )}
            {isRunning && (
              <button
                type="button"
                onClick={handleAbort}
                title="停止 worker"
                className="size-6 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-500 shrink-0"
              >
                <Square className="size-3 fill-current" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showDetailDialog ? (
        <KanbanTaskDetailDialog task={task} open={detailOpen} onOpenChange={setDetailOpen} />
      ) : null}
    </>
  )
}
