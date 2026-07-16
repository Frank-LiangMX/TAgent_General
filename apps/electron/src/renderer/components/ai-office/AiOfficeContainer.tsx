/**
 * AiOfficeContainer — 外层容器，连接 KanbanTask 到 OfficeScene
 *
 * 接收 boardId + tasks，将 KanbanTask 映射为 OfficeAgent，
 * 然后传给 AiOfficeCanvas 渲染虚拟办公室。
 */
import * as React from 'react'

import type { KanbanTask } from '@tagent/shared'

import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import { cn } from '@/lib/utils'

import { AiOfficeCanvas } from './AiOfficeCanvas'
import type { OfficeAgent } from './types/office-agent'
import { INITIAL_AGENTS } from './scene/layout/officeLayout'
import './ai-office.css'

/** Map KanbanTask status to OfficeAgent state */
function taskStatusToState(status: string): OfficeAgent['state'] {
  switch (status) {
    case 'running':
      return 'working'
    case 'blocked':
      return 'thinking'
    case 'pending':
    case 'queued':
      return 'idle'
    case 'done':
    case 'failed':
      return 'idle'
    default:
      return 'idle'
  }
}

/** Map KanbanTask[] to OfficeAgent[] */
function mapTasksToAgents(
  tasks: KanbanTask[],
  roleMap: Map<string, string>,
): OfficeAgent[] {
  // Start with initial agents as base
  const agents = INITIAL_AGENTS.map((a) => ({ ...a }))

  // Map tasks to agents by roster index (1-based)
  for (let i = 0; i < Math.min(tasks.length, agents.length); i++) {
    const task = tasks[i]
    const agent = agents[i]
    if (!task || !agent) continue

    const state = taskStatusToState(task.status)

    agent.state = state
    agent.currentTask = state === 'idle' ? undefined : task.title
    // Reset walk state when status changes
    agent.targetX = undefined
    agent.targetY = undefined
    agent.walkPath = undefined
    agent.walkPathIndex = undefined
    agent.mission = undefined
    agent.bubbleText = undefined
    agent.customAnimation = undefined
    agent.viewFacing = state === 'working' || state === 'thinking'
      ? 'back'
      : agent.viewFacing
  }

  return agents
}

interface AiOfficeContainerProps {
  tasks: KanbanTask[]
  className?: string
  width?: number
}

export function AiOfficeContainer({
  tasks,
  className,
  width,
}: AiOfficeContainerProps) {
  const roleMap = useAgentRoleMap()

  const officeAgents = React.useMemo(
    () => mapTasksToAgents(tasks, roleMap),
    [tasks, roleMap],
  )

  return (
    <div
      className={cn(
        'h-full flex flex-col bg-background/40',
        className,
      )}
      style={width ? { width } : undefined}
    >
      <AiOfficeCanvas externalAgents={officeAgents} />
    </div>
  )
}
