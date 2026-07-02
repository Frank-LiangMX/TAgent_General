/**
 * KanbanMainView — 看板详情主视图（B4）
 *
 * 选中看板后主区域渲染：RailInspectorHeader 顶栏 + 任务列表。
 * 任务按状态分组展示，复用 KanbanTaskListItem 卡片。
 * 未选中看板时显示空态引导（去会话或草稿建板）。
 *
 * 三系统关系调整（2026-07-01）：看板页不再支持建板/建任务，
 * 任务只从会话（Agent 拆解）或草稿（用户拆 + 计划层）来。
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { KanbanSquare, Loader2, Gauge, Pause, Play } from 'lucide-react'
import { toast } from 'sonner'

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@tagent/ui'
import type { KanbanTaskStatus } from '@tagent/shared'

import { Panel } from '@/components/app-shell/Panel'
import { RailInspectorHeader } from '@/components/app-shell/RailInspectorHeader'
import { useSelectedKanbanBoard, selectedKanbanBoardIdAtom } from '@/atoms/kanban-atoms'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { KanbanTaskListItem } from './KanbanTaskListItem'

/** 状态分组顺序与中文标签 */
const STATUS_GROUPS: Array<{ status: KanbanTaskStatus; label: string }> = [
  { status: 'ready', label: '待派工' },
  { status: 'pending', label: '待办（依赖未满足）' },
  { status: 'running', label: '执行中' },
  { status: 'blocked', label: '阻塞' },
  { status: 'review', label: '待验收' },
  { status: 'done', label: '已完成' },
  { status: 'failed', label: '失败' },
  { status: 'cancelled', label: '已取消' },
]

export function KanbanMainView(): React.ReactElement {
  const selectedBoardId = useAtomValue(selectedKanbanBoardIdAtom)
  const setSelectedBoardId = useSetAtom(selectedKanbanBoardIdAtom)
  const { board, tasks, loading } = useSelectedKanbanBoard(selectedBoardId)
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null)
  const isMac = React.useMemo(() => detectIsMac(), [])
  // Windows 顶栏需避让窗口控制按钮（与 LeftSidebar pt-[28px] 对齐）
  const headerClassName = cn(!isMac && 'pt-6')

  // 空态：未选中看板
  if (!selectedBoardId) {
    return (
      <Panel variant="grow" className="content-glass">
        <RailInspectorHeader
          crumbs={[{ label: '看板' }]}
          title="看板"
          description="任务执行容器与监控仪表盘"
          className={headerClassName}
        />
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-6 max-w-md">
            <KanbanSquare className="size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">从左侧列表选择看板查看进度</p>
            <p className="text-xs text-muted-foreground/70">
              看板不支持直接创建。在会话里告诉 Agent
              你的目标让其自动拆解，或在草稿页拆解需求后升级建板。
            </p>
          </div>
        </div>
      </Panel>
    )
  }

  // 加载中
  if (loading && !board) {
    return (
      <Panel variant="grow" className="content-glass">
        <RailInspectorHeader
          crumbs={[{ label: '看板' }]}
          title="加载中..."
          className={headerClassName}
        />
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </Panel>
    )
  }

  // 看板不存在
  if (!board) {
    return (
      <Panel variant="grow" className="content-glass">
        <RailInspectorHeader
          crumbs={[{ label: '看板' }]}
          title="看板不存在"
          description="该看板可能已被删除"
          className={headerClassName}
        />
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <KanbanSquare className="size-12 text-muted-foreground/30" />
            <Button variant="ghost" size="sm" onClick={() => setSelectedBoardId(null)}>
              返回看板列表
            </Button>
          </div>
        </div>
      </Panel>
    )
  }

  const displayName = board.title ?? board.rootGoal.slice(0, 60)
  const done = tasks.filter((t) => t.status === 'done').length
  const total = tasks.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const handlePauseResume = async (): Promise<void> => {
    try {
      if (board.paused) {
        await window.electronAPI.kanban.resumeBoard(board.id)
        toast.success('已恢复调度')
      } else {
        await window.electronAPI.kanban.pauseBoard(board.id)
        toast.success('已暂停调度')
      }
    } catch (err) {
      toast.error('操作失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <Panel variant="grow" className="content-glass">
      <RailInspectorHeader
        crumbs={[{ label: '看板' }, { label: board.mode === 'ta' ? 'TA' : '通用' }]}
        title={displayName}
        description={board.rootGoal}
        className={headerClassName}
      />
      {/* 看板工具栏：进度 + 并发 + 暂停（独立行，避免顶栏右侧 WindowControls 避让区留白） */}
      <div className="flex items-center gap-2 border-b border-border/40 px-5 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
          <span>
            {done}/{total}
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {/* 并发上限 quick edit（B10） */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="调整并发上限"
            >
              <Gauge className="size-3" />
              <span className="tabular-nums">{board.maxConcurrent ?? 3}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[9999]">
            <div className="px-2 py-1 text-[10px] text-muted-foreground">并发上限</div>
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <DropdownMenuItem
                key={n}
                onClick={() => {
                  void window.electronAPI.kanban
                    .updateBoard({ boardId: board.id, maxConcurrent: n })
                    .then(() => {
                      toast.success(`并发上限已调整为 ${n}`)
                    })
                    .catch((err) => {
                      toast.error('调整失败', {
                        description: err instanceof Error ? err.message : undefined,
                      })
                    })
                }}
                className={cn(
                  'flex items-center justify-between gap-2 text-xs',
                  board.maxConcurrent === n && 'bg-muted'
                )}
              >
                <span className="tabular-nums">{n}</span>
                {board.maxConcurrent === n && (
                  <span className="text-[10px] text-muted-foreground">当前</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* requireSummary 标记（B9）：完成后自动触发主会话汇总 */}
        {board.requireSummary && (
          <Badge
            variant="outline"
            className="border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px]"
            title="该看板全部完成后会自动触发主会话汇总结果"
          >
            完成后汇总
          </Badge>
        )}
        {/* 暂停/继续调度（B5） */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto size-7 rounded-full p-0"
          onClick={() => void handlePauseResume()}
          title={board.paused ? '继续调度' : '暂停调度'}
        >
          {board.paused ? (
            <Play className="size-3.5 text-amber-600 dark:text-amber-400" />
          ) : (
            <Pause className="size-3.5 text-foreground/60" />
          )}
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <KanbanSquare className="size-10 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground mb-1">该看板暂无任务</p>
            <p className="text-[11px] text-muted-foreground/70 max-w-sm">
              看板不支持直接创建任务。请在会话里让 Agent 追加子任务，或从草稿升级补充。
            </p>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-4">
            {STATUS_GROUPS.map(({ status, label }) => {
              const groupTasks = tasks.filter((t) => t.status === status)
              if (groupTasks.length === 0) return null
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {groupTasks.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {groupTasks.map((task) => (
                      <KanbanTaskListItem
                        key={task.id}
                        task={task}
                        selected={selectedTaskId === task.id}
                        onSelect={setSelectedTaskId}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Panel>
  )
}
