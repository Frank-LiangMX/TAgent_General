/**
 * KanbanBoardToolbar — 右栏班组用精简工具条
 *
 * 主区已自带 BoardChrome；此处只服务 CrewPanel / SessionTeamTab。
 * 进度条、「完成后汇总」不再露出——并发与刷新收进更多菜单。
 */

import * as React from 'react'
import { Gauge, MoreHorizontal, Pause, Play, RefreshCw, type LucideIcon } from 'lucide-react'
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
import { cn } from '@/lib/utils'

export interface KanbanBoardToolbarProps {
  boardId: string
  maxConcurrent: number
  paused: boolean
  requireSummary?: boolean
  doneCount: number
  totalCount: number
  loading?: boolean
  onRefresh: () => void
  className?: string
  extraActions?: React.ReactNode | null
}

export function KanbanBoardToolbar({
  boardId,
  maxConcurrent,
  paused,
  doneCount,
  totalCount,
  loading,
  onRefresh,
  className,
  extraActions,
}: KanbanBoardToolbarProps): React.ReactElement {
  const handlePauseResume = async (): Promise<void> => {
    try {
      if (paused) {
        await window.electronAPI.kanban.resumeBoard(boardId)
        toast.success('已恢复')
      } else {
        await window.electronAPI.kanban.pauseBoard(boardId)
        toast.success('已暂停')
      }
    } catch (err) {
      toast.error('操作失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1.5',
        'shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.06)]',
        className
      )}
    >
      <span className="px-1.5 text-[11px] tabular-nums text-muted-foreground">
        {doneCount}/{totalCount}
        {paused ? ' · 暂停' : ''}
      </span>

      <div className="ml-auto flex items-center gap-0.5">
        {extraActions}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-[36px] rounded-full p-0 text-foreground/60 hover:text-foreground"
              onClick={() => void handlePauseResume()}
              aria-label={paused ? '继续' : '暂停'}
            >
              {paused ? (
                <Play className="size-3.5 text-amber-500" />
              ) : (
                <Pause className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{paused ? '继续' : '暂停'}</TooltipContent>
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
          <DropdownMenuContent align="end" className="z-[9999] min-w-[148px]">
            <DropdownMenuItem className="gap-2 text-xs" onClick={() => onRefresh()}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              刷新
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[10px] text-muted-foreground">并发</div>
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
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function KanbanToolbarIconButton({
  icon: Icon,
  title,
  onClick,
  danger,
}: {
  icon: LucideIcon
  title: string
  onClick: () => void
  danger?: boolean
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'size-[36px] rounded-full p-0 text-foreground/60 hover:text-foreground',
            danger && 'text-red-500 hover:bg-red-500/10 hover:text-red-600'
          )}
          onClick={onClick}
          aria-label={title}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{title}</TooltipContent>
    </Tooltip>
  )
}
