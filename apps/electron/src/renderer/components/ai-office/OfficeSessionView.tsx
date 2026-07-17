/**
 * OfficeSessionView — full-size per-session AI Office presentation.
 *
 * It shares the existing AgentView runtime and Kanban truth. The scene is a projection only:
 * switching here never creates boards, workers, sessions, or messages.
 */

import { useAtom, useAtomValue } from 'jotai'
import { ChevronRight, GripVertical, MessageSquareText, MoreVertical, PanelTopOpen, RefreshCw, Users } from 'lucide-react'
import * as React from 'react'

import { Slider, Popover, PopoverContent, PopoverTrigger, Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'

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
  type OfficeChatPosition,
  type OfficeChatUISize,
} from '@/atoms/session-presentation-atoms'
import { AgentView } from '@/components/agent'
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

const UI_SIZE_MAP: Array<{ value: number; label: OfficeChatUISize }> = [
  { value: 0, label: 'small' },
  { value: 1, label: 'medium' },
  { value: 2, label: 'large' },
]

const UI_SIZE_LABELS: Record<OfficeChatUISize, string> = {
  small: '小',
  medium: '中',
  large: '大',
}

function uiSizeToSlider(value: OfficeChatUISize): number {
  return UI_SIZE_MAP.find((item) => item.label === value)?.value ?? 1
}

function sliderToUISize(value: number): OfficeChatUISize {
  return UI_SIZE_MAP.find((item) => item.value === value)?.label ?? 'medium'
}

/** 默认位置标记：使用右下角 */
const DEFAULT_POSITION: OfficeChatPosition = { x: -1, y: -1 }

function resolveChatPosition(
  chatPosition: OfficeChatPosition,
  containerRect: DOMRect | null,
  dockWidth: number,
  dockHeight: number
): OfficeChatPosition {
  if (chatPosition.x >= 0 && chatPosition.y >= 0) return chatPosition
  // 默认位置：右下角
  if (!containerRect) return { x: 100, y: 400 }
  return {
    x: containerRect.width - dockWidth - 20,
    y: containerRect.height - dockHeight - 20,
  }
}

function clampPosition(
  pos: OfficeChatPosition,
  containerRect: DOMRect | null,
  dockWidth: number,
  dockHeight: number
): OfficeChatPosition {
  if (!containerRect) return pos
  const maxX = containerRect.width - dockWidth - 8
  const maxY = containerRect.height - dockHeight - 8
  return {
    x: Math.max(8, Math.min(maxX, pos.x)),
    y: Math.max(8, Math.min(maxY, pos.y)),
  }
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
  const containerRef = React.useRef<HTMLDivElement>(null)
  const dragStateRef = React.useRef<{
    startX: number
    startY: number
    startPosX: number
    startPosY: number
  } | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

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
      const nextWidth = Math.max(328, Math.min(540, Math.round(entry.contentRect.width)))
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

  // 拖动逻辑
  const handleDragStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const dock = chatDockRef.current
      const container = containerRef.current
      if (!dock || !container) return

      const dockRect = dock.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const currentPos = resolveChatPosition(
        officeViewState.chatPosition,
        containerRect,
        dockRect.width,
        dockRect.height
      )

      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: currentPos.x,
        startPosY: currentPos.y,
      }
      setIsDragging(true)
    },
    [officeViewState.chatPosition]
  )

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dragState = dragStateRef.current
      const dock = chatDockRef.current
      const container = containerRef.current
      if (!dragState || !dock || !container) return

      const dockRect = dock.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const dx = e.clientX - dragState.startX
      const dy = e.clientY - dragState.startY
      const newPos = clampPosition(
        { x: dragState.startPosX + dx, y: dragState.startPosY + dy },
        containerRect,
        dockRect.width,
        dockRect.height
      )
      setOfficeViewState((current) => ({ ...current, chatPosition: newPos }))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStateRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, setOfficeViewState])

  // 计算浮窗位置
  const containerRect = containerRef.current?.getBoundingClientRect() ?? null
  const chatPosition = resolveChatPosition(
    officeViewState.chatPosition,
    containerRect,
    officeViewState.chatWidth,
    500
  )

  return (
    <div
      ref={containerRef}
      className="office-session-view h-full min-h-0 overflow-hidden"
      data-session-id={sessionId}
    >
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

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start p-4">
        <div className="office-session-hud pointer-events-auto min-w-0 max-w-[min(540px,60vw)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn('size-2 rounded-full', statusTone(status))} aria-hidden />
            <h1 className="truncate text-sm font-semibold text-foreground">
              {session?.title || '未命名办公室'}
            </h1>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {STATUS_LABELS[status]}
            </span>
            {board ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    disabled={loading}
                    className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-55"
                    aria-label="刷新办公室任务状态"
                  >
                    <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent>刷新办公室任务状态</TooltipContent>
              </Tooltip>
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
      </header>

      {officeViewState.chatCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOfficeViewState((current) => ({ ...current, chatCollapsed: false }))}
              className="office-session-chat-trigger absolute bottom-5 right-5 z-20 flex size-12 items-center justify-center rounded-full text-foreground transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="展开主 Agent 沟通窗"
            >
              <MessageSquareText className="size-5" aria-hidden />
              <span className={cn('absolute right-1 top-1 size-2 rounded-full', statusTone(status))} />
            </button>
          </TooltipTrigger>
          <TooltipContent>展开主 Agent 沟通窗</TooltipContent>
        </Tooltip>
      ) : (
        <section
          ref={chatDockRef}
          className={cn(
            'office-session-chat-dock absolute z-20 flex min-w-[328px] flex-col overflow-hidden',
            isDragging ? 'select-none cursor-grabbing' : ''
          )}
          aria-label="与主 Agent 沟通"
          style={{
            width: officeViewState.chatWidth,
            height: officeViewState.chatHeight,
            left: chatPosition.x,
            top: chatPosition.y,
          }}
        >
          <div className="office-session-chat-dock__header flex h-11 shrink-0 items-center justify-between px-3">
            <div className="flex min-w-0 items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={handleDragStart}
                    className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-muted hover:text-foreground"
                    aria-label="拖动沟通窗"
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent>拖动沟通窗</TooltipContent>
              </Tooltip>
              <MessageSquareText className="size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">总监沟通窗</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  同一会话 · {STATUS_LABELS[status]}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="沟通窗设置"
                  >
                    <MoreVertical className="size-4" aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" side="bottom" className="w-56 p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">内容大小</span>
                      <span className="text-xs text-muted-foreground">
                        {UI_SIZE_LABELS[officeViewState.chatUISize]}
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={2}
                      step={1}
                      value={[uiSizeToSlider(officeViewState.chatUISize)]}
                      onValueChange={([value]) => {
                        if (value !== undefined) {
                          setOfficeViewState((current) => ({
                            ...current,
                            chatUISize: sliderToUISize(value),
                          }))
                        }
                      }}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>小</span>
                      <span>中</span>
                      <span>大</span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={returnToClassic}
                    className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="在经典工作台中查看完整内容"
                  >
                    <PanelTopOpen className="size-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent>在经典工作台中查看完整内容</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() =>
                      setOfficeViewState((current) => ({ ...current, chatCollapsed: true }))
                    }
                    className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="收起沟通窗"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent>收起沟通窗</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div
            className={cn(
              'min-h-0 flex-1 overflow-hidden',
              officeViewState.chatUISize === 'small' && 'office-dock-size-small',
              officeViewState.chatUISize === 'large' && 'office-dock-size-large'
            )}
          >
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
