/**
 * KanbanCrewPanel — 右栏班组墙（数字员工队列）
 *
 * 伴生面板：点员工只在面板内看摘要/进度，不切换主区会话。
 * 看板解析：主会话 boardId，工人会话回退 parentBoardId（避免切工人后空态）。
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { ArrowLeftRight, Building2, List, Unlink, Users } from 'lucide-react'
import { toast } from 'sonner'

import type { KanbanTask } from '@tagent/shared'

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { KanbanBoardToolbar, KanbanToolbarIconButton } from './KanbanBoardToolbar'
import { KanbanCrewTaskList } from './KanbanCrewTaskList'
import { KanbanSwitcherDialog } from './KanbanSwitcherDialog'
import { KanbanTaskDetailDialog } from './KanbanTaskDetailDialog'

import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'
import {
  selectedKanbanTaskIdAtomFamily,
  taskProgressLogsAtomFamily,
  useKanbanBoards,
  useKanbanCrewBoard,
} from '@/atoms/kanban-atoms'
import { CREW_STATUS_BADGE } from '@/lib/kanban-crew-status'
import { buildKanbanRoleInstanceLabels } from '@/lib/kanban-role-labels'
import { cn } from '@/lib/utils'

const AiOfficeContainer = React.lazy(() =>
  import('@/components/ai-office/AiOfficeContainer').then((module) => ({
    default: module.AiOfficeContainer,
  }))
)

function CrewTaskDetail({
  task,
  roleLabel,
  onShowDetail,
}: {
  task: KanbanTask
  roleLabel?: string
  onShowDetail: () => void
}): React.ReactElement {
  const progressLogs = useAtomValue(taskProgressLogsAtomFamily(task.id))
  const latestLog = progressLogs.length > 0 ? progressLogs[progressLogs.length - 1] : null
  const metaLogs = task.metadata?.progressLogs
  const latestMetaLog =
    Array.isArray(metaLogs) && metaLogs.length > 0 ? metaLogs[metaLogs.length - 1] : null
  const progressText = latestLog?.text || latestMetaLog?.text || ''

  return (
    <div className="shrink-0 border-t border-border/40 p-3 space-y-1.5 bg-background/60">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {roleLabel ? (
            <p className="text-[10px] text-muted-foreground truncate mb-0.5">{roleLabel}</p>
          ) : null}
          <span className="text-[11px] font-medium text-foreground truncate block">
            {task.title}
          </span>
        </div>
        <span
          className={cn(
            'text-[9px] px-1.5 py-0.5 rounded-full shrink-0',
            CREW_STATUS_BADGE[task.status].className
          )}
        >
          {CREW_STATUS_BADGE[task.status].label}
        </span>
      </div>

      {task.resultSummary ? (
        <p className="text-[10px] text-foreground/80 line-clamp-5 whitespace-pre-wrap">
          {task.resultSummary}
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground line-clamp-4 whitespace-pre-wrap">
          {task.body?.slice(0, 280) || '（尚无任务说明）'}
        </p>
      )}

      {progressText ? (
        <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 line-clamp-2">
          近况：{progressText}
        </p>
      ) : null}

      {task.error ? (
        <p className="text-[10px] text-red-600 dark:text-red-400 line-clamp-3">{task.error}</p>
      ) : null}

      {task.blockedReason ? (
        <p className="text-[10px] text-red-600/90 dark:text-red-400/90 line-clamp-3">
          求助：{task.blockedReason}
        </p>
      ) : null}

      <div className="flex gap-1.5 pt-0.5">
        {task.status === 'blocked' && (
          <Button
            size="sm"
            className="h-6 text-[10px] flex-1"
            onClick={() => {
              void window.electronAPI.kanban
                .unblockTask({ taskId: task.id })
                .then(() => toast.success('已解除阻塞'))
                .catch((err) =>
                  toast.error('解除失败', {
                    description: err instanceof Error ? err.message : undefined,
                  })
                )
            }}
          >
            解除阻塞
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-6 text-[10px] flex-1" onClick={onShowDetail}>
          查看详情
        </Button>
      </div>
    </div>
  )
}

type CrewViewMode = 'list' | 'office'

export function KanbanCrewPanel({ width }: { width?: number }): React.ReactElement {
  const [viewMode, setViewMode] = React.useState<CrewViewMode>('list')
  const sessionId = useAtomValue(currentAgentSessionIdAtom) ?? ''
  const { tasks, board, boardId, loading, refresh, isWorkerSession, ownerSessionId } =
    useKanbanCrewBoard(sessionId)
  const { boards } = useKanbanBoards()
  const roleMap = useAgentRoleMap()
  const roleLabels = React.useMemo(
    () => buildKanbanRoleInstanceLabels(tasks, roleMap),
    [tasks, roleMap]
  )
  const [selectedTaskId, setSelectedTaskId] = useAtom(selectedKanbanTaskIdAtomFamily(boardId ?? ''))
  const [switcherOpen, setSwitcherOpen] = React.useState(false)
  const [detailTask, setDetailTask] = React.useState<KanbanTask | null>(null)
  const resolvedDetailTask = React.useMemo(() => {
    if (!detailTask) return null
    return tasks.find((t) => t.id === detailTask.id) ?? detailTask
  }, [tasks, detailTask])

  const selectedTask = React.useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  )

  // 工人会话：自动高亮自己对应的任务
  const sourceTaskId = React.useMemo(() => {
    if (!isWorkerSession) return undefined
    return tasks.find((t) => t.assigneeSessionId === sessionId)?.id
  }, [isWorkerSession, tasks, sessionId])

  React.useEffect(() => {
    if (sourceTaskId && !selectedTaskId) {
      setSelectedTaskId(sourceTaskId)
    }
  }, [sourceTaskId, selectedTaskId, setSelectedTaskId])

  const handleTaskClick = React.useCallback(
    (task: KanbanTask) => {
      // running 任务直接弹详情（里面有工人实时对话）
      if (task.status === 'running') {
        setDetailTask(task)
        return
      }
      // 其他状态切换选中
      setSelectedTaskId(task.id === selectedTaskId ? null : task.id)
    },
    [selectedTaskId, setSelectedTaskId]
  )

  const handleShowDetail = React.useCallback((task: KanbanTask) => {
    setDetailTask(task)
  }, [])

  const handleOfficeTaskSelect = React.useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId)
      if (task) handleShowDetail(task)
    },
    [tasks, handleShowDetail]
  )

  const handleSwitchBoard = React.useCallback(
    async (targetBoardId: string) => {
      const bindSessionId = ownerSessionId ?? sessionId
      if (!bindSessionId || targetBoardId === boardId) {
        setSwitcherOpen(false)
        return
      }
      try {
        await window.electronAPI.kanban.attachBoardToSession({
          sessionId: bindSessionId,
          boardId: targetBoardId,
        })
        setSelectedTaskId(null)
        toast.success('已切换班组看板')
      } catch (err) {
        toast.error('切换失败', {
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setSwitcherOpen(false)
      }
    },
    [ownerSessionId, sessionId, boardId, setSelectedTaskId]
  )

  const handleDetach = React.useCallback(async () => {
    const bindSessionId = ownerSessionId ?? sessionId
    if (!bindSessionId) return
    try {
      await window.electronAPI.kanban.detachBoardFromSession({ sessionId: bindSessionId })
      setSelectedTaskId(null)
      toast.success('已解绑班组')
    } catch (err) {
      toast.error('解绑失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }, [ownerSessionId, sessionId, setSelectedTaskId])

  if (!boardId || !board) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center"
        style={width ? { width } : undefined}
      >
        <Users className="size-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">当前会话还没有班组</p>
        <p className="text-[11px] text-muted-foreground/70">
          在对话里让主 Agent 点将派活后，数字员工会出现在这里
        </p>
      </div>
    )
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length

  return (
    <div
      className="h-full flex flex-col min-h-0 bg-background/40"
      style={width ? { width } : undefined}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 shrink-0">
        <Users className="size-3.5 text-foreground/60" />
        <span className="text-xs font-medium text-foreground truncate">
          {board.title ?? board.rootGoal.slice(0, 40)}
        </span>
        {isWorkerSession ? (
          <span className="text-[9px] text-muted-foreground/70 shrink-0">工人视角</span>
        ) : null}
      </div>

      <KanbanBoardToolbar
        boardId={board.id}
        maxConcurrent={board.maxConcurrent ?? 3}
        paused={board.paused ?? false}
        requireSummary={board.requireSummary}
        doneCount={doneCount}
        totalCount={tasks.length}
        loading={loading}
        onRefresh={() => void refresh()}
        extraActions={
          isWorkerSession ? null : (
            <>
              {/* View toggle: list / office */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setViewMode(viewMode === 'list' ? 'office' : 'list')}
                    className="rail-island-btn size-7 flex items-center justify-center rounded-[8px]"
                    title={viewMode === 'list' ? '切换到办公室视图' : '切换到列表视图'}
                  >
                    {viewMode === 'list' ? (
                      <Building2 size={13} strokeWidth={1.75} />
                    ) : (
                      <List size={13} strokeWidth={1.75} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {viewMode === 'list' ? '办公室视图' : '列表视图'}
                </TooltipContent>
              </Tooltip>
              <KanbanToolbarIconButton
                icon={ArrowLeftRight}
                title="切换看板"
                onClick={() => setSwitcherOpen(true)}
              />
              <KanbanToolbarIconButton
                icon={Unlink}
                title="解绑班组"
                onClick={() => void handleDetach()}
                danger
              />
            </>
          )
        }
      />

      {viewMode === 'list' ? (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2.5">
          <KanbanCrewTaskList
            tasks={tasks}
            layout="stack"
            showDetailDialog={false}
            onTaskClick={handleTaskClick}
            selectedTaskId={selectedTaskId}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <React.Suspense
            fallback={
              <div
                className="flex h-full items-center justify-center text-xs text-muted-foreground"
                role="status"
              >
                正在布置办公室…
              </div>
            }
          >
            <AiOfficeContainer tasks={tasks} onTaskSelect={handleOfficeTaskSelect} />
          </React.Suspense>
        </div>
      )}

      {selectedTask ? (
        <CrewTaskDetail
          task={selectedTask}
          roleLabel={roleLabels.get(selectedTask.id)}
          onShowDetail={() => handleShowDetail(selectedTask)}
        />
      ) : null}

      <KanbanSwitcherDialog
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        boards={boards}
        currentBoardId={boardId}
        onSelect={handleSwitchBoard}
      />

      {resolvedDetailTask && (
        <KanbanTaskDetailDialog
          task={resolvedDetailTask}
          open={!!resolvedDetailTask}
          onOpenChange={(open) => {
            if (!open) setDetailTask(null)
          }}
          roleLabel={roleLabels.get(resolvedDetailTask.id)}
        />
      )}
    </div>
  )
}
