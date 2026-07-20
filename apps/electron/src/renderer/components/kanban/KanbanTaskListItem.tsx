/**
 * KanbanTaskListItem — 完整工牌卡片
 *
 * 运行中：独立「进度更新」ticker 区展示最新 progress log（与生命周期徽章分开）。
 * 完成后：「交卷摘要」等带标签区块，同样用 markdown 截断展示。
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { Loader2, Square, CheckCircle2, XCircle, Clock, Target } from 'lucide-react'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { KanbanTask, ProgressLogEntry } from '@tagent/shared'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { KanbanTaskDetailDialog } from './KanbanTaskDetailDialog'
import { taskProgressLogsAtomFamily } from '@/atoms/kanban-atoms'
import { cn } from '@/lib/utils'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import {
  CREW_STATUS_BADGE,
  parseCrewBadge,
  roleAvatarSpec,
} from '@/lib/kanban-crew-status'

/** @deprecated */
export const STATUS_BADGE = CREW_STATUS_BADGE

/** 工牌内 markdown：紧凑行内，配合 line-clamp */
const crewMdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <span className="m-0 block">{children}</span>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="text-primary underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-foreground/[0.06] px-1 py-0.5 font-mono text-[9px]">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <span className="m-0 block font-mono text-[9px]">{children}</span>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <span className="m-0 block">{children}</span>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <span className="m-0 block">{children}</span>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <span className="m-0 block before:content-['·_']">{children}</span>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
}

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

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 1) return '0s'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remainingM = m % 60
  return remainingM > 0 ? `${h}h ${remainingM}m` : `${h}h`
}

function computeDuration(task: KanbanTask): number {
  if (!task.startedAt) return 0
  const end = task.finishedAt ?? (task.status === 'running' ? Date.now() : 0)
  if (!end) return 0
  return end - task.startedAt
}

function resolveLiveStatusText(liveLogs: ProgressLogEntry[], task: KanbanTask): string {
  if (liveLogs.length > 0) {
    return liveLogs[liveLogs.length - 1]?.text?.trim() || ''
  }
  const metaLogs = task.metadata?.progressLogs
  if (Array.isArray(metaLogs) && metaLogs.length > 0) {
    return metaLogs[metaLogs.length - 1]?.text?.trim() || ''
  }
  return ''
}

export interface KanbanTaskListItemProps {
  task: KanbanTask
  showDetailDialog?: boolean
  roleLabel?: string
  sameRoleActiveCount?: number
  /** @deprecated 主区统一完整卡片；保留参数以免旧调用报错 */
  density?: 'live' | 'row'
}

export function KanbanTaskListItem({
  task,
  showDetailDialog = true,
  roleLabel,
  sameRoleActiveCount,
}: KanbanTaskListItemProps): React.ReactElement {
  const [detailOpen, setDetailOpen] = React.useState(false)
  const progressLogs = useAtomValue(taskProgressLogsAtomFamily(task.id))
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (task.status !== 'running') return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [task.status])

  const badge = CREW_STATUS_BADGE[task.status]
  const isRunning = task.status === 'running'
  const isDone = task.status === 'done'
  const isFailed = task.status === 'failed'

  const roleMap = useAgentRoleMap()
  const roleDisplayName = task.roleId ? roleMap.get(task.roleId) : undefined
  const roleTitle = roleLabel ?? roleDisplayName
  const crewNo = parseCrewBadge(roleLabel)
  const { wrap: avatarWrap, Icon: RoleIcon } = roleAvatarSpec(task.roleId)

  const progress = isDone ? 100 : isRunning ? 55 : isFailed ? 100 : 0
  const durationMs = computeDuration(task)
  const showDuration = isRunning || isDone || isFailed
  const liveStatusText = resolveLiveStatusText(progressLogs, task)
  const liveStatusKey = `${progressLogs.length}:${liveStatusText.slice(0, 48)}`

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
          'kanban-crew-badge group flex h-full w-full cursor-pointer flex-col text-left titlebar-no-drag ui-pressable',
          isRunning && 'kanban-crew-badge--live',
          detailOpen && 'kanban-crew-badge--open'
        )}
      >
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2.5 p-3.5">
          {/* 头：图标 + 角色 + 状态 */}
          <div className="flex shrink-0 items-start gap-3">
            <div className="relative shrink-0">
              <div
                className={cn(
                  'flex size-9 items-center justify-center rounded-[12px]',
                  avatarWrap
                )}
              >
                <RoleIcon className="size-4" strokeWidth={1.75} />
              </div>
              {crewNo ? (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-foreground/[0.08] px-0.5 font-mono text-[8px] tabular-nums text-muted-foreground">
                  {crewNo}
                </span>
              ) : null}
              {isRunning ? (
                <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-amber-500" />
              ) : null}
              {sameRoleActiveCount != null && sameRoleActiveCount >= 2 ? (
                <span className="absolute -left-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-foreground/80 text-[8px] font-bold text-background">
                  ×{sameRoleActiveCount}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                  {roleTitle ?? '未分配角色'}
                </span>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                    badge.className
                  )}
                >
                  <span className={cn('size-1 rounded-full', badge.dot)} />
                  {badge.label}
                </span>
                {task.goalMode ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-600 dark:text-violet-400">
                        <Target className="size-2.5" />
                        Goal
                        {typeof task.metadata?.goalTurnCount === 'number' &&
                          task.goalMaxTurns != null && (
                            <span className="tabular-nums opacity-80">
                              {task.metadata.goalTurnCount}/{task.goalMaxTurns}
                            </span>
                          )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px]">
                      {task.acceptanceCriteria?.trim() ||
                        'Goal 模式：多轮验收 + complete 闸门'}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{task.title}</p>
            </div>
          </div>

          {/* 实时进度 ticker：与上方「忙碌」徽章区分开的独立信息带 */}
          {isRunning ? (
            <div className="kanban-crew-ticker flex min-h-[4.5rem] flex-1 flex-col rounded-[10px] border border-amber-500/20 bg-amber-500/[0.07] px-2.5 py-2">
              <div className="mb-1 flex shrink-0 items-center gap-1.5">
                <Loader2 className="size-2.5 shrink-0 animate-spin text-amber-500" />
                <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-amber-700/80 dark:text-amber-400/80">
                  进度更新
                </span>
                {progressLogs.length > 0 || liveStatusText ? (
                  <span className="ml-auto tabular-nums text-[9px] text-amber-700/55 dark:text-amber-400/55">
                    {new Date(
                      progressLogs[progressLogs.length - 1]?.ts ?? Date.now()
                    ).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </span>
                ) : null}
              </div>
              <div
                key={liveStatusKey}
                className="kanban-crew-md min-w-0 flex-1 text-[11px] leading-relaxed text-foreground/85 line-clamp-3 break-words animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
              >
                <Markdown remarkPlugins={[remarkGfm]} components={crewMdComponents}>
                  {liveStatusText || '正在上岗…'}
                </Markdown>
              </div>
            </div>
          ) : null}

          {/* 完成 / 失败 / Judge：带标签，避免和生命周期徽章混读 */}
          {isDone && task.resultSummary ? (
            <div className="flex min-h-[4.5rem] flex-1 flex-col rounded-[10px] border border-emerald-500/15 bg-emerald-500/[0.06] px-2.5 py-2">
              <div className="mb-1 flex shrink-0 items-center gap-1.5">
                <CheckCircle2 className="size-2.5 shrink-0 text-emerald-500" />
                <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-emerald-700/75 dark:text-emerald-400/75">
                  交卷摘要
                </span>
              </div>
              <div className="kanban-crew-md min-w-0 flex-1 text-[11px] leading-relaxed text-foreground/80 line-clamp-4 break-words">
                <Markdown remarkPlugins={[remarkGfm]} components={crewMdComponents}>
                  {task.resultSummary}
                </Markdown>
              </div>
            </div>
          ) : null}

          {isFailed && task.error ? (
            <div className="flex min-h-[4.5rem] flex-1 flex-col rounded-[10px] border border-red-500/15 bg-red-500/[0.06] px-2.5 py-2">
              <div className="mb-1 flex shrink-0 items-center gap-1.5">
                <XCircle className="size-2.5 shrink-0 text-red-500" />
                <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-red-700/75 dark:text-red-400/75">
                  失败原因
                </span>
              </div>
              <div className="kanban-crew-md min-w-0 flex-1 text-[11px] leading-relaxed text-red-700/90 dark:text-red-300/90 line-clamp-4 break-words">
                <Markdown remarkPlugins={[remarkGfm]} components={crewMdComponents}>
                  {task.error}
                </Markdown>
              </div>
            </div>
          ) : null}

          {task.goalMode && task.metadata?.judgeResult && !isDone ? (
            <div className="flex min-h-[4.5rem] flex-1 flex-col rounded-[10px] border border-violet-500/15 bg-violet-500/[0.06] px-2.5 py-2">
              <div className="mb-1 flex shrink-0 items-center gap-1.5">
                <Target className="size-2.5 shrink-0 text-violet-500" />
                <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-violet-700/75 dark:text-violet-400/75">
                  Judge
                </span>
              </div>
              <div className="kanban-crew-md min-w-0 flex-1 text-[11px] leading-relaxed text-foreground/80 line-clamp-3 break-words">
                <Markdown remarkPlugins={[remarkGfm]} components={crewMdComponents}>
                  {`**${task.metadata.judgeResult.verdict}${
                    task.metadata.judgeResult.failOpen ? ' · fail-open' : ''
                  }** — ${task.metadata.judgeResult.reason}`}
                </Markdown>
              </div>
            </div>
          ) : null}

          {/* 无摘要时占位，保证同行卡片等高时底栏仍贴底 */}
          {!isRunning &&
          !(isDone && task.resultSummary) &&
          !(isFailed && task.error) &&
          !(task.goalMode && task.metadata?.judgeResult && !isDone) ? (
            <div className="min-h-[4.5rem] flex-1" aria-hidden />
          ) : null}

          {/* 底：进度 + 时间 + 模型 + 停岗 */}
          <div className="mt-auto flex shrink-0 items-center gap-2 pt-0.5">
            <div className="min-w-0 flex-1">
              <div className="h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isDone && 'bg-emerald-500/80',
                    isRunning && 'bg-amber-500/80',
                    isFailed && 'bg-red-500/70',
                    !isDone && !isRunning && !isFailed && 'bg-transparent'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            {task.startedAt ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground">
                    <Clock className="size-2.5" />
                    {showDuration && durationMs > 0
                      ? formatDuration(durationMs)
                      : formatStartTime(task.startedAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>开始于 {formatStartTime(task.startedAt)}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-[10px] text-muted-foreground/50">待机</span>
            )}
            {task.modelId ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="max-w-[88px] truncate font-mono text-[10px] text-muted-foreground/70">
                    {task.modelId}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{task.modelId}</TooltipContent>
              </Tooltip>
            ) : null}
            {isRunning ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleAbort}
                    aria-label="停止"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10"
                  >
                    <Square className="size-3 fill-current" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">停止</TooltipContent>
              </Tooltip>
            ) : null}
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
