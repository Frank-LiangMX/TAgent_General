/**
 * KanbanMainView — 看板详情主视图（B4）
 *
 * 选中看板后显示看板详情，未选中时显示空态引导。
 * 角色库入口已移到 LeftSidebar（2026-07-07），主区只显示任务内容。
 * 工具栏 / 员工列表与右栏班组面板共用 KanbanBoardToolbar + KanbanCrewTaskList。
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { KanbanSquare, Loader2 } from 'lucide-react'

import { Button } from '@tagent/ui'

import { KanbanBoardToolbar } from './KanbanBoardToolbar'
import { KanbanCrewTaskList } from './KanbanCrewTaskList'
import { KanbanSwitcherDialog } from './KanbanSwitcherDialog'
import { AgentRoleSettings } from '@/components/settings/AgentRoleSettings'
import { Panel } from '@/components/app-shell/Panel'
import { RailInspectorHeader } from '@/components/app-shell/RailInspectorHeader'
import {
  selectedKanbanBoardIdAtom,
  useKanbanBoards,
  useSelectedKanbanBoard,
  kanbanActiveTabAtom,
} from '@/atoms/kanban-atoms'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

/** 任务 Tab 内容（看板详情） */
function TasksTabContent({
  board,
  tasks,
  loading,
  refresh,
}: {
  board: NonNullable<ReturnType<typeof useSelectedKanbanBoard>['board']>
  tasks: ReturnType<typeof useSelectedKanbanBoard>['tasks']
  loading: boolean
  refresh: () => Promise<void>
}): React.ReactElement {
  const done = tasks.filter((t) => t.status === 'done').length

  return (
    <>
      <KanbanBoardToolbar
        boardId={board.id}
        maxConcurrent={board.maxConcurrent ?? 3}
        paused={board.paused ?? false}
        requireSummary={board.requireSummary}
        doneCount={done}
        totalCount={tasks.length}
        loading={loading}
        onRefresh={() => void refresh()}
        className="px-5"
      />
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <KanbanCrewTaskList
          tasks={tasks}
          layout="grid"
          emptyHint="在会话里让主 Agent 点将派活，或从草稿升级补充任务。"
          className="p-4"
        />
      </div>
    </>
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
  // Windows 顶栏需避让窗口控制按钮（与 LeftSidebar pt-[28px] 对齐）
  const headerClassName = cn(!isMac && 'pt-6')

  // 角色库模式（由 Sidebar 的角色库按钮触发）
  if (activeTab === 'roles') {
    return (
      <Panel variant="grow" className="content-glass">
        <RailInspectorHeader
          crumbs={[{ label: '看板' }, { label: '角色库' }]}
          title="角色库"
          description="定义看板 worker 的专业能力"
          className={headerClassName}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <AgentRoleSettings />
        </div>
      </Panel>
    )
  }

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

  return (
    <Panel variant="grow" className="content-glass">
      <RailInspectorHeader
        crumbs={[{ label: '看板' }, { label: displayName }]}
        title={displayName}
        description={board.rootGoal}
        className={headerClassName}
      />
      <TasksTabContent board={board} tasks={tasks} loading={loading} refresh={refresh} />
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
