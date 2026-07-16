/**
 * KanbanCrewTaskList — 按人态分组的数字员工列表
 */

import * as React from 'react'
import { KanbanSquare } from 'lucide-react'

import type { KanbanTask } from '@tagent/shared'

import { KanbanTaskListItem } from './KanbanTaskListItem'
import { buildKanbanRoleInstanceLabels } from '@/lib/kanban-role-labels'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import { CREW_STATUS_GROUPS } from '@/lib/kanban-crew-status'
import { cn } from '@/lib/utils'

export interface KanbanCrewTaskListProps {
  tasks: KanbanTask[]
  /** grid：看板主页三列；stack：右栏/团队竖向 */
  layout?: 'grid' | 'stack'
  /** false 时不弹详情（由 onTaskClick 处理） */
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

  // 同角色在岗计数（每个 running task 有多少同 roleId 的 running 工友）
  const sameRoleActiveCountMap = React.useMemo(() => {
    // 统计每个 roleId 有多少 running tasks
    const runningCountByRole = new Map<string, number>()
    for (const task of tasks) {
      if (task.status === 'running' && task.roleId) {
        runningCountByRole.set(task.roleId, (runningCountByRole.get(task.roleId) ?? 0) + 1)
      }
    }
    // 每个 task 的 sameRoleActiveCount = 其 roleId 的 running 总数（≥2 才传）
    const map = new Map<string, number>()
    for (const task of tasks) {
      if (task.status === 'running' && task.roleId) {
        const count = runningCountByRole.get(task.roleId) ?? 1
        map.set(task.id, count)
      }
    }
    return map
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center px-4',
          className
        )}
      >
        <KanbanSquare className="size-10 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground mb-1">还没有数字员工上岗</p>
        <p className="text-[11px] text-muted-foreground/70 max-w-[220px]">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className, contentClassName)}>
      {CREW_STATUS_GROUPS.map(({ status, label, desc }) => {
        const groupTasks = tasks.filter((t) => t.status === status)
        if (groupTasks.length === 0) return null
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-1.5 px-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {groupTasks.length}
              </span>
              {layout === 'grid' && desc ? (
                <span className="text-[9px] text-muted-foreground/40">{desc}</span>
              ) : null}
            </div>
            <div
              className={cn(
                layout === 'grid' ? 'grid grid-cols-3 gap-2.5' : 'space-y-1.5'
              )}
            >
              {groupTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    selectedTaskId === task.id && 'ring-1 ring-primary/40 rounded-glass-popover'
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
          </div>
        )
      })}
    </div>
  )
}
