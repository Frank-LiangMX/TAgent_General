/**
 * KanbanBoardToolbar — 班组工具栏（进度 / 并发 / 暂停 / 刷新）
 *
 * MainView、Team、右栏班组面板共用，避免三处复制。
 */

import * as React from 'react'
import { Gauge, Pause, Play, RefreshCw, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  /** 额外右侧操作（切换看板 / 解绑等） */
  extraActions?: React.ReactNode | null
}

export function KanbanBoardToolbar({
  boardId,
  maxConcurrent,
  paused,
  requireSummary,
  doneCount,
  totalCount,
  loading,
  onRefresh,
  className,
  extraActions,
}: KanbanBoardToolbarProps): React.ReactElement {
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const handlePauseResume = async (): Promise<void> => {
    try {
      if (paused) {
        await window.electronAPI.kanban.resumeBoard(boardId)
        toast.success('已恢复调度')
      } else {
        await window.electronAPI.kanban.pauseBoard(boardId)
        toast.success('已暂停调度')
      }
    } catch (err) {
      toast.error('操作失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div className={cn('flex items-center gap-2 border-b border-border/40 px-3 py-2', className)}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
        <span>
          {doneCount}/{totalCount}
        </span>
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-foreground/[0.06]">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="调整并发上限"
          >
            <Gauge className="size-3" />
            <span className="tabular-nums">{maxConcurrent}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[9999]">
          <div className="px-2 py-1 text-[10px] text-muted-foreground">并发上限</div>
          {[1, 2, 3, 4, 5, 6, 8].map((n) => (
            <DropdownMenuItem
              key={n}
              onClick={() => {
                void window.electronAPI.kanban
                  .updateBoard({ boardId, maxConcurrent: n })
                  .then(() => toast.success(`并发上限已调整为 ${n}`))
                  .catch((err) => {
                    toast.error('调整失败', {
                      description: err instanceof Error ? err.message : undefined,
                    })
                  })
              }}
              className={cn(
                'flex items-center justify-between gap-2 text-xs',
                maxConcurrent === n && 'bg-muted'
              )}
            >
              <span className="tabular-nums">{n}</span>
              {maxConcurrent === n && (
                <span className="text-[10px] text-muted-foreground">当前</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {requireSummary && (
        <Badge
          variant="outline"
          className="border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px]"
          title="该看板全部完成后会自动触发主会话汇总结果"
        >
          完成后汇总
        </Badge>
      )}

      <div className="ml-auto flex items-center gap-1">
        {extraActions}
        <Button
          variant="ghost"
          size="sm"
          className="size-7 rounded-full p-0"
          onClick={() => onRefresh()}
          title="刷新"
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="size-7 rounded-full p-0"
          onClick={() => void handlePauseResume()}
          title={paused ? '继续调度' : '暂停调度'}
        >
          {paused ? (
            <Play className="size-3.5 text-amber-600 dark:text-amber-400" />
          ) : (
            <Pause className="size-3.5 text-foreground/60" />
          )}
        </Button>
      </div>
    </div>
  )
}

/** 工具栏圆形按钮（切换/解绑等） */
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
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'size-7 rounded-full p-0',
        danger && 'text-red-500 hover:text-red-600 hover:bg-red-500/10'
      )}
      onClick={onClick}
      title={title}
    >
      <Icon className="size-3.5" />
    </Button>
  )
}
