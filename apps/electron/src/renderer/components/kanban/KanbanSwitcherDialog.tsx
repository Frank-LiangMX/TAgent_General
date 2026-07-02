/**
 * KanbanSwitcherDialog — 切换会话绑定的看板
 *
 * 列出所有看板（useKanbanBoards 已加载），点击项即调 onSelect 切换。
 * 当前看板高亮，已取消的看板禁用。
 */

import * as React from 'react'
import { Check, Loader2 } from 'lucide-react'

import type { KanbanBoard, KanbanBoardMode, KanbanBoardStatus } from '@tagent/shared'

import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@tagent/ui'

import { cn } from '@/lib/utils'

/** 模式徽章 */
const MODE_BADGE: Record<KanbanBoardMode, { label: string; className: string }> = {
  general: {
    label: '通用',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
  },
  ta: {
    label: 'TA',
    className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-transparent',
  },
}

/** 状态徽章 */
const STATUS_BADGE: Record<KanbanBoardStatus, { label: string; className: string }> = {
  active: {
    label: '进行中',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
  },
  completed: {
    label: '已完成',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
  },
  cancelled: { label: '已取消', className: 'bg-muted text-muted-foreground border-transparent' },
}

export interface KanbanSwitcherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boards: KanbanBoard[]
  currentBoardId: string
  onSelect: (boardId: string) => void | Promise<void>
}

export function KanbanSwitcherDialog({
  open,
  onOpenChange,
  boards,
  currentBoardId,
  onSelect,
}: KanbanSwitcherDialogProps): React.ReactElement {
  const [switchingId, setSwitchingId] = React.useState<string | null>(null)

  const handleSelect = async (board: KanbanBoard): Promise<void> => {
    if (board.id === currentBoardId || board.status === 'cancelled') return
    setSwitchingId(board.id)
    try {
      await onSelect(board.id)
      onOpenChange(false)
    } catch (err) {
      console.error('[看板] 切换看板失败:', err)
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>切换看板</DialogTitle>
          <DialogDescription>选择要绑定到当前会话的看板</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-1.5">
          {boards.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
              暂无可用看板
            </div>
          ) : (
            boards.map((board) => {
              const isCurrent = board.id === currentBoardId
              const isCancelled = board.status === 'cancelled'
              const isSwitching = switchingId === board.id
              const modeBadge = MODE_BADGE[board.mode]
              const statusBadge = STATUS_BADGE[board.status]
              const title = board.title || truncate(board.rootGoal, 40)

              return (
                <button
                  key={board.id}
                  type="button"
                  disabled={isCancelled || isSwitching}
                  onClick={() => void handleSelect(board)}
                  className={cn(
                    'session-glass w-full rounded-glass-popover px-3 py-2.5 text-left transition-all',
                    'hover:bg-background/60 hover:shadow-md',
                    isCurrent && 'ring-2 ring-blue-500/50 bg-background/70',
                    isCancelled &&
                      'opacity-50 cursor-not-allowed hover:bg-transparent hover:shadow-none'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-foreground">
                          {title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] px-1 py-0', modeBadge.className)}
                        >
                          {modeBadge.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] px-1 py-0', statusBadge.className)}
                        >
                          {statusBadge.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                          {board.id}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      {isSwitching ? (
                        <Loader2 className="size-3.5 animate-spin text-foreground/60" />
                      ) : isCurrent ? (
                        <Check className="size-3.5 text-blue-500" />
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}
