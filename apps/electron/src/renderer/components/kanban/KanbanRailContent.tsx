/**
 * KanbanRailContent — 侧栏全局看板列表（B4）
 *
 * 列出所有看板（按 mode 过滤），点击进入看板详情。
 * 不依赖会话，看板作为独立实体存在。
 *
 * 三系统关系调整（2026-07-01）：看板页不再支持建板，
 * 任务只从会话（Agent 拆解）或草稿（用户拆 + 计划层）来。
 * 列表为纯监控视图，空态引导去会话或草稿。
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { KanbanSquare, MoreHorizontal, Trash2, Pencil } from 'lucide-react'
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
} from '@tagent/ui'
import type { KanbanBoardMode } from '@tagent/shared'

import {
  useKanbanBoards,
  kanbanBoardsFilterAtom,
  selectedKanbanBoardIdAtom,
} from '@/atoms/kanban-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'
import { KanbanCreateBoardDialog } from './KanbanCreateBoardDialog'
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

  // 首次挂载时按当前模式初始化过滤（用 ref 避免点「全部」后被重置）
  const initializedRef = React.useRef(false)
  React.useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    if (!filter.mode) {
      const modeFilter: KanbanBoardMode = topLevelMode === 'ta' ? 'ta' : 'general'
      const newFilter = { ...filter, mode: modeFilter }
      setFilter(newFilter)
      setStoredFilter(newFilter)
    }
  }, [topLevelMode, filter, setFilter, setStoredFilter])

  // Dialog 状态：重命名 / 删除（新建看板入口已移除）
  const [renameTarget, setRenameTarget] = React.useState<{ boardId: string; title: string } | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = React.useState<{ boardId: string; title: string } | null>(
    null
  )

  const handleOpen = (boardId: string): void => {
    setSelectedBoardId(boardId)
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
      // 若删除的是当前选中看板，清空选中
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
      {/* 标题栏（无新建按钮，看板只从会话/草稿来） */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <KanbanSquare className="size-3.5 text-foreground/60" />
          <span className="text-xs font-medium text-foreground">看板</span>
          {boards.length > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{boards.length}</span>
          )}
        </div>
      </div>

      {/* 模式过滤切换（segmented control 风格） */}
      <div className="flex items-center gap-1 px-3 pb-2">
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {[
            { value: 'general' as const, label: '通用' },
            { value: 'ta' as const, label: 'TA' },
            { value: 'all' as const, label: '全部' },
          ].map((tab) => {
            const currentValue = filter.mode ?? 'all'
            const isActive = currentValue === tab.value
            return (
              <button
                key={tab.value}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => {
                  const newFilter = {
                    ...filter,
                    mode: tab.value === 'all' ? undefined : tab.value,
                  }
                  setFilter(newFilter)
                  setStoredFilter(newFilter)
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
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
              {filter.mode === 'ta'
                ? 'TA 模式暂无看板'
                : filter.mode === 'general'
                  ? '通用模式暂无看板'
                  : '暂无看板'}
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

      {/* 重命名看板 Dialog（保留，管理操作） */}
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
