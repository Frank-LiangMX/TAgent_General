/**
 * KanbanTaskDetailDialog — Worker 工牌详情
 *
 * 工人对话只在本弹窗「执行过程」里看（消息流），不跳会话 Tab。
 * 左栏：元信息；主区：概览 · 执行过程 · 交接。
 */

import * as React from 'react'
import {
  Loader2,
  RotateCw,
  Target,
} from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

import type { KanbanTask, SDKMessage } from '@tagent/shared'

import {
  Button,
  Dialog,
  Input,
  SegmentedTabs,
  SegmentedTabsItem,
} from '@tagent/ui'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import {
  groupIntoTurns,
  MessageGroupRenderer,
  getGroupId,
  buildHistoricalTaskSubjects,
} from '@/components/agent/SDKMessageRenderer'
import { CREW_STATUS_BADGE, roleAvatarSpec } from '@/lib/kanban-crew-status'
import { cn } from '@/lib/utils'

import {
  KanbanDetailA11yTitle,
  KanbanDetailBody,
  KanbanDetailContent,
  KanbanDetailHeader,
  KanbanDetailMain,
  KanbanDetailMetaItem,
  KanbanDetailSection,
} from './kanban-detail-shell'

/** @deprecated */
export const STATUS_BADGE = CREW_STATUS_BADGE

type DetailTab = 'overview' | 'transcript' | 'handoff'

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

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const mdHeading = (size: string) =>
  function MdHeading({ children }: { children?: React.ReactNode }): React.ReactElement {
    return (
      <h3 className={cn(size, 'mb-1.5 mt-3 font-semibold tracking-tight text-foreground first:mt-0')}>
        {children}
      </h3>
    )
  }

/** 概览 / 摘要用紧凑 Markdown，避免浏览器默认 h1/表格字号撑爆弹窗 */
const mdCompact = {
  h1: mdHeading('text-[13px]'),
  h2: mdHeading('text-[12.5px]'),
  h3: mdHeading('text-[12px]'),
  h4: mdHeading('text-[12px]'),
  h5: mdHeading('text-[11.5px]'),
  h6: mdHeading('text-[11.5px]'),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="m-0 mb-2 last:mb-0 text-[12px] leading-relaxed text-foreground/85">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-foreground/[0.06] px-1 py-0.5 font-mono text-[11px]">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-2 overflow-x-auto rounded-[10px] bg-foreground/[0.06] p-2.5 font-mono text-[11px] leading-relaxed text-foreground/80 last:mb-0">
      {children}
    </pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 text-[12px] leading-relaxed last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 text-[12px] leading-relaxed last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-[12px] leading-relaxed text-foreground/85">{children}</li>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-foreground/[0.08]">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-2 py-1.5 text-left text-[11px] font-medium text-foreground/55">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-foreground/[0.05] px-2 py-1.5 align-top text-[12px] leading-relaxed text-foreground/85">
      {children}
    </td>
  ),
  hr: () => <hr className="my-3 border-foreground/[0.08]" />,
}

export interface KanbanTaskDetailDialogProps {
  task: KanbanTask
  open: boolean
  onOpenChange: (open: boolean) => void
  roleLabel?: string
}

export function KanbanTaskDetailDialog({
  task,
  open,
  onOpenChange,
  roleLabel,
}: KanbanTaskDetailDialogProps): React.ReactElement {
  const badge = CREW_STATUS_BADGE[task.status]
  const isRunning = task.status === 'running'
  const isFailed = task.status === 'failed'
  const [retrying, setRetrying] = React.useState(false)
  const [tab, setTab] = React.useState<DetailTab>('overview')

  const roleMap = useAgentRoleMap()
  const roleDisplayName = roleLabel ?? (task.roleId ? roleMap.get(task.roleId) : undefined)
  const { wrap: avatarWrap, Icon: RoleIcon } = roleAvatarSpec(task.roleId)

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

  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!open || !isRunning) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [open, isRunning])

  // 有工人会话时默认进「执行过程」（消息流）；未派工才看概览
  React.useEffect(() => {
    if (!open) return
    setTab(task.assigneeSessionId ? 'transcript' : 'overview')
  }, [open, task.assigneeSessionId, task.id])

  const assigneeSessionId = task.assigneeSessionId

  const durationMs =
    task.startedAt && task.finishedAt
      ? task.finishedAt - task.startedAt
      : task.startedAt && isRunning
        ? Date.now() - task.startedAt
        : 0

  const [workerMessages, setWorkerMessages] = React.useState<SDKMessage[]>([])
  const [loadingMessages, setLoadingMessages] = React.useState(false)

  React.useEffect(() => {
    if (!open || !assigneeSessionId) {
      setWorkerMessages([])
      return
    }
    let cancelled = false
    let firstLoad = true
    let timer: ReturnType<typeof setInterval> | null = null

    const loadMessages = async (): Promise<void> => {
      if (firstLoad) setLoadingMessages(true)
      try {
        const msgs = await window.electronAPI.getAgentSessionSDKMessages(assigneeSessionId)
        if (!cancelled) setWorkerMessages(msgs)
      } catch (err) {
        if (!cancelled) {
          console.error('[看板] 加载工人子会话消息失败:', err)
          if (firstLoad) setWorkerMessages([])
        }
      } finally {
        if (!cancelled && firstLoad) {
          setLoadingMessages(false)
          firstLoad = false
        }
      }
    }

    void loadMessages()
    if (task.status === 'running') {
      timer = setInterval(() => {
        void loadMessages()
      }, 1500)
    }

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [open, assigneeSessionId, task.status])

  const groups = React.useMemo(() => {
    if (workerMessages.length === 0) return []
    return groupIntoTurns(workerMessages)
  }, [workerMessages])

  const historicalTaskSubjects = React.useMemo(
    () => buildHistoricalTaskSubjects(workerMessages),
    [workerMessages]
  )

  const aside = (
    <>
      <div className="space-y-3">
        <KanbanDetailMetaItem label="角色" value={roleDisplayName ?? task.roleId} />
        <KanbanDetailMetaItem label="模型" value={task.modelId} mono />
        <KanbanDetailMetaItem label="渠道" value={task.channelId} mono />
        <KanbanDetailMetaItem label="优先级" value={String(task.priority)} mono />
        <KanbanDetailMetaItem
          label="耗时"
          value={durationMs > 0 ? formatDuration(durationMs) : isRunning ? '进行中' : undefined}
        />
        <KanbanDetailMetaItem
          label="开始"
          value={task.startedAt ? formatDateTime(task.startedAt) : undefined}
        />
        <KanbanDetailMetaItem
          label="完成"
          value={task.finishedAt ? formatDateTime(task.finishedAt) : undefined}
        />
      </div>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <KanbanDetailContent className="max-w-[920px]">
        <KanbanDetailA11yTitle title={task.title} description={task.id} />
        <KanbanDetailHeader
          icon={
            <div
              className={cn(
                'relative flex size-10 items-center justify-center rounded-[12px]',
                avatarWrap
              )}
            >
              <RoleIcon className="size-4" strokeWidth={1.75} />
              {isRunning ? (
                <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-amber-500" />
              ) : null}
            </div>
          }
          title={task.title}
          description={
            <span className="font-mono text-[11px] text-foreground/40">{task.id}</span>
          }
          meta={
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                badge.className
              )}
            >
              <span className={cn('size-1 rounded-full', badge.dot)} />
              {badge.label}
            </span>
          }
          actions={
            isFailed ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 rounded-full px-3 text-xs"
                disabled={retrying}
                onClick={() => void handleRetry()}
              >
                <RotateCw className={cn('size-3', retrying && 'animate-spin')} />
                {retrying ? '重试中' : '重试'}
              </Button>
            ) : isRunning ? (
              <Loader2 className="size-4 animate-spin text-amber-500" />
            ) : null
          }
        />

        <KanbanDetailBody aside={aside}>
          <div className="flex shrink-0 items-center gap-3 px-5 pt-3">
            <SegmentedTabs value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
              <SegmentedTabsItem value="transcript" disabled={!assigneeSessionId}>
                执行过程
              </SegmentedTabsItem>
              <SegmentedTabsItem value="overview">概览</SegmentedTabsItem>
              <SegmentedTabsItem value="handoff">交接</SegmentedTabsItem>
            </SegmentedTabs>
          </div>

          <KanbanDetailMain>
            {tab === 'overview' ? (
              <OverviewPanel task={task} />
            ) : tab === 'transcript' ? (
              <TranscriptPanel
                loading={loadingMessages}
                groups={groups}
                workerMessages={workerMessages}
                historicalTaskSubjects={historicalTaskSubjects}
                isRunning={isRunning}
              />
            ) : (
              <BlackboardSection task={task} />
            )}
          </KanbanDetailMain>
        </KanbanDetailBody>
      </KanbanDetailContent>
    </Dialog>
  )
}

function OverviewPanel({ task }: { task: KanbanTask }): React.ReactElement {
  return (
    <>
      <KanbanDetailSection kicker="任务内容">
        <div className="kanban-crew-md">
          <Markdown remarkPlugins={[remarkGfm]} components={mdCompact}>
            {task.body || '（无内容）'}
          </Markdown>
        </div>
      </KanbanDetailSection>

      {task.resultSummary ? (
        <KanbanDetailSection kicker="交卷摘要" tone="success">
          <Markdown remarkPlugins={[remarkGfm]} components={mdCompact}>
            {task.resultSummary}
          </Markdown>
        </KanbanDetailSection>
      ) : null}

      {task.blockedReason ? (
        <KanbanDetailSection kicker="阻塞原因" tone="danger">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">
            {task.blockedReason}
          </p>
        </KanbanDetailSection>
      ) : null}

      {task.error ? (
        <KanbanDetailSection kicker="错误信息" tone="danger">
          <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-red-600/90 dark:text-red-400/90">
            {task.error}
          </p>
        </KanbanDetailSection>
      ) : null}

      {task.goalMode ? (
        <KanbanDetailSection
          kicker="Goal 验收"
          tone="violet"
          trailing={
            <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-600 dark:text-violet-400">
              <Target className="size-2.5" />
              Goal
            </span>
          }
        >
          <div className="space-y-2 text-[12px]">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground/70">
              <span>
                轮次{' '}
                <span className="font-mono tabular-nums text-foreground">
                  {typeof task.metadata?.goalTurnCount === 'number'
                    ? task.metadata.goalTurnCount
                    : '—'}
                  /{task.goalMaxTurns ?? 20}
                </span>
              </span>
              {task.judgeModel ? (
                <span>
                  Judge{' '}
                  <span className="font-mono text-foreground">{task.judgeModel}</span>
                </span>
              ) : null}
            </div>
            {task.acceptanceCriteria?.trim() ? (
              <p className="whitespace-pre-wrap text-foreground/80">{task.acceptanceCriteria}</p>
            ) : null}
            {task.metadata?.judgeResult ? (
              <div className="rounded-[10px] bg-background/50 px-2.5 py-2">
                <p className="text-[11px] font-medium text-foreground">
                  {task.metadata.judgeResult.verdict}
                  {task.metadata.judgeResult.failOpen ? ' · fail-open' : ''}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-foreground/75">
                  {task.metadata.judgeResult.reason}
                </p>
              </div>
            ) : null}
          </div>
        </KanbanDetailSection>
      ) : null}
    </>
  )
}

function TranscriptPanel({
  loading,
  groups,
  workerMessages,
  historicalTaskSubjects,
  isRunning,
}: {
  loading: boolean
  groups: ReturnType<typeof groupIntoTurns>
  workerMessages: SDKMessage[]
  historicalTaskSubjects: ReturnType<typeof buildHistoricalTaskSubjects>
  isRunning: boolean
}): React.ReactElement {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-foreground/40" />
      </div>
    )
  }
  if (groups.length === 0) {
    return (
      <p className="py-16 text-center text-[13px] text-foreground/45">工人尚未产出消息</p>
    )
  }
  return (
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
  )
}

function BlackboardSection({ task }: { task: KanbanTask }): React.ReactElement {
  const comments = task.metadata?.blackboard ?? []
  const [newComment, setNewComment] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async (): Promise<void> => {
    const trimmed = newComment.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await window.electronAPI.kanban.commentTask({
        taskId: task.id,
        comment: trimmed,
        author: 'main',
      })
      setNewComment('')
      toast.success('评论已写入 blackboard')
    } catch (err) {
      toast.error('评论失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KanbanDetailSection
      kicker="Blackboard"
      trailing={
        <span className="text-[10px] tabular-nums text-foreground/40">{comments.length}</span>
      }
    >
      {comments.length === 0 ? (
        <p className="py-3 text-center text-[12px] text-foreground/45">
          暂无评论。写下发现，下一个 worker 启动时会注入 body。
        </p>
      ) : (
        <ul className="mb-3 space-y-2.5">
          {comments.map((c, idx) => (
            <li key={`${c.ts}-${idx}`} className="text-[12px]">
              <div className="flex items-center gap-1.5 text-[10px] text-foreground/40">
                <span className="font-medium text-foreground/65">{c.author}</span>
                <span>·</span>
                <span>{new Date(c.ts).toLocaleString()}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground/80">{c.comment}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 border-t border-foreground/[0.06] pt-3">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="补充上下文 / 给下一个 worker…"
          className="h-8 flex-1 text-xs"
          disabled={submitting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !submitting) {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void handleSubmit()}
          disabled={submitting || !newComment.trim()}
          className="h-8 rounded-full px-3 text-xs"
        >
          发送
        </Button>
      </div>
    </KanbanDetailSection>
  )
}
