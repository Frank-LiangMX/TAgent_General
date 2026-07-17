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
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import { buildKanbanRoleInstanceLabels } from '@/lib/kanban-role-labels'
import { cn } from '@/lib/utils'

import './ai-office.css'

interface AiOfficeContainerProps {
  tasks: KanbanTask[]
  className?: string
  width?: number
  onTaskSelect?: (taskId: string) => void
}

export function AiOfficeContainer({
  tasks,
  className,
  width,
  onTaskSelect,
}: AiOfficeContainerProps) {
  const roleMap = useAgentRoleMap()
  const [liveProgressByTaskId, setLiveProgressByTaskId] = React.useState<
    Map<string, ProgressLogEntry>
  >(new Map())
  const taskIds = React.useMemo(() => new Set(tasks.map((task) => task.id)), [tasks])
  const roleLabels = React.useMemo(
    () => buildKanbanRoleInstanceLabels(tasks, roleMap),
    [tasks, roleMap]
  )

  React.useEffect(() => {
    return window.electronAPI.kanban.onTaskProgress((payload: TaskProgressPayload) => {
      if (!taskIds.has(payload.taskId)) return
      setLiveProgressByTaskId((current) => {
        const next = new Map(current)
        next.set(payload.taskId, payload.entry)
        return next
      })
    })
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

  return (
    <div
      className={cn('relative h-full flex flex-col bg-background/40', className)}
      style={width ? { width } : undefined}
    >
      <AiOfficeCanvas externalAgents={projection.agents} onAgentSelect={onTaskSelect} />
      {projection.hiddenCount > 0 ? (
        <div className="ai-office-overflow" aria-label={`${projection.hiddenCount} 个任务未显示`}>
          +{projection.hiddenCount} 个任务
        </div>
      ) : null}
    </div>
  )
}
