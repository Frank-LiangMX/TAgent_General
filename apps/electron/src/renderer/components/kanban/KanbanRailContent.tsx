/**
 * KanbanRailContent — 侧栏看板列表 + 角色库入口
 *
 * 2026-07-07 改动：
 * - 添加角色库入口按钮（在标题栏下方）
 * - 移除模式筛选 Tab，根据 topLevelMode 自动过滤
 * - 点击角色库按钮切换主区到角色库 Tab
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { KanbanSquare, MoreHorizontal, Trash2, Pencil, Users } from 'lucide-react'
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
  Button,
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
/** 看板列表项 */
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

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors',
        selected ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'hover:bg-muted/40',
        isCancelled && 'opacity-50'
      )}
      onClick={onOpen}
    >
      <div className="flex size-7 items-center justify-center rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
        <KanbanSquare className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">{displayName}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span>{board.mode === 'ta' ? 'TA' : '通用'}</span>
          <span>·</span>
          <span>
            {new Date(board.updatedAt).toLocaleDateString('zh-CN', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          {isCancelled && (
            <>
              <span>·</span>
              <span className="text-red-500">已取消</span>
            </>
          )}
        </div>
      </div>
      <div
        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((v) => !v)
        }}
      >
        {menuOpen ? (
          <div className="flex items-center gap-0.5">
            <button
              className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onRename()
              }}
              title="重命名"
            >
              <Pencil className="size-3" />
            </button>
            <button
              className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onDelete()
              }}
              title="删除"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ) : (
          <button className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// 局部 cn 实现已移除，改用 @/lib/utils 标准实现

export function KanbanRailContent(): React.ReactElement {
  const { boards, loading, filter, setFilter, refresh } = useKanbanBoards()
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const setStoredFilter = useSetAtom(kanbanBoardsFilterAtom)
  const selectedBoardId = useAtomValue(selectedKanbanBoardIdAtom)
  const setSelectedBoardId = useSetAtom(selectedKanbanBoardIdAtom)
  const setActiveTab = useSetAtom(kanbanActiveTabAtom)

  // 根据顶层模式自动过滤看板（无手动筛选）
  React.useEffect(() => {
    const modeFilter: KanbanBoardMode = topLevelMode === 'ta' ? 'ta' : 'general'
    if (filter.mode !== modeFilter) {
      const newFilter = { ...filter, mode: modeFilter }
      setFilter(newFilter)
      setStoredFilter(newFilter)
    }
  }, [topLevelMode, filter, setFilter, setStoredFilter])

  // Dialog 状态：重命名 / 删除
  const [renameTarget, setRenameTarget] = React.useState<{ boardId: string; title: string } | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = React.useState<{ boardId: string; title: string } | null>(
    null
  )

  const handleOpen = (boardId: string): void => {
    setSelectedBoardId(boardId)
    setActiveTab('tasks') // 打开看板时切换到任务 Tab
  }

  const handleOpenRoles = (): void => {
    setSelectedBoardId(null) // 清空选中看板
    setActiveTab('roles') // 切换到角色库 Tab
  }

  const handleRenameClick = (boardId: string, currentTitle: string): void => {
    setRenameTarget({ boardId, title: currentTitle })
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

  const handleDeleteClick = (boardId: string, title: string): void => {
    setDeleteTarget({ boardId, title })
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
    <div className="flex h-full flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <KanbanSquare className="size-3.5 text-foreground/60" />
          <span className="text-xs font-medium text-foreground">看板</span>
          {boards.length > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{boards.length}</span>
          )}
        </div>
      </div>

      {/* 角色库入口按钮 */}
      <div className="px-3 pb-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs justify-start gap-2"
          onClick={handleOpenRoles}
        >
          <Users className="size-3.5" />
          <span>角色库</span>
        </Button>
      </div>

      {/* 看板列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
        {loading && boards.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="size-4 animate-spin border-2 border-muted-foreground border-t-transparent rounded-full" />
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <KanbanSquare className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground mb-1">
              {topLevelMode === 'ta' ? 'TA 模式暂无看板' : '通用模式暂无看板'}
            </p>
            <p className="text-[10px] text-muted-foreground/70 max-w-[200px] leading-relaxed">
              在会话里告诉 Agent 你的目标让其自动拆解，或在草稿页拆解需求后升级建板。
            </p>
          </div>
        ) : (
          boards.map((board) => (
            <KanbanBoardItem
              key={board.id}
              board={board}
              selected={selectedBoardId === board.id}
              onOpen={() => handleOpen(board.id)}
              onRename={() => handleRenameClick(board.id, board.title ?? board.rootGoal)}
              onDelete={() => handleDeleteClick(board.id, board.title ?? board.rootGoal)}
            />
          ))
        )}
      </div>

      {/* 重命名看板 Dialog */}
      <KanbanCreateBoardDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        mode="rename"
        initialTitle={renameTarget?.title ?? ''}
        onSubmit={handleRenameSubmit}
      />

      {/* 删除看板确认 */}
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
            <AlertDialogAction onClick={handleDeleteConfirm}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
