/**
 * AiOfficeContainer — 外层容器，连接 KanbanTask 到 OfficeScene
 *
 * 接收 boardId + tasks，将 KanbanTask 映射为 OfficeAgent，
 * 然后传给 AiOfficeCanvas 渲染虚拟办公室。
 */
import * as React from 'react'

import type { KanbanTask, ProgressLogEntry, TaskProgressPayload } from '@tagent/shared'

import { AiOfficeCanvas } from './AiOfficeCanvas'
import { projectKanbanWorkers } from './officeWorkerProjection'
import { DESKS } from './scene/layout/officeLayout'
import type { OfficeAgent } from './types/office-agent'
import type { OfficeCameraState, OfficeMotionMode } from '@/atoms/session-presentation-atoms'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import { buildKanbanRoleInstanceLabels } from '@/lib/kanban-role-labels'
import { cn } from '@/lib/utils'

import './ai-office.css'

interface AiOfficeContainerProps {
  tasks: KanbanTask[]
  className?: string
  width?: number
  onTaskSelect?: (taskId: string) => void
  /** Stable non-worker actors, currently the main-session director. */
  leadingAgents?: OfficeAgent[]
  /** Desk slots reserved by leading actors. */
  reservedDeskCount?: number
  cameraState?: OfficeCameraState
  onCameraChange?: (state: OfficeCameraState) => void
  motionMode?: OfficeMotionMode
  onFallbackClassic?: () => void
}

export function AiOfficeContainer({
  tasks,
  className,
  width,
  onTaskSelect,
  leadingAgents = [],
  reservedDeskCount = 0,
  cameraState,
  onCameraChange,
  motionMode,
  onFallbackClassic,
}: AiOfficeContainerProps) {
  const roleMap = useAgentRoleMap()
  const [liveProgressByTaskId, setLiveProgressByTaskId] = React.useState<
    Map<string, ProgressLogEntry>
  >(new Map())
  const pendingProgressRef = React.useRef(new Map<string, ProgressLogEntry>())
  const progressFrameRef = React.useRef<number | null>(null)
  const taskIds = React.useMemo(() => new Set(tasks.map((task) => task.id)), [tasks])
  const roleLabels = React.useMemo(
    () => buildKanbanRoleInstanceLabels(tasks, roleMap),
    [tasks, roleMap]
  )

  React.useEffect(() => {
    const unsubscribe = window.electronAPI.kanban.onTaskProgress((payload: TaskProgressPayload) => {
      if (!taskIds.has(payload.taskId)) return
      pendingProgressRef.current.set(payload.taskId, payload.entry)
      if (progressFrameRef.current != null) return
      progressFrameRef.current = requestAnimationFrame(() => {
        progressFrameRef.current = null
        const pending = pendingProgressRef.current
        pendingProgressRef.current = new Map()
        setLiveProgressByTaskId((current) => {
          const next = new Map(current)
          for (const [taskId, entry] of pending) next.set(taskId, entry)
          return next
        })
      })
    })
    return () => {
      unsubscribe()
      if (progressFrameRef.current != null) cancelAnimationFrame(progressFrameRef.current)
      progressFrameRef.current = null
      pendingProgressRef.current.clear()
    }
  }, [taskIds])

  React.useEffect(() => {
    setLiveProgressByTaskId((current) => {
      const next = new Map([...current].filter(([taskId]) => taskIds.has(taskId)))
      return next.size === current.size ? current : next
    })
  }, [taskIds])

  const projection = React.useMemo(
    () => projectKanbanWorkers(tasks, roleLabels, liveProgressByTaskId),
    [tasks, roleLabels, liveProgressByTaskId]
  )

  const sceneProjection = React.useMemo(() => {
    const reserved = Math.max(0, Math.min(reservedDeskCount, DESKS.length))
    const workerCapacity = Math.max(0, DESKS.length - reserved)
    const visibleWorkers = projection.agents.slice(0, workerCapacity).map((agent, index) => {
      const desk = DESKS[index + reserved]!
      return {
        ...agent,
        assignedDeskId: desk.id,
        x: desk.seatX,
        y: desk.seatY,
      }
    })

    return {
      agents: [...leadingAgents, ...visibleWorkers],
      hiddenCount:
        projection.hiddenCount + Math.max(0, projection.agents.length - visibleWorkers.length),
    }
  }, [leadingAgents, projection, reservedDeskCount])

  return (
    <div
      className={cn('relative h-full flex flex-col bg-background/40', className)}
      style={width ? { width } : undefined}
    >
      <AiOfficeCanvas
        externalAgents={sceneProjection.agents}
        onAgentSelect={onTaskSelect}
        cameraState={cameraState}
        onCameraChange={onCameraChange}
        motionMode={motionMode}
        onFallbackClassic={onFallbackClassic}
      />
      {sceneProjection.hiddenCount > 0 || projection.unassignedCount > 0 ? (
        <div
          className="ai-office-overflow"
          aria-label={`${sceneProjection.hiddenCount} 名员工未显示，${projection.unassignedCount} 个任务待分配`}
        >
          {sceneProjection.hiddenCount > 0 ? `+${sceneProjection.hiddenCount} 名员工` : null}
          {sceneProjection.hiddenCount > 0 && projection.unassignedCount > 0 ? ' · ' : null}
          {projection.unassignedCount > 0 ? `${projection.unassignedCount} 个任务待分配` : null}
        </div>
      ) : null}
    </div>
  )
}
