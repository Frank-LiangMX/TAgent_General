/**
 * KanbanCrewTaskList — 完整工牌网格（按人态分组，无砍内容）
 */

import * as React from 'react'

import type { KanbanTask } from '@tagent/shared'

import { KanbanTaskListItem } from './KanbanTaskListItem'
import { buildKanbanRoleInstanceLabels } from '@/lib/kanban-role-labels'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import { CREW_STATUS_GROUPS } from '@/lib/kanban-crew-status'
import { cn } from '@/lib/utils'

export interface KanbanCrewTaskListProps {
  tasks: KanbanTask[]
  layout?: 'grid' | 'stack'
  showDetailDialog?: boolean
  onTaskClick?: (task: KanbanTask) => void
  selectedTaskId?: string | null
  emptyHint?: string
  className?: string
  contentClassName?: string
}

export function KanbanCrewTaskList({
  tasks,
  layout = 'stack',
  showDetailDialog = true,
  onTaskClick,
  selectedTaskId,
  emptyHint = '在对话里让主 Agent 点将派活',
  className,
  contentClassName,
}: KanbanCrewTaskListProps): React.ReactElement {
  const roleMap = useAgentRoleMap()
  const roleLabels = React.useMemo(
    () => buildKanbanRoleInstanceLabels(tasks, roleMap),
    [tasks, roleMap]
  )

  const sameRoleActiveCountMap = React.useMemo(() => {
    const runningCountByRole = new Map<string, number>()
    for (const task of tasks) {
      if (task.status === 'running' && task.roleId) {
        runningCountByRole.set(task.roleId, (runningCountByRole.get(task.roleId) ?? 0) + 1)
      }
    }
    const map = new Map<string, number>()
    for (const task of tasks) {
      if (task.status === 'running' && task.roleId) {
        map.set(task.id, runningCountByRole.get(task.roleId) ?? 1)
      }
    }
    return map
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center px-4 py-20 text-center',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">还没有人上岗</p>
        <p className="mt-1 max-w-[240px] text-[11px] text-muted-foreground/65">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className, contentClassName)}>
      {CREW_STATUS_GROUPS.map(({ status, label }) => {
        const groupTasks = tasks.filter((t) => t.status === status)
        if (groupTasks.length === 0) return null
        return (
          <section key={status}>
            <div className="mb-2 flex items-baseline gap-2 px-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground/55">
                {groupTasks.length}
              </span>
            </div>
            <div
              className={cn(
                layout === 'grid'
                  ? 'grid grid-cols-[repeat(auto-fill,280px)] items-stretch gap-3'
                  : 'space-y-2'
              )}
            >
              {groupTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'h-full min-h-0',
                    selectedTaskId === task.id && 'ring-1 ring-foreground/15 rounded-[18px]'
                  )}
                  onClick={onTaskClick ? () => onTaskClick(task) : undefined}
                  onKeyDown={
                    onTaskClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onTaskClick(task)
                          }
                        }
                      : undefined
                  }
                  role={onTaskClick ? 'button' : undefined}
                  tabIndex={onTaskClick ? 0 : undefined}
                >
                  <KanbanTaskListItem
                    task={task}
                    roleLabel={roleLabels.get(task.id)}
                    sameRoleActiveCount={sameRoleActiveCountMap.get(task.id)}
                    showDetailDialog={showDetailDialog && !onTaskClick}
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
