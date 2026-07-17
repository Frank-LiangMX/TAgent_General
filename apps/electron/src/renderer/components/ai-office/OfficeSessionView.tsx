/**
 * OfficeSessionView — full-size per-session AI Office presentation.
 *
 * It shares the existing AgentView runtime and Kanban truth. The scene is a projection only:
 * switching here never creates boards, workers, sessions, or messages.
 */

import { useAtom, useAtomValue } from 'jotai'
import { ChevronRight, MessageSquareText, PanelTopOpen, RefreshCw, Users } from 'lucide-react'
import * as React from 'react'

import { AiOfficeContainer } from './AiOfficeContainer'
import { projectOfficeDirector } from './officeDirectorProjection'

import {
  agentSessionIndicatorMapAtom,
  agentSessionsAtom,
  agentSessionStreamingStateAtomFamily,
  type SessionIndicatorStatus,
} from '@/atoms/agent-atoms'
import { useKanbanBoard } from '@/atoms/kanban-atoms'
import {
  officeMotionModeAtom,
  officeSessionViewStateAtomFamily,
  sessionPresentationAtomFamily,
} from '@/atoms/session-presentation-atoms'
import { AgentView } from '@/components/agent'
import { SessionPresentationToggle } from '@/components/agent/SessionPresentationToggle'
import { KanbanTaskDetailDialog } from '@/components/kanban/KanbanTaskDetailDialog'
import { cn } from '@/lib/utils'

import './office-session-view.css'

interface OfficeSessionViewProps {
  sessionId: string
}

const STATUS_LABELS: Record<SessionIndicatorStatus | 'idle', string> = {
  idle: '待命',
  running: '执行中',
  blocked: '等待确认',
  completed: '已完成',
}

function statusTone(status: SessionIndicatorStatus | 'idle'): string {
  if (status === 'blocked') return 'bg-orange-500'
  if (status === 'running') return 'bg-blue-500'
  if (status === 'completed') return 'bg-emerald-500'
  return 'bg-muted-foreground/55'
}

export function OfficeSessionView({ sessionId }: OfficeSessionViewProps): React.ReactElement {
  const sessions = useAtomValue(agentSessionsAtom)
  const streamState = useAtomValue(agentSessionStreamingStateAtomFamily(sessionId))
  const indicatorMap = useAtomValue(agentSessionIndicatorMapAtom)
  const { board, tasks, loading, refresh } = useKanbanBoard(sessionId)
  const [officeViewState, setOfficeViewState] = useAtom(officeSessionViewStateAtomFamily(sessionId))
  const [, setPresentation] = useAtom(sessionPresentationAtomFamily(sessionId))
  const motionMode = useAtomValue(officeMotionModeAtom)
  const [detailTaskId, setDetailTaskId] = React.useState<string | null>(null)
  const chatDockRef = React.useRef<HTMLElement>(null)

  const session = sessions.find((item) => item.id === sessionId)
  const status = indicatorMap.get(sessionId) ?? 'idle'
  const activeTool = React.useMemo(() => {
    const activities = streamState?.toolActivities ?? []
    for (let index = activities.length - 1; index >= 0; index -= 1) {
      const activity = activities[index]
      if (activity && !activity.done) return activity
    }
    return undefined
  }, [streamState?.toolActivities])
  const unfinishedTaskCount = tasks.filter(
    (task) => task.status !== 'done' && task.status !== 'failed' && task.status !== 'cancelled'
  ).length
  const activeWorkerCount = new Set(
    tasks.flatMap((task) =>
      task.assigneeSessionId &&
      task.status !== 'done' &&
      task.status !== 'failed' &&
      task.status !== 'cancelled'
        ? [task.assigneeSessionId]
        : []
    )
  ).size

  const director = React.useMemo(
    () =>
      projectOfficeDirector(sessionId, {
        status,
        running: streamState?.running,
        thinkingText: streamState?.thinkingContent,
        responseText: streamState?.content,
        activeToolName: activeTool?.displayName || activeTool?.toolName,
        unfinishedTaskCount,
        activeWorkerCount,
      }),
    [
      activeTool?.displayName,
      activeTool?.toolName,
      activeWorkerCount,
      unfinishedTaskCount,
      sessionId,
      status,
      streamState?.content,
      streamState?.running,
      streamState?.thinkingContent,
    ]
  )
  const leadingAgents = React.useMemo(() => [director], [director])

  React.useEffect(() => {
    const dock = chatDockRef.current
    if (!dock || officeViewState.chatCollapsed) return
    let frame: number | null = null
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const nextWidth = Math.max(360, Math.min(620, Math.round(entry.contentRect.width)))
      if (frame != null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        setOfficeViewState((current) =>
          Math.abs(nextWidth - current.chatWidth) < 2
            ? current
            : { ...current, chatWidth: nextWidth }
        )
      })
    })
    observer.observe(dock)
    return () => {
      observer.disconnect()
      if (frame != null) cancelAnimationFrame(frame)
    }
  }, [officeViewState.chatCollapsed, setOfficeViewState])

  const detailTask = React.useMemo(
    () => tasks.find((task) => task.id === detailTaskId) ?? null,
    [detailTaskId, tasks]
  )
  const doneCount = tasks.filter((task) => task.status === 'done').length
  const staffedCount = new Set(tasks.flatMap((task) => task.assigneeSessionId ?? [])).size
  const returnToClassic = React.useCallback(() => setPresentation('classic'), [setPresentation])

  return (
    <div className="office-session-view h-full min-h-0 overflow-hidden" data-session-id={sessionId}>
      <div className="absolute inset-0 z-0">
        <AiOfficeContainer
          tasks={tasks}
          leadingAgents={leadingAgents}
          reservedDeskCount={1}
          onTaskSelect={setDetailTaskId}
          cameraState={officeViewState.camera}
          onCameraChange={(camera) => setOfficeViewState((current) => ({ ...current, camera }))}
          motionMode={motionMode}
          onFallbackClassic={returnToClassic}
          className="h-full"
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4">
        <div className="office-session-hud pointer-events-auto min-w-0 max-w-[min(540px,60vw)] rounded-2xl border border-border/55 bg-background/78 px-4 py-3 shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className={cn('size-2 rounded-full', statusTone(status))} aria-hidden />
            <h1 className="truncate text-sm font-semibold text-foreground">
              {session?.title || '未命名办公室'}
            </h1>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {STATUS_LABELS[status]}
            </span>
            {board ? (
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-55"
                aria-label="刷新办公室任务状态"
                title="刷新办公室任务状态"
              >
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>主 Agent · 总监在场</span>
            {board ? (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" aria-hidden />
                {staffedCount} 名员工 · {doneCount}/{tasks.length} 已交付
              </span>
            ) : (
              <span>尚未组建团队 · 复杂任务可通过看板召集员工</span>
            )}
            {loading ? <span role="status">正在同步看板…</span> : null}
          </div>
        </div>

        <SessionPresentationToggle sessionId={sessionId} className="pointer-events-auto" />
      </header>

      {officeViewState.chatCollapsed ? (
        <button
          type="button"
          onClick={() => setOfficeViewState((current) => ({ ...current, chatCollapsed: false }))}
          className="office-session-chat-trigger absolute bottom-5 right-5 z-20 flex size-12 items-center justify-center rounded-full border border-border/60 bg-background/88 text-foreground shadow-xl backdrop-blur-xl transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="展开主 Agent 沟通窗"
          title="展开主 Agent 沟通窗"
        >
          <MessageSquareText className="size-5" aria-hidden />
          <span className={cn('absolute right-1 top-1 size-2 rounded-full', statusTone(status))} />
        </button>
      ) : (
        <section
          ref={chatDockRef}
          className="office-session-chat-dock absolute bottom-4 right-4 top-[88px] z-20 flex w-[440px] min-w-[360px] max-w-[min(48vw,620px)] resize-x flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/86 shadow-2xl backdrop-blur-2xl"
          aria-label="与主 Agent 沟通"
          style={{ width: officeViewState.chatWidth }}
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/45 px-3">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquareText className="size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">总监沟通窗</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  同一会话 · {STATUS_LABELS[status]}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={returnToClassic}
                className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="在经典工作台中查看完整内容"
                title="在经典工作台中查看完整内容"
              >
                <PanelTopOpen className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() =>
                  setOfficeViewState((current) => ({ ...current, chatCollapsed: true }))
                }
                className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="收起沟通窗"
                title="收起沟通窗"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <AgentView sessionId={sessionId} surface="office-dock" />
          </div>
        </section>
      )}

      {detailTask ? (
        <KanbanTaskDetailDialog
          task={detailTask}
          open
          onOpenChange={(open) => {
            if (!open) setDetailTaskId(null)
          }}
        />
      ) : null}
    </div>
  )
}
