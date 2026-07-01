/**
 * KanbanTaskDetailDialog — 看板任务详情弹窗
 *
 * 点击 KanbanTaskListItem 卡片后弹出，展示完整任务信息：
 * 标题、状态、任务内容、摘要、工人会话链接、模型/角色/渠道、耗时、时间戳、错误/阻塞原因。
 *
 * 如果任务有 assigneeSessionId（工人子会话），加载并渲染该会话的 SDK 消息，
 * 让用户看到工人的执行过程和对话。
 *
 * running 任务的耗时每秒刷新（setInterval）。
 */

import * as React from 'react'
import { Loader2, ExternalLink, RotateCw, ArrowUpRight } from 'lucide-react'
import Markdown from 'react-markdown'
import { toast } from 'sonner'

import type { KanbanTask, KanbanTaskStatus, SDKMessage } from '@tagent/shared'

import { useAgentRoleMap } from '@/atoms/agent-role-atoms'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  Button,
} from '@tagent/ui'
import { cn } from '@/lib/utils'
import { useOpenSession } from '@/hooks/useOpenSession'

import {
  groupIntoTurns,
  MessageGroupRenderer,
  getGroupId,
  buildHistoricalTaskSubjects,
} from '@/components/agent/SDKMessageRenderer'
import { STATUS_BADGE } from './KanbanTaskListItem'

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

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export interface KanbanTaskDetailDialogProps {
  task: KanbanTask
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KanbanTaskDetailDialog({
  task,
  open,
  onOpenChange,
}: KanbanTaskDetailDialogProps): React.ReactElement {
  const badge = STATUS_BADGE[task.status]
  const isRunning = task.status === 'running'
  const isFailed = task.status === 'failed'
  const [retrying, setRetrying] = React.useState(false)

  const roleMap = useAgentRoleMap()
  const roleDisplayName = task.roleId ? roleMap.get(task.roleId) : undefined

  const handleRetry = async (): Promise<void> => {
    setRetrying(true)
    try {
      await window.electronAPI.kanban.retryTask(task.id)
      toast.success('任务已重置为 ready，调度器将重新派工')
      onOpenChange(false)
    } catch (err) {
      toast.error('重试失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setRetrying(false)
    }
  }

  // 耗时实时刷新：running 时每秒 re-render
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!open || !isRunning) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [open, isRunning])

  const openSession = useOpenSession()

  const handleOpenWorkerSession = (): void => {
    if (!assigneeSessionId) return
    try {
      openSession('agent', assigneeSessionId, `工人会话 ${task.title}`)
      onOpenChange(false)
    } catch (err) {
      console.error('[看板] 打开工人会话失败:', err)
      toast.error('打开工人会话失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const durationMs =
    task.startedAt && task.finishedAt
      ? task.finishedAt - task.startedAt
      : task.startedAt && isRunning
        ? Date.now() - task.startedAt
        : 0

  // 加载工人子会话的 SDK 消息（assigneeSessionId 存在时）
  const [workerMessages, setWorkerMessages] = React.useState<SDKMessage[]>([])
  const [loadingMessages, setLoadingMessages] = React.useState(false)
  const assigneeSessionId = task.assigneeSessionId

  React.useEffect(() => {
    if (!open || !assigneeSessionId) {
      setWorkerMessages([])
      return
    }
    let cancelled = false
    setLoadingMessages(true)
    window.electronAPI
      .getAgentSessionSDKMessages(assigneeSessionId)
      .then((msgs: SDKMessage[]) => {
        if (!cancelled) {
          setWorkerMessages(msgs)
          setLoadingMessages(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[看板] 加载工人子会话消息失败:', err)
          setWorkerMessages([])
          setLoadingMessages(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, assigneeSessionId])

  // 任务状态变化时（如 running → done）重新加载消息拿最终摘要
  React.useEffect(() => {
    if (open && assigneeSessionId && task.status === 'done') {
      window.electronAPI
        .getAgentSessionSDKMessages(assigneeSessionId)
        .then((msgs: SDKMessage[]) => setWorkerMessages(msgs))
        .catch(() => {})
    }
  }, [open, assigneeSessionId, task.status])

  // 把 SDK 消息分组为 turns（复用 AgentMessages 的渲染逻辑）
  const groups = React.useMemo(() => {
    if (workerMessages.length === 0) return []
    return groupIntoTurns(workerMessages)
  }, [workerMessages])

  const historicalTaskSubjects = React.useMemo(
    () => buildHistoricalTaskSubjects(workerMessages),
    [workerMessages]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isRunning && <Loader2 className="size-4 animate-spin text-amber-500" />}
            <DialogTitle className="text-base">{task.title}</DialogTitle>
            <Badge variant="outline" className={cn('text-[10px]', badge.className)}>
              {badge.label}
            </Badge>
            {isFailed && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 text-[11px]"
                disabled={retrying}
                onClick={() => void handleRetry()}
              >
                <RotateCw className={cn('size-3 mr-1', retrying && 'animate-spin')} />
                {retrying ? '重试中' : '重试'}
              </Button>
            )}
          </div>
          <DialogDescription className="font-mono text-[10px]">{task.id}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 scrollbar-thin">
          {/* 任务内容 */}
          <section>
            <h3 className="mb-1.5 text-xs font-medium text-foreground">任务内容</h3>
            <div className="session-glass rounded-glass-popover p-3">
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80">
                <Markdown>{task.body || '（无内容）'}</Markdown>
              </div>
            </div>
          </section>

          {/* 完成摘要 / 阻塞原因 / 错误信息 */}
          {task.resultSummary && (
            <section>
              <h3 className="mb-1.5 text-xs font-medium text-foreground">完成摘要</h3>
              <div className="rounded-glass-popover bg-emerald-500/5 p-3 border border-emerald-500/20">
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80">
                  <Markdown>{task.resultSummary}</Markdown>
                </div>
              </div>
            </section>
          )}

          {task.blockedReason && (
            <section>
              <h3 className="mb-1.5 text-xs font-medium text-foreground">阻塞原因</h3>
              <div className="rounded-glass-popover bg-red-500/5 p-3 border border-red-500/20">
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                  {task.blockedReason}
                </p>
              </div>
            </section>
          )}

          {task.error && (
            <section>
              <h3 className="mb-1.5 text-xs font-medium text-foreground">错误信息</h3>
              <div className="rounded-glass-popover bg-red-500/5 p-3 border border-red-500/20">
                <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">
                  {task.error}
                </p>
              </div>
            </section>
          )}

          {/* 工人执行过程（SDK 消息渲染） */}
          {assigneeSessionId && (
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                执行过程
                <span className="text-[10px] text-muted-foreground">
                  · 工人会话 {assigneeSessionId}
                </span>
              </h3>
              <div className="session-glass rounded-glass-popover p-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : groups.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    工人尚未产出消息
                  </p>
                ) : (
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <MessageGroupRenderer
                        key={getGroupId(group)}
                        group={group}
                        allMessages={workerMessages}
                        historicalTaskSubjects={historicalTaskSubjects}
                        isStreaming={isRunning || undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 元信息网格 */}
          <section className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-glass-popover bg-muted/30 p-3 text-xs">
            <InfoRow label="模型" value={task.modelId} mono />
            <InfoRow label="角色" value={roleDisplayName ?? task.roleId} mono />
            <InfoRow label="渠道" value={task.channelId} mono />
            <InfoRow label="优先级" value={String(task.priority)} mono />
            <InfoRow
              label="工人会话"
              value={task.assigneeSessionId}
              mono
              actionIcon={
                task.assigneeSessionId ? (
                  <button
                    type="button"
                    onClick={handleOpenWorkerSession}
                    className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                    title="在新 Tab 打开工人会话"
                  >
                    打开
                    <ArrowUpRight className="size-2.5" />
                  </button>
                ) : undefined
              }
            />
            <InfoRow
              label="耗时"
              value={durationMs > 0 ? formatDuration(durationMs) : isRunning ? '进行中' : '—'}
            />
            <InfoRow
              label="开始时间"
              value={task.startedAt ? formatDateTime(task.startedAt) : '—'}
            />
            <InfoRow
              label="完成时间"
              value={task.finishedAt ? formatDateTime(task.finishedAt) : '—'}
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({
  label,
  value,
  mono,
  actionIcon,
}: {
  label: string
  value?: string
  mono?: boolean
  actionIcon?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          'flex items-center gap-1 text-foreground/80',
          mono && 'font-mono text-[11px]'
        )}
      >
        {value ? (
          <>
            <span className="truncate">{value}</span>
            {actionIcon}
          </>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </span>
    </div>
  )
}
