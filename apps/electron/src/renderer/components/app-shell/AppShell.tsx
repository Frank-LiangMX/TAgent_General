/**
 * AppShell - 应用主布局容器
 *
 * 布局结构：
 * - 左侧：FunctionalRail（60px 固定，功能区切换）+ LeftSidebar（240px，功能区内容）
 * - 中间：MainArea（TabBar + TabContent）
 * - 右侧：RightSidePanel（可折叠，仅 Agent 模式会话文件面板）
 *
 * FunctionalRail 显示模式切换 + 功能区图标
 * LeftSidebar 显示当前功能区的内容
 *
 * Settings 视图为独立覆盖。
 */

import { useAtom, useAtomValue } from 'jotai'
import * as React from 'react'

import { FunctionalRail } from './FunctionalRail'
import { LeftSidebar } from './LeftSidebar'
import { NavIsland } from './NavIsland'
import { RightSidePanel } from './RightSidePanel'

import {
  agentSidePanelWidthAtom,
  currentAgentSessionIdAtom,
  currentSessionSidePanelOpenAtom,
} from '@/atoms/agent-atoms'
import { appModeAtom, topLevelModeAtom, activeRailItemAtom } from '@/atoms/app-mode'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import { WorkspaceManagerDialog } from '@/components/agent/WorkspaceManagerDialog'
import { MainArea } from '@/components/tabs/MainArea'
import { WindowControls } from '@/components/WindowControls'
import { AppShellProvider, type AppShellContextType } from '@/contexts/AppShellContext'
import { NAV_SIDEBAR_WIDTH } from '@/lib/platform'
import { cn } from '@/lib/utils'

const MIN_RIGHT_PANEL_WIDTH = 300
const MAX_RIGHT_PANEL_WIDTH = 420

function clampRightPanelWidth(width: number): number {
  return Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, width))
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
  const activeRailItem = useAtomValue(activeRailItemAtom)
  const showRightPanel = topLevelMode === 'general' && appMode === 'agent' && !!currentSessionId

  /** 通用模式三种 Rail 共用同一侧栏宽度，切换功能区时浮岛不跳变 */
  const showLeftSidebar =
    topLevelMode === 'general'
      ? activeRailItem === 'sessions' || activeRailItem === 'files' || activeRailItem === 'skills'
      : true

  const navSidebarWidth = NAV_SIDEBAR_WIDTH

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

  return (
    <AppShellProvider value={contextValue}>
      {/* 窗口拖动区由 NavIsland 内部 chrome(左侧栏顶部)和 TabBar 自身覆盖,这里不再加全宽 fixed 区域
          ——之前的 60px 跨全宽 fixed 拖拽区被主区域 z-60 覆盖,既看不见也撑出了主区域上方的视觉空行。 */}

      {/* Windows 自定义窗口控制按钮(最小化/最大化/关闭) */}
      <WindowControls />

      <div className="shell-glass shell-bg h-screen w-screen flex overflow-hidden">
        {/* 左侧：FunctionalRail + LeftSidebar */}
        <div className="p-2 pr-0 relative z-[60] flex items-stretch">
          <NavIsland
            showSidebar={showLeftSidebar}
            sidebarWidth={navSidebarWidth}
          >
            <FunctionalRail />
            {showLeftSidebar && (
              <LeftSidebar
                activeRailItem={activeRailItem}
                width={navSidebarWidth}
              />
            )}
          </NavIsland>
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
