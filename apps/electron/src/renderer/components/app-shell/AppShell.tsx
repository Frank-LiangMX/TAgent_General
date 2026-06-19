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
import { RightNavIsland } from './RightNavIsland'
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
import {
  detectIsMac,
  NAV_ISLAND_MAC_TOP_LEFT_RADIUS,
  NAV_ISLAND_OUTER_RADIUS,
  NAV_RAIL_WIDTH,
  NAV_SIDEBAR_WIDTH,
  SHELL_EDGE_PADDING,
} from '@/lib/platform'
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
  const isMac = React.useMemo(() => detectIsMac(), [])
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const appMode = useAtomValue(appModeAtom)
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const isPanelOpen = useAtomValue(currentSessionSidePanelOpenAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)
  const showRightPanel = topLevelMode === 'general' && appMode === 'agent' && !!currentSessionId

  /** 通用模式四种 Rail 共用同一侧栏宽度，切换功能区时浮岛不跳变 */
  const showLeftSidebar =
    topLevelMode === 'general'
      ? activeRailItem === 'sessions' || activeRailItem === 'files' || activeRailItem === 'skills' || activeRailItem === 'scratch'
      : activeRailItem !== 'scratch'

  const navSidebarWidth = NAV_SIDEBAR_WIDTH
  const navIslandWidth = showLeftSidebar ? NAV_RAIL_WIDTH + navSidebarWidth : NAV_RAIL_WIDTH
  /** 底板向左延伸：铺满整块 Nav 浮岛（Rail + Sidebar）下方，与侧栏一体悬浮 */
  const contentBaseInsetLeft = navIslandWidth + SHELL_EDGE_PADDING

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

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
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
    },
    [clampedRightPanelWidth, setRightPanelWidth]
  )

  return (
    <AppShellProvider value={contextValue}>
      {/* 窗口拖动区由 NavIsland 内部 chrome(左侧栏顶部)和 TabBar 自身覆盖,这里不再加全宽 fixed 区域
          ——之前的 60px 跨全宽 fixed 拖拽区被主区域 z-60 覆盖,既看不见也撑出了主区域上方的视觉空行。 */}

      {/* Windows 自定义窗口控制按钮(最小化/最大化/关闭) */}
      <WindowControls />

      <div
        className={cn(
          'shell-glass shell-bg h-screen w-screen flex overflow-hidden',
          isMac ? 'shell-glass--mac' : 'shell-glass--win'
        )}
        style={{
          ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
          ['--nav-island-outer-radius-tl' as string]: `${isMac ? NAV_ISLAND_MAC_TOP_LEFT_RADIUS : NAV_ISLAND_OUTER_RADIUS}px`,
        }}
      >
        {/* 左侧 Nav 浮岛（叠在底板之上） */}
        <div className="p-2 pr-0 relative z-[70] flex shrink-0 items-stretch self-stretch">
          <NavIsland showSidebar={showLeftSidebar} sidebarWidth={navSidebarWidth}>
            <FunctionalRail />
            {showLeftSidebar && (
              <LeftSidebar activeRailItem={activeRailItem} width={navSidebarWidth} />
            )}
          </NavIsland>
        </div>

        {/* 工作区管理弹窗（全局可见） */}
        <WorkspaceManagerDialog
          open={workspaceManagerOpen}
          onOpenChange={setWorkspaceManagerOpen}
        />

        {/* 主区域底板 + 内容（左侧无圆角，侧栏视觉上悬浮其上） */}
        <div className="flex-1 min-w-0 p-2 relative z-[60]">
          <div
            className="content-main-shell relative h-full min-h-0"
            style={{
              ['--content-base-inset-left' as string]: `${contentBaseInsetLeft}px`,
              ['--content-base-fade-width' as string]: `${contentBaseInsetLeft + 56}px`,
              ['--content-chrome-bleed-left' as string]: `${SHELL_EDGE_PADDING}px`,
            }}
          >
            <div className="content-base-plate content-base-plate--body" aria-hidden />
            <div
              className="content-base-plate-frame content-base-plate-edge content-base-plate-edge--tone"
              aria-hidden
            />
            <div
              className="content-base-plate-frame content-base-plate-edge content-base-plate-edge--glint"
              aria-hidden
            />
            <div
              className="content-base-plate-frame content-base-plate-hairline content-base-plate-hairline--tone"
              aria-hidden
            />
            <div
              className="content-base-plate-frame content-base-plate-hairline content-base-plate-hairline--glint"
              aria-hidden
            />
            <div className="content-main-foreground relative z-[1] h-full min-h-0">
              <MainArea />
            </div>
          </div>
        </div>

        {/* 右侧边栏：Agent 文件面板浮岛，仅在通用模式 Agent 子模式下显示 */}
        {showRightPanel && (
          <RightNavIsland
            isOpen={isPanelOpen}
            width={clampedRightPanelWidth}
            onDragStart={handleMouseDown}
          >
            <RightSidePanel width={clampedRightPanelWidth} />
          </RightNavIsland>
        )}
      </div>
    </AppShellProvider>
  )
}
