/**
 * KanbanMainView — 看板主区（spatial 工作场）
 *
 * 砍掉：面包屑、文档头、进度条、「完成后汇总」、分组标题、独立工具条。
 * 保留：板名、暂停、更多（刷新/并发）、班组场（忙碌工牌 + 一行流）。
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  Gauge,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'

import { KanbanCrewTaskList } from './KanbanCrewTaskList'
import { KanbanSwitcherDialog } from './KanbanSwitcherDialog'
import { RoleLibraryPanel } from './RoleLibraryPanel'
import { Panel } from '@/components/app-shell/Panel'
import {
  selectedKanbanBoardIdAtom,
  useKanbanBoards,
  useSelectedKanbanBoard,
  kanbanActiveTabAtom,
} from '@/atoms/kanban-atoms'
import { detectIsMac, detectIsWindows } from '@/lib/platform'
import { cn } from '@/lib/utils'

function BoardChrome({
  title,
  meta,
  paused,
  loading,
  onPauseResume,
  onRefresh,
  maxConcurrent,
  boardId,
}: {
  title: string
  meta?: string
  paused: boolean
  loading: boolean
  onPauseResume: () => void
  onRefresh: () => void
  maxConcurrent: number
  boardId: string
}): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])
  const isWindows = React.useMemo(() => detectIsWindows(), [])

  return (
    <div
      className={cn(
        'relative shrink-0 px-5 pb-3 pt-4',
        !isMac && 'pt-7',
        isWindows && 'pr-[134px]'
      )}
    >
      <div
        className="absolute inset-0 z-[1] titlebar-drag-region"
        style={isWindows ? { right: 126 } : undefined}
        aria-hidden
      />
      <div className="relative z-[2] flex items-start justify-between gap-3 titlebar-no-drag">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {meta ? (
            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{meta}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-[36px] rounded-full p-0 text-foreground/60 hover:text-foreground"
                onClick={onPauseResume}
                aria-label={paused ? '继续调度' : '暂停调度'}
              >
                {paused ? (
                  <Play className="size-3.5 text-amber-500" />
                ) : (
                  <Pause className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {paused ? '继续调度' : '暂停调度'}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-[36px] rounded-full p-0 text-foreground/60 hover:text-foreground"
                    aria-label="更多"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">更多</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="z-[9999] min-w-[160px]">
              <DropdownMenuItem
                className="gap-2 text-xs"
                onClick={() => onRefresh()}
              >
                <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
                刷新
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] text-muted-foreground">并发上限</div>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <DropdownMenuItem
                  key={n}
                  className={cn(
                    'justify-between text-xs',
                    maxConcurrent === n && 'bg-foreground/[0.06]'
                  )}
                  onClick={() => {
                    void window.electronAPI.kanban
                      .updateBoard({ boardId, maxConcurrent: n })
                      .then(() => toast.success(`并发上限 ${n}`))
                      .catch((err) =>
                        toast.error('调整失败', {
                          description: err instanceof Error ? err.message : undefined,
                        })
                      )
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="size-3" />
                    {n}
                  </span>
                  {maxConcurrent === n ? (
                    <span className="text-[10px] text-muted-foreground">当前</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export function KanbanMainView(): React.ReactElement {
  const selectedBoardId = useAtomValue(selectedKanbanBoardIdAtom)
  const setSelectedBoardId = useSetAtom(selectedKanbanBoardIdAtom)
  const { board, tasks, loading, refresh } = useSelectedKanbanBoard(selectedBoardId)
  const { boards } = useKanbanBoards()
  const [switcherOpen, setSwitcherOpen] = React.useState(false)
  const activeTab = useAtomValue(kanbanActiveTabAtom)
  const isMac = React.useMemo(() => detectIsMac(), [])
  const isWindows = React.useMemo(() => detectIsWindows(), [])

  if (activeTab === 'roles') {
    return (
      <Panel variant="grow" className="content-glass">
        <div
          className={cn(
            'relative shrink-0 px-5 pb-2 pt-4',
            !isMac && 'pt-7',
            isWindows && 'pr-[134px]'
          )}
        >
          <div
            className="absolute inset-0 z-[1] titlebar-drag-region"
            style={isWindows ? { right: 126 } : undefined}
            aria-hidden
          />
          <h1 className="relative z-[2] text-[17px] font-semibold tracking-tight titlebar-no-drag">
            角色库
          </h1>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <RoleLibraryPanel />
        </div>
      </Panel>
    )
  }

  if (!selectedBoardId) {
    return (
      <Panel variant="grow" className="content-glass">
        <div className={cn('relative shrink-0 px-5 pt-4', !isMac && 'pt-7')}>
          <div className="absolute inset-0 titlebar-drag-region" aria-hidden />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="max-w-xs px-6 text-center">
            <p className="text-sm text-muted-foreground">从左侧选一块板</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/65">
              看板由会话里的 Agent 拆目标生成，或从草稿升级
            </p>
          </div>
        </div>
      </Panel>
    )
  }

  if (loading && !board) {
    return (
      <Panel variant="grow" className="content-glass">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </Panel>
    )
  }

  if (!board) {
    return (
      <Panel variant="grow" className="content-glass">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm text-muted-foreground">这块板不在了</p>
          <Button variant="ghost" size="sm" onClick={() => setSelectedBoardId(null)}>
            返回
          </Button>
        </div>
      </Panel>
    )
  }

  const displayName = board.title ?? board.rootGoal.slice(0, 60)
  const done = tasks.filter((t) => t.status === 'done').length
  const live = tasks.filter((t) =>
    t.status === 'running' || t.status === 'blocked' || t.status === 'review'
  ).length
  const metaParts = [
    `${done}/${tasks.length}`,
    live > 0 ? `${live} 人在岗` : null,
    board.paused ? '已暂停' : null,
  ].filter(Boolean)

  const handlePauseResume = async (): Promise<void> => {
    try {
      if (board.paused) {
        await window.electronAPI.kanban.resumeBoard(board.id)
        toast.success('已恢复')
      } else {
        await window.electronAPI.kanban.pauseBoard(board.id)
        toast.success('已暂停')
      }
    } catch (err) {
      toast.error('操作失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <Panel variant="grow" className="content-glass">
      <BoardChrome
        title={displayName}
        meta={metaParts.join(' · ')}
        paused={board.paused ?? false}
        loading={loading}
        onPauseResume={() => void handlePauseResume()}
        onRefresh={() => void refresh()}
        maxConcurrent={board.maxConcurrent ?? 3}
        boardId={board.id}
      />
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <KanbanCrewTaskList
          tasks={tasks}
          layout="grid"
          emptyHint="在会话里让主 Agent 点将派活"
          className="kanban-crew-field px-4 pb-10 pt-1"
        />
      </div>
      <KanbanSwitcherDialog
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        boards={boards}
        currentBoardId={board.id}
        onSelect={async (targetBoardId) => {
          setSelectedBoardId(targetBoardId)
          setSwitcherOpen(false)
        }}
      />
    </Panel>
  )
}
