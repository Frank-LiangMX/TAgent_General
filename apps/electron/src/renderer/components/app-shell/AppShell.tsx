/**
 * AppShell - 应用主布局容器
 *
 * 布局结构：
 * - 左侧：FunctionalRail（60px 固定，功能区切换）+ LeftSidebar（可折叠，功能区内容）
 * - 中间：MainArea（TabBar + TabContent）
 * - 右侧：RightSidePanel（可折叠，仅 Agent 模式会话文件面板）
 *
 * FunctionalRail 显示模式切换 + 功能区图标
 * LeftSidebar 显示当前功能区的内容
 *
 * Settings 视图为独立覆盖。
 */

import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import * as React from 'react'

import { FunctionalRail } from './FunctionalRail'
import { LeftSidebar } from './LeftSidebar'
import { RightSidePanel } from './RightSidePanel'

import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import {
  agentSidePanelWidthAtom,
  currentAgentSessionIdAtom,
  currentSessionSidePanelOpenAtom,
  agentSessionsAtom,
  agentWorkspacesAtom,
  agentSessionIndicatorMapAtom,
  unviewedCompletedSessionIdsAtom,
  currentAgentWorkspaceIdAtom,
} from '@/atoms/agent-atoms'
import { workingSessionIdsSetAtom } from '@/atoms/working-atoms'
import { conversationsAtom, streamingConversationIdsAtom } from '@/atoms/chat-atoms'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import { appModeAtom, topLevelModeAtom, activeRailItemAtom } from '@/atoms/app-mode'
import { searchDialogOpenAtom } from '@/atoms/search-atoms'
import { sidebarCollapsedAtom, activeSessionIdAtom } from '@/atoms/tab-atoms'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import { WorkspaceManagerDialog } from '@/components/agent/WorkspaceManagerDialog'
import { MainArea } from '@/components/tabs/MainArea'
import { WindowControls } from '@/components/WindowControls'
import { AppShellProvider, type AppShellContextType } from '@/contexts/AppShellContext'
import { useOpenSession } from '@/hooks/useOpenSession'
import { detectIsWindows, detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

const MIN_RIGHT_PANEL_WIDTH = 300
const MAX_RIGHT_PANEL_WIDTH = 420

function clampRightPanelWidth(width: number): number {
  return Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, width))
}

/** 获取标题首字母用于 Rail 快捷入口 */
function getRailInitial(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || '·'
}

export interface AppShellProps {
  /** Context 值，用于传递给子组件 */
  contextValue: AppShellContextType
}

export function AppShell({ contextValue }: AppShellProps): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const appMode = useAtomValue(appModeAtom)
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const isPanelOpen = useAtomValue(currentSessionSidePanelOpenAtom)
  const showRightPanel = topLevelMode === 'general' && appMode === 'agent' && !!currentSessionId
  const isWindows = React.useMemo(() => detectIsWindows(), [])
  const isMac = React.useMemo(() => detectIsMac(), [])
  const store = useStore()

  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)

  // 会话列表状态（用于 FunctionalRail 最近会话入口）
  const conversations = useAtomValue(conversationsAtom)
  const agentSessions = useAtomValue(agentSessionsAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const draftSessionIds = useAtomValue(draftSessionIdsAtom)
  const streamingIds = useAtomValue(streamingConversationIdsAtom)
  const activeSessionId = useAtomValue(activeSessionIdAtom)
  const agentIndicatorMap = useAtomValue(agentSessionIndicatorMapAtom)
  const unviewedCompletedSessionIds = useAtomValue(unviewedCompletedSessionIdsAtom)
  const workingSessionIds = useAtomValue(workingSessionIdsSetAtom)

  // 打开会话
  const openSession = useOpenSession()
  const setSearchDialogOpen = useSetAtom(searchDialogOpenAtom)
  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useAtom(workspaceManagerOpenAtom)

  // 右侧面板可拖拽宽度
  const [rightPanelWidth, setRightPanelWidth] = useAtom(agentSidePanelWidthAtom)
  const dragging = React.useRef(false)
  const clampedRightPanelWidth = clampRightPanelWidth(rightPanelWidth)

  React.useEffect(() => {
    if (clampedRightPanelWidth !== rightPanelWidth) {
      setRightPanelWidth(clampedRightPanelWidth)
    }
  }, [clampedRightPanelWidth, rightPanelWidth, setRightPanelWidth])

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startWidth = clampedRightPanelWidth
    let rafId = 0

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const delta = startX - ev.clientX
        const newWidth = clampRightPanelWidth(startWidth + delta)
        setRightPanelWidth(newWidth)
      })
    }

    const onMouseUp = () => {
      dragging.current = false
      if (rafId) cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [clampedRightPanelWidth, setRightPanelWidth])

  // 计算最近会话列表（用于 FunctionalRail）
  const railRecentItems = React.useMemo(() => {
    if (topLevelMode !== 'general') return []

    if (appMode === 'chat') {
      return conversations
        .filter((c) => !c.archived && !draftSessionIds.has(c.id))
        .sort((a, b) => {
          const activeDelta = Number(b.id === activeSessionId) - Number(a.id === activeSessionId)
          if (activeDelta !== 0) return activeDelta
          const streamingDelta = Number(streamingIds.has(b.id)) - Number(streamingIds.has(a.id))
          if (streamingDelta !== 0) return streamingDelta
          const pinnedDelta = Number(!!b.pinned) - Number(!!a.pinned)
          if (pinnedDelta !== 0) return pinnedDelta
          return b.updatedAt - a.updatedAt
        })
        .slice(0, 5)
        .map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          type: 'chat' as const,
          initial: getRailInitial(conversation.title),
          active: conversation.id === activeSessionId,
          status: streamingIds.has(conversation.id) ? 'running' as const : 'idle' as const,
        }))
    }

    // Agent 模式
    return agentSessions
      .filter((session) =>
        !session.archived
        && !draftSessionIds.has(session.id)
        && (!currentWorkspaceId || session.workspaceId === currentWorkspaceId)
      )
      .sort((a, b) => {
        const statusA = agentIndicatorMap.get(a.id) ?? (unviewedCompletedSessionIds.has(a.id) ? 'completed' : 'idle')
        const statusB = agentIndicatorMap.get(b.id) ?? (unviewedCompletedSessionIds.has(b.id) ? 'completed' : 'idle')
        const priority = (session: typeof a, status: SessionIndicatorStatus): number => {
          if (session.id === activeSessionId) return 0
          if (status === 'blocked') return 1
          if (status === 'running') return 2
          if (workingSessionIds.has(session.id)) return 3
          if (session.pinned) return 4
          if (status === 'completed') return 5
          return 6
        }
        const priorityDelta = priority(a, statusA) - priority(b, statusB)
        if (priorityDelta !== 0) return priorityDelta
        return b.updatedAt - a.updatedAt
      })
      .slice(0, 5)
      .map((session) => ({
        id: session.id,
        title: session.title,
        type: 'agent' as const,
        initial: getRailInitial(session.title),
        active: session.id === activeSessionId,
        status: agentIndicatorMap.get(session.id) ?? (unviewedCompletedSessionIds.has(session.id) ? 'completed' as const : 'idle' as const),
      }))
  }, [topLevelMode, appMode, conversations, agentSessions, draftSessionIds, currentWorkspaceId, activeSessionId, streamingIds, agentIndicatorMap, unviewedCompletedSessionIds, workingSessionIds])

  // 最近会话点击
  const handleRecentItemSelect = React.useCallback((item: { id: string; title: string; type: 'chat' | 'agent' }) => {
    openSession(item.type, item.id, item.title)
  }, [openSession])

  // 新建会话（简化版，实际逻辑在 LeftSidebar 中）
  const handleNewSession = React.useCallback(() => {
    // 这里只是占位，实际由 LeftSidebar 内部处理
    setSidebarCollapsed(false)
  }, [setSidebarCollapsed])

  // 搜索
  const handleSearch = React.useCallback(() => {
    setSearchDialogOpen(true)
  }, [setSearchDialogOpen])

  return (
    <AppShellProvider value={contextValue}>
      {/* 可拖动标题栏区域，用于窗口拖动。
          Windows 上必须避开右上角的 WindowControls 区域（buttons ~118px + 8px buffer = 126px），
          否则 drag-region 与按钮区的 hitmask 重叠会让 OS 把单击当成标题栏点击，
          表现为"按钮要双击才响应"。 */}
      <div
        className={cn(
          'titlebar-drag-region fixed top-0 left-0 h-[50px] z-50',
          isWindows ? 'right-[126px]' : 'right-0'
        )}
      />

      {/* Windows 自定义窗口控制按钮（最小化/最大化/关闭） */}
      <WindowControls />

      <div className="shell-bg h-screen w-screen flex overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
        {/* 左侧：FunctionalRail + LeftSidebar */}
        <div className="p-2 pr-0 relative z-[60] flex items-stretch gap-0">
          {/* FunctionalRail：60px 固定宽度，功能区切换 */}
          <FunctionalRail
            onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
            recentItems={railRecentItems}
            onRecentItemSelect={handleRecentItemSelect}
            onNewSession={handleNewSession}
            onSearch={handleSearch}
            sidebarCollapsed={sidebarCollapsed}
            topLevelMode={topLevelMode}
          />

          {/* LeftSidebar：功能区内容，根据 activeRailItem 显示不同内容。始终挂载，折叠动画在 LeftSidebar 内部通过 width/opacity transition 实现 */}
          <div className="relative">
            <LeftSidebar
              activeRailItem={activeRailItem}
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />
          </div>
        </div>

        {/* 工作区管理弹窗（全局可见） */}
        <WorkspaceManagerDialog
          open={workspaceManagerOpen}
          onOpenChange={setWorkspaceManagerOpen}
        />

        {/* 中间容器：relative z-[60] 使其在 z-50 拖动区域之上 */}
        <div className="flex-1 min-w-0 p-2 relative z-[60]">
          {/* 通用模式和 TA 模式都使用 MainArea */}
          <MainArea />
        </div>

        {/* 右侧边栏：Agent 文件面板，仅在通用模式 Agent 子模式下显示 */}
        {showRightPanel && (
          <div className={cn('relative z-[60] flex items-stretch transition-[padding] duration-300 ease-in-out', isPanelOpen ? 'p-2 pl-0' : 'p-0')}>
            {/* 拖拽手柄 — 绝对定位，居中于主区域和右侧面板的缝隙 */}
            {isPanelOpen && (
              <div
                className="absolute left-0 top-0 bottom-0 w-[8px] -translate-x-1/2 cursor-col-resize active:bg-primary/50 transition-colors z-10"
                onMouseDown={handleMouseDown}
              />
            )}
            <RightSidePanel width={clampedRightPanelWidth} />
          </div>
        )}
      </div>
    </AppShellProvider>
  )
}
