/**
 * KanbanRailContent — 对齐会话侧栏结构
 *
 * - sidebar-head + kicker + title（与「会话」同款）
 * - 角色库 = tool-cluster-accent（与「新会话」同级，不可忽略）
 * - 列表行 = session-row-shell + DropdownMenu 三点（与会话一致）
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { MoreVertical } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import type { KanbanBoardMode } from '@tagent/shared'

import { KanbanCreateBoardDialog } from './KanbanCreateBoardDialog'
import {
  useKanbanBoards,
  kanbanBoardsFilterAtom,
  selectedKanbanBoardIdAtom,
  kanbanActiveTabAtom,
} from '@/atoms/kanban-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

function formatBoardTime(updatedAt: number): string {
  const date = new Date(updatedAt)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const pad = (n: number): string => n.toString().padStart(2, '0')
  if (updatedAt >= todayStart) {
    return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  if (updatedAt >= yesterdayStart) {
    return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
}

function KanbanBoardItem({
  board,
  selected,
  onOpen,
  onRename,
  onDelete,
}: {
  board: {
    id: string
    title?: string
    rootGoal: string
    mode: string
    status: string
    updatedAt: number
  }
  selected: boolean
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}): React.ReactElement {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const displayName = board.title ?? board.rootGoal.slice(0, 40)
  const isCancelled = board.status === 'cancelled'

  const menuItems = (
    MenuItem: typeof ContextMenuItem | typeof DropdownMenuItem,
    MenuSeparator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
  ) => (
    <>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => onRename()}>
        重命名
      </MenuItem>
      <MenuSeparator className="my-0.5" />
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5 text-destructive"
        onSelect={() => onDelete()}
      >
        删除看板
      </MenuItem>
    </>
  )

  const row = (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'session-list-row session-row-shell app-sidebar-session-row group relative w-full min-w-0 titlebar-no-drag text-left',
        selected && 'session-list-item-active',
        isCancelled && 'opacity-50'
      )}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'min-w-0 transition-[padding] duration-150',
            'group-hover:pr-4'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-1.5 truncate text-[13px] leading-[18px]',
              !selected && 'text-foreground/80'
            )}
          >
            <span className={cn('min-w-0 flex-1 truncate', selected && 'session-row-title')}>
              {displayName}
            </span>
          </div>
          <div
            className={cn(
              'app-sidebar-session-detail mt-0.5 flex min-w-0 items-center justify-between gap-2 text-[9px]',
              selected ? 'session-row-meta' : 'md-text-faint'
            )}
          >
            <span className="truncate">
              {isCancelled ? '已取消' : board.mode === 'ta' ? 'TA 看板' : '通用看板'}
            </span>
            <span className="flex-shrink-0 tabular-nums">{formatBoardTime(board.updatedAt)}</span>
          </div>
        </div>
      </div>
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'rounded-md p-1 text-foreground/30 transition-colors hover:bg-foreground/[0.08] hover:text-foreground/60',
                'pointer-events-none opacity-0',
                'group-hover:pointer-events-auto group-hover:opacity-100',
                'data-[state=open]:pointer-events-auto data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100',
                menuOpen && 'pointer-events-auto opacity-100'
              )}
            >
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[9999] min-w-0 w-40 p-0.5">
            {menuItems(DropdownMenuItem, DropdownMenuSeparator)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent className="z-[9999] min-w-0 w-40 p-0.5">
        {menuItems(ContextMenuItem, ContextMenuSeparator)}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function KanbanRailContent(): React.ReactElement {
  const { boards, loading, filter, setFilter, refresh } = useKanbanBoards()
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const setStoredFilter = useSetAtom(kanbanBoardsFilterAtom)
  const selectedBoardId = useAtomValue(selectedKanbanBoardIdAtom)
  const setSelectedBoardId = useSetAtom(selectedKanbanBoardIdAtom)
  const activeTab = useAtomValue(kanbanActiveTabAtom)
  const setActiveTab = useSetAtom(kanbanActiveTabAtom)
  const rolesSelected = activeTab === 'roles'

  React.useEffect(() => {
    const modeFilter: KanbanBoardMode = topLevelMode === 'ta' ? 'ta' : 'general'
    if (filter.mode !== modeFilter) {
      const newFilter = { ...filter, mode: modeFilter }
      setFilter(newFilter)
      setStoredFilter(newFilter)
    }
  }, [topLevelMode, filter, setFilter, setStoredFilter])

  const [renameTarget, setRenameTarget] = React.useState<{ boardId: string; title: string } | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = React.useState<{ boardId: string; title: string } | null>(
    null
  )

  const handleOpen = (boardId: string): void => {
    setSelectedBoardId(boardId)
    setActiveTab('tasks')
  }

  const handleOpenRoles = (): void => {
    setSelectedBoardId(null)
    setActiveTab('roles')
  }

  const handleRenameSubmit = async (values: { title: string }): Promise<void> => {
    if (!renameTarget) return
    await window.electronAPI.kanban.updateBoard({
      boardId: renameTarget.boardId,
      title: values.title,
    })
    toast.success('已重命名')
    void refresh()
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await window.electronAPI.kanban.deleteBoard({ boardId: deleteTarget.boardId })
      toast.success('看板已删除（软删除，可恢复）')
      if (selectedBoardId === deleteTarget.boardId) {
        setSelectedBoardId(null)
      }
      void refresh()
    } catch (err) {
      console.error('[看板] 删除失败:', err)
      toast.error('删除失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <div className="sidebar-head titlebar-no-drag">
        <div className="sidebar-head-copy">
          <span className="sidebar-section-kicker">BOARDS</span>
          <h2 className="sidebar-head-title">看板</h2>
        </div>
        <div className="tool-cluster" role="group" aria-label="看板操作">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn('tool-cluster-accent', rolesSelected && 'is-active')}
                onClick={handleOpenRoles}
                aria-label="角色库 — 定义数字员工能力"
                aria-pressed={rolesSelected}
              >
                角色库
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">角色库 — 定义数字员工能力</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="app-spatial-session-well list-well min-h-0 flex-1">
        <div className="session-scroll scrollbar-thin min-h-0">
          {loading && boards.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : boards.length === 0 ? (
            <div className="px-2 py-10 text-center">
              <p className="text-xs text-muted-foreground">还没有看板</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">
                在会话里让 Agent 拆目标，或从草稿升级建板
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {boards.map((board) => (
                <KanbanBoardItem
                  key={board.id}
                  board={board}
                  selected={!rolesSelected && selectedBoardId === board.id}
                  onOpen={() => handleOpen(board.id)}
                  onRename={() =>
                    setRenameTarget({
                      boardId: board.id,
                      title: board.title ?? board.rootGoal,
                    })
                  }
                  onDelete={() =>
                    setDeleteTarget({
                      boardId: board.id,
                      title: board.title ?? board.rootGoal,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <KanbanCreateBoardDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        mode="rename"
        initialTitle={renameTarget?.title ?? ''}
        onSubmit={handleRenameSubmit}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除看板？</AlertDialogTitle>
            <AlertDialogDescription>
              将软删除看板「{deleteTarget?.title}」，看板及其任务不再显示，但数据保留可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteConfirm()}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
