/**
 * SessionTeamTab — 会话内班组页（已降级）
 *
 * 历史：Master-Detail + 嵌套 AgentView。
 * 现主路径为右栏 KanbanCrewPanel；本组件仅作整页兜底，
 * 不再嵌套 AgentView（点员工 → 打开工人会话 Tab）。
 */

import * as React from 'react'
import { useAtom } from 'jotai'
import { ArrowLeftRight, Unlink } from 'lucide-react'
import { toast } from 'sonner'

import type { KanbanTask } from '@tagent/shared'

import { Button } from '@tagent/ui'
import {
  selectedKanbanTaskIdAtomFamily,
  useKanbanBoard,
  useKanbanBoards,
} from '@/atoms/kanban-atoms'
import { Panel } from '@/components/app-shell/Panel'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { CREW_STATUS_BADGE } from '@/lib/kanban-crew-status'
import { KanbanBoardToolbar, KanbanToolbarIconButton } from './KanbanBoardToolbar'
import { KanbanCrewTaskList } from './KanbanCrewTaskList'
import { KanbanSwitcherDialog } from './KanbanSwitcherDialog'

export interface SessionTeamTabProps {
  sessionId: string
  boardId: string
}

export function SessionTeamTab({ sessionId, boardId }: SessionTeamTabProps): React.ReactElement {
  const { tasks, board, loading, refresh } = useKanbanBoard(sessionId)
  const [selectedTaskId, setSelectedTaskId] = useAtom(selectedKanbanTaskIdAtomFamily(boardId))
  const [switcherOpen, setSwitcherOpen] = React.useState(false)
  const { boards } = useKanbanBoards()
  const isMac = React.useMemo(() => detectIsMac(), [])

  const selectedTask = React.useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  )

  const handleTaskClick = React.useCallback(
    (task: KanbanTask) => {
      setSelectedTaskId(task.id === selectedTaskId ? null : task.id)
    },
    [selectedTaskId, setSelectedTaskId]
  )

  const handleSwitchBoard = async (targetBoardId: string): Promise<void> => {
    if (targetBoardId === boardId) {
      setSwitcherOpen(false)
      return
    }
    try {
      await window.electronAPI.kanban.attachBoardToSession({
        sessionId,
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
  }

  const handleDetach = async (): Promise<void> => {
    try {
      await window.electronAPI.kanban.detachBoardFromSession({ sessionId })
      setSelectedTaskId(null)
      toast.success('已解绑班组')
    } catch (err) {
      toast.error('解绑失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  if (!board) {
    return (
      <Panel variant="grow" className="content-glass">
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          {loading ? '加载班组…' : '看板不存在或已解绑'}
        </div>
      </Panel>
    )
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length

  return (
    <Panel variant="grow" className="content-glass">
      <div className={cn('border-b border-border/40 px-4 py-2', !isMac && 'pt-6')}>
        <div className="text-xs font-medium text-foreground truncate">
          {board.title ?? board.rootGoal.slice(0, 60)}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          建议使用右侧「班组」面板盯进度；此处为整页兜底
        </p>
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
        className="px-4"
        extraActions={
          <>
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
        }
      />

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin p-3">
          <KanbanCrewTaskList
            tasks={tasks}
            layout="stack"
            showDetailDialog={false}
            onTaskClick={handleTaskClick}
            selectedTaskId={selectedTaskId}
          />
        </div>

        {selectedTask && (
          <div className="w-[280px] shrink-0 border-l border-border/40 p-3 space-y-2 overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium truncate">{selectedTask.title}</span>
              <span
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full shrink-0',
                  CREW_STATUS_BADGE[selectedTask.status].className
                )}
              >
                {CREW_STATUS_BADGE[selectedTask.status].label}
              </span>
            </div>
            {selectedTask.resultSummary ? (
              <p className="text-[11px] text-foreground/80 whitespace-pre-wrap">
                {selectedTask.resultSummary}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                {selectedTask.body || '（尚无任务说明）'}
              </p>
            )}
            {selectedTask.error ? (
              <p className="text-[11px] text-red-600 dark:text-red-400">{selectedTask.error}</p>
            ) : null}
            {selectedTask.blockedReason ? (
              <p className="text-[11px] text-red-600/90 dark:text-red-400/90">
                求助：{selectedTask.blockedReason}
              </p>
            ) : null}
            {selectedTask.status === 'blocked' && (
              <Button
                size="sm"
                className="h-7 text-[11px] w-full"
                onClick={() => {
                  void window.electronAPI.kanban
                    .unblockTask({ taskId: selectedTask.id })
                    .then(() => toast.success('已解除阻塞'))
                    .catch((err) =>
                      toast.error('解除失败', {
                        description: err instanceof Error ? err.message : undefined,
                      })
                    )
                }}
              >
                解除阻塞，继续上岗
              </Button>
            )}
          </div>
        )}
      </div>

      <KanbanSwitcherDialog
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        boards={boards}
        currentBoardId={boardId}
        onSelect={(id) => void handleSwitchBoard(id)}
      />
    </Panel>
  )
}
