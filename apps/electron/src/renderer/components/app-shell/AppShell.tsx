/**
 * AppShell - 应用主布局容器
 *
 * 右侧浮岛动画原则（避免底板弹到窗口边界）：
 * - 右栏列宽跟 panelColumnShown 同步；底板右边界保持稳定，不跟右栏卸载跳变
 * - 视觉动画在浮岛自身边界内完成，不让元素越过底板圆角边界
 */

import { useAtom, useAtomValue } from 'jotai'
import * as React from 'react'

import { FunctionalRail } from './FunctionalRail'
import { LeftSidebar } from './LeftSidebar'
import { NavIsland } from './NavIsland'
import { RightPanelRail } from './RightPanelRail'
import { RightSidePanel } from './RightSidePanel'

import {
  agentSidePanelOpenAtom,
  agentSidePanelWidthAtom,
  currentAgentSessionIdAtom,
} from '@/atoms/agent-atoms'
import { appModeAtom, topLevelModeAtom, activeRailItemAtom } from '@/atoms/app-mode'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import { ProjectManagerDialog } from '@/components/agent/WorkspaceManagerDialog'
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
  const isPanelOpen = useAtomValue(agentSidePanelOpenAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)
  const showRightPanel = topLevelMode === 'general' && appMode === 'agent' && !!currentSessionId

  const showLeftSidebar =
    topLevelMode === 'general'
      ? activeRailItem === 'sessions' ||
        activeRailItem === 'skills' ||
        activeRailItem === 'draft' ||
        activeRailItem === 'automation' ||
        activeRailItem === 'kanban'
      : activeRailItem !== 'draft'

  const navRailWidth = NAV_RAIL_WIDTH
  const navSidebarWidth = NAV_SIDEBAR_WIDTH
  const navIslandWidth = showLeftSidebar ? navRailWidth + navSidebarWidth : navRailWidth
  const contentBaseInsetLeft = navIslandWidth + SHELL_EDGE_PADDING

  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useAtom(workspaceManagerOpenAtom)

  const [rightPanelWidth, setRightPanelWidth] = useAtom(agentSidePanelWidthAtom)
  const dragging = React.useRef(false)
  const clampedRightPanelWidth = clampRightPanelWidth(rightPanelWidth)

  const rightColumnOuterWidth = clampedRightPanelWidth + SHELL_EDGE_PADDING

  /**
   * 底板边界是主窗口的视觉边界，不跟随右栏卸载跳变。
   * 右栏关闭时只收回浮岛内容，底板仍稳定延伸到全局圆角边界，避免右边缘闪烁。
   */
  const contentBaseInsetRight = showRightPanel && isPanelOpen ? clampedRightPanelWidth : 0

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
      <WindowControls />

      <div
        className={cn(
          'shell-glass shell-bg relative flex h-screen w-screen overflow-hidden',
          isMac ? 'shell-glass--mac' : 'shell-glass--win'
        )}
        style={{
          ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
          ['--nav-island-outer-radius-tl' as string]: `${isMac ? NAV_ISLAND_MAC_TOP_LEFT_RADIUS : NAV_ISLAND_OUTER_RADIUS}px`,
        }}
      >
        <div className="relative z-[70] flex shrink-0 items-stretch self-stretch p-2 pr-0">
          <NavIsland
            showSidebar={showLeftSidebar}
            sidebarWidth={navSidebarWidth}
            railWidth={navRailWidth}
          >
            <FunctionalRail />
            {showLeftSidebar && (
              <LeftSidebar activeRailItem={activeRailItem} width={navSidebarWidth} />
            )}
          </NavIsland>
        </div>

        <ProjectManagerDialog open={workspaceManagerOpen} onOpenChange={setWorkspaceManagerOpen} />

        <div className="app-content-boundary-rim" aria-hidden />

        <div className="relative z-[60] min-w-0 flex-1 p-2">
          <div
            className={cn(
              'content-main-shell relative h-full min-h-0',
              contentBaseInsetRight > 0 && 'content-main-shell--right-inset'
            )}
            style={{
              ['--content-base-inset-left' as string]: `${contentBaseInsetLeft}px`,
              ['--content-base-inset-right' as string]: `${contentBaseInsetRight}px`,
              ['--content-base-fade-width' as string]: `${contentBaseInsetLeft + 56}px`,
              ['--content-chrome-bleed-left' as string]: `${SHELL_EDGE_PADDING}px`,
              ['--content-chrome-bleed-right' as string]:
                showRightPanel && isPanelOpen ? `${SHELL_EDGE_PADDING}px` : '0px',
              transition:
                '--content-base-inset-left 300ms cubic-bezier(0.16, 1, 0.3, 1), --content-base-fade-width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
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

        {showRightPanel && (
          <div className="relative z-[70] box-border flex shrink-0 items-stretch self-stretch p-2 pl-0">
            {/* 拖拽调整宽度的接缝（仅在面板展开时可见） */}
            {isPanelOpen && (
              <div
                className="absolute bottom-0 left-0 top-0 z-20 w-[8px] -translate-x-1/2 cursor-col-resize transition-colors hover:bg-primary/30 active:bg-primary/50"
                onMouseDown={handleMouseDown}
              />
            )}

            {/* 右侧浮岛：会话面板（铺满到圆角边缘）+ rail 浮在面板右侧上方
                width 跟随 isPanelOpen 过渡：展开 = 面板宽；折叠 = 仅 rail 细条 */}
            <div
              className={cn(
                'right-nav-island-glass nav-island-glass nav-island-glass--float',
                'relative ml-auto flex h-full min-h-0 flex-row overflow-hidden',
                'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                isMac && 'right-nav-island-glass--mac'
              )}
              style={{
                width: isPanelOpen ? rightColumnOuterWidth : NAV_RAIL_WIDTH + SHELL_EDGE_PADDING,
                ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
                ['--right-panel-rail-width' as string]: `${NAV_RAIL_WIDTH}px`,
              }}
            >
              {/* 会话面板内容（仅展开时渲染，铺满浮岛；padding-right 给 rail 让位） */}
              {isPanelOpen && (
                <div
                  className="nav-island-body relative flex min-h-0 flex-1 flex-col"
                  style={{ paddingRight: NAV_RAIL_WIDTH }}
                >
                  <RightSidePanel width={clampedRightPanelWidth} />
                </div>
              )}

              {/* 按钮列：absolute 浮在会话面板右侧上方（z-10），永远可见 */}
              <div className="pointer-events-auto absolute bottom-0 right-0 top-0 z-10 flex items-stretch">
                <RightPanelRail panelOpen={isPanelOpen} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShellProvider>
  )
}
