/**
 * SessionTeamTab — 看板团队 Master-Detail 主组件
 *
 * 布局：
 * - 左栏（240px）：按状态分组列表（进行中/待办/阻塞/完成）
 * - 右栏：选中 task 且 assigneeSessionId 存在时，嵌套 <AgentView />；否则显示 task 详情 + blocked 解除 UI
 * - 顶栏：进度 done/total、暂停/继续看板、刷新
 *
 * 嵌套 AgentView 时通过 sourceKanbanTaskId 检测避免递归 Tab（由 AgentView 控制是否渲染二级 Tab）。
 */

import * as React from 'react'
import { useAtom } from 'jotai'

import type { KanbanBoard, KanbanTask, KanbanTaskStatus } from '@tagent/shared'

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@tagent/ui'
import {
  ArrowLeftRight,
  Gauge,
  KanbanSquare,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Unlink,
} from 'lucide-react'
import { toast } from 'sonner'

import { KanbanTaskListItem } from './KanbanTaskListItem'
import { KanbanSwitcherDialog } from './KanbanSwitcherDialog'
import {
  selectedKanbanTaskIdAtomFamily,
  useKanbanBoard,
  useKanbanBoards,
} from '@/atoms/kanban-atoms'
import { AgentView } from '@/components/agent/AgentView'
import { Panel } from '@/components/app-shell/Panel'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { buildKanbanRoleInstanceLabels } from '@/lib/kanban-role-labels'
import { useAgentRoleMap } from '@/atoms/agent-role-atoms'

/** 按状态分组的顺序与中文标签（与 KanbanMainView 保持一致） */
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

export interface SessionTeamTabProps {
  sessionId: string
  boardId: string
}

export function SessionTeamTab({ sessionId, boardId }: SessionTeamTabProps): React.ReactElement {
  const { tasks, board, loading, refresh } = useKanbanBoard(sessionId)
  const [selectedTaskId, setSelectedTaskId] = useAtom(selectedKanbanTaskIdAtomFamily(boardId))
  // B5：paused 从 board 派生（切换看板时同步反映真实状态，不再用 local state）
  const paused = board?.paused ?? false
  const [unblockReason, setUnblockReason] = React.useState('')
  const [unblocking, setUnblocking] = React.useState(false)
  const [switcherOpen, setSwitcherOpen] = React.useState(false)

  // 全局看板列表（切换看板用）
  const { boards } = useKanbanBoards()
  const roleMap = useAgentRoleMap()
  const roleLabels = React.useMemo(
    () => buildKanbanRoleInstanceLabels(tasks, roleMap),
    [tasks, roleMap]
  )

  // 选中任务对象（tasks 变更后保持选中态）
  const selectedTask = React.useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  )

  // 按状态分组
  const grouped = React.useMemo(() => {
    const map = new Map<KanbanTaskStatus, KanbanTask[]>()
    for (const task of tasks) {
      const arr = map.get(task.status) ?? []
      arr.push(task)
      map.set(task.status, arr)
    }
    return map
  }, [tasks])

  const total = tasks.length
  const doneCount = grouped.get('done')?.length ?? 0
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const isMac = React.useMemo(() => detectIsMac(), [])

  const handlePauseResume = async (): Promise<void> => {
    if (paused) {
      await window.electronAPI.kanban.resumeBoard(boardId)
    } else {
      await window.electronAPI.kanban.pauseBoard(boardId)
    }
    // 不需要本地 toggle：IPC 成功后会 broadcastKanbanChanged，
    // useKanbanBoard 重新拉取 board，paused 自然更新
  }

  const handleUnblock = async (): Promise<void> => {
    if (!selectedTask) return
    setUnblocking(true)
    try {
      await window.electronAPI.kanban.unblockTask({
        taskId: selectedTask.id,
        reason: unblockReason.trim() || undefined,
      })
      setUnblockReason('')
    } catch (err) {
      console.error('[看板] 解除阻塞失败:', err)
    } finally {
      setUnblocking(false)
    }
  }

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
    } catch (err) {
      console.error('[看板] 切换看板失败:', err)
    } finally {
      setSwitcherOpen(false)
    }
  }

  const handleDetach = async (): Promise<void> => {
    try {
      await window.electronAPI.kanban.detachBoardFromSession({ sessionId })
      setSelectedTaskId(null)
    } catch (err) {
      console.error('[看板] 解绑看板失败:', err)
    }
  }

  return (
    <Panel variant="grow" className="content-glass">
      {/* 顶栏：横跨左右栏（与 KanbanMainView 工具栏一致，避免 240px 左栏容不下） */}
      <div
        className={cn(
          'flex items-center gap-2 border-b border-border/40 px-5 py-2',
          !isMac && 'pt-6'
        )}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
          <span>
            {doneCount}/{total}
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
              <span className="tabular-nums">{board?.maxConcurrent ?? 3}</span>
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
                  board?.maxConcurrent === n && 'bg-muted'
                )}
              >
                <span className="tabular-nums">{n}</span>
                {board?.maxConcurrent === n && (
                  <span className="text-[10px] text-muted-foreground">当前</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* requireSummary 标记（B9） */}
        {board?.requireSummary && (
          <Badge
            variant="outline"
            className="border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px]"
            title="该看板全部完成后会自动触发主会话汇总结果"
          >
            完成后汇总
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="size-7 rounded-full p-0"
            onClick={() => setSwitcherOpen(true)}
            title="切换看板"
          >
            <ArrowLeftRight className="size-3.5 text-foreground/60" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 rounded-full p-0"
            onClick={() => void handleDetach()}
            title="解绑看板"
          >
            <Unlink className="size-3.5 text-foreground/60" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 rounded-full p-0"
            onClick={() => void refresh()}
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

      {/* 双栏内容区 */}
      <div className="flex min-h-0 flex-1">
        {/* 左栏：任务列表 */}
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-border/40 bg-background/30">
          {/* 任务列表（按状态分组） */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 scrollbar-thin">
            {loading && tasks.length === 0 && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!loading && tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <KanbanSquare className="size-10 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground mb-1">该看板暂无任务</p>
                <p className="text-[11px] text-muted-foreground/70 max-w-[200px]">
                  在会话里让 Agent 追加子任务，或从草稿升级补充
                </p>
              </div>
            )}
            {STATUS_GROUPS.map(({ status, label }) => {
              const groupTasks = grouped.get(status)
              if (!groupTasks || groupTasks.length === 0) return null
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center gap-2 px-1">
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
                        showDetailDialog={false}
                        roleLabel={roleLabels.get(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* 右栏：任务详情 / 嵌套 AgentView */}
        <section className="flex min-w-0 flex-1 flex-col">
          {selectedTask ? (
            selectedTask.assigneeSessionId ? (
              <div className="flex h-full min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-background/30">
                  <span className="text-xs text-muted-foreground">工人会话</span>
                  <span className="text-xs font-mono text-foreground/70">
                    {selectedTask.assigneeSessionId}
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <AgentView sessionId={selectedTask.assigneeSessionId} />
                </div>
              </div>
            ) : (
              <TaskDetailView
                task={selectedTask}
                roleLabel={roleLabels.get(selectedTask.id)}
                unblockReason={unblockReason}
                setUnblockReason={setUnblockReason}
                onUnblock={handleUnblock}
                unblocking={unblocking}
              />
            )
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <p>选择左侧任务查看详情</p>
                {board && (
                  <p className="mt-1 text-[11px] text-muted-foreground/70">看板：{board.id}</p>
                )}
              </div>
            </div>
          )}
        </section>
        <KanbanSwitcherDialog
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
          boards={boards}
          currentBoardId={boardId}
          onSelect={handleSwitchBoard}
        />
      </div>
    </Panel>
  )
}

/** 任务详情视图（无 assigneeSessionId 时显示 task.body + blocked 解除 UI） */
function TaskDetailView({
  task,
  roleLabel,
  unblockReason,
  setUnblockReason,
  onUnblock,
  unblocking,
}: {
  task: KanbanTask
  roleLabel?: string
  unblockReason: string
  setUnblockReason: (v: string) => void
  onUnblock: () => void
  unblocking: boolean
}): React.ReactElement {
  return (
    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-base font-semibold text-foreground">{task.title}</h2>
            <Badge variant="outline" className="text-[10px]">
              {task.status}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">{task.id}</p>
        </div>

        <div>
          <h3 className="mb-1.5 text-xs font-medium text-foreground">任务内容</h3>
          <div className="session-glass rounded-glass-popover p-3">
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">
              {task.body || '（无内容）'}
            </p>
          </div>
        </div>

        {task.resultSummary && (
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-foreground">完成摘要</h3>
            <div className="rounded-glass-popover bg-emerald-500/5 p-3 border border-emerald-500/20">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{task.resultSummary}</p>
            </div>
          </div>
        )}

        {task.blockedReason && (
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-foreground">阻塞原因</h3>
            <div className="rounded-glass-popover bg-red-500/5 p-3 border border-red-500/20">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{task.blockedReason}</p>
            </div>
          </div>
        )}

        {task.error && (
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-foreground">错误信息</h3>
            <div className="rounded-glass-popover bg-red-500/5 p-3 border border-red-500/20">
              <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">
                {task.error}
              </p>
            </div>
          </div>
        )}

        {task.status === 'blocked' && (
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-foreground">解除阻塞</h3>
            <div className="flex gap-2">
              <Input
                value={unblockReason}
                onChange={(e) => setUnblockReason(e.target.value)}
                placeholder="解除原因（可选）"
                className="flex-1"
              />
              <Button onClick={onUnblock} disabled={unblocking} className="shrink-0">
                {unblocking ? <Loader2 className="size-3.5 animate-spin" /> : '解除阻塞'}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <span className="text-muted-foreground">渠道：</span>
            <span className="font-mono text-foreground/70">{task.channelId}</span>
          </div>
          {task.modelId && (
            <div>
              <span className="text-muted-foreground">模型：</span>
              <span className="font-mono text-foreground/70">{task.modelId}</span>
            </div>
          )}
          {task.roleId && (
            <div>
              <span className="text-muted-foreground">角色：</span>
              <span className="text-foreground/70">{roleLabel ?? task.roleId}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">优先级：</span>
            <span className="font-mono text-foreground/70">{task.priority}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
