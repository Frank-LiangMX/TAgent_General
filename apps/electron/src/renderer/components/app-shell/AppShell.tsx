/**
 * AppShell - 应用主布局容器
 *
 * 右侧浮岛动画原则（避免底板弹到窗口边界）：
 * - 布局（flex 列宽 + 底板 inset）只跟 panelColumnShown 同步，开/关瞬间到位或瞬间撤掉
 * - 视觉动画只用 transform scale，不在动画期间改 width / inset
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import { FunctionalRail } from './FunctionalRail'
import { LeftSidebar } from './LeftSidebar'
import { NavIsland } from './NavIsland'
import { RightPanelToggle } from './RightPanelToggle'
import { RightSidePanel } from './RightSidePanel'

import {
  agentSidePanelOpenAtom,
  agentSidePanelWidthAtom,
  currentAgentSessionIdAtom,
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

/** 浮钮与 TabBar 行对齐（相对主区顶缘） */
const RIGHT_PANEL_TOGGLE_TOP = 34

const MIN_RIGHT_PANEL_WIDTH = 300
const MAX_RIGHT_PANEL_WIDTH = 420
/** 与 CSS 收回 transform 时长一致，供卸载列延迟使用 */
const PANEL_COLLAPSE_MS = 240

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
  const setPanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)
  const showRightPanel = topLevelMode === 'general' && appMode === 'agent' && !!currentSessionId

  const toggleRightPanel = React.useCallback(() => {
    setPanelOpen((open) => !open)
  }, [setPanelOpen])

  const showLeftSidebar =
    topLevelMode === 'general'
      ? activeRailItem === 'sessions' || activeRailItem === 'files' || activeRailItem === 'skills' || activeRailItem === 'scratch'
      : activeRailItem !== 'scratch'

  const navSidebarWidth = NAV_SIDEBAR_WIDTH
  const navIslandWidth = showLeftSidebar ? NAV_RAIL_WIDTH + navSidebarWidth : NAV_RAIL_WIDTH
  const contentBaseInsetLeft = navIslandWidth + SHELL_EDGE_PADDING

  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useAtom(workspaceManagerOpenAtom)

  const [rightPanelWidth, setRightPanelWidth] = useAtom(agentSidePanelWidthAtom)
  const dragging = React.useRef(false)
  const clampedRightPanelWidth = clampRightPanelWidth(rightPanelWidth)

  /** 关闭后延迟卸载列，给 scale 退场留时间 */
  const [panelColumnMounted, setPanelColumnMounted] = React.useState(isPanelOpen)
  /** 列可见 = 打开态 或 退场动画中（与 inset 严格同步） */
  const panelColumnShown = isPanelOpen || panelColumnMounted
  /** 仅驱动 scale / 内容渐显，不参与布局 */
  const [shellAnimExpanded, setShellAnimExpanded] = React.useState(isPanelOpen)
  const skipPanelEnterAnimRef = React.useRef(isPanelOpen)

  const rightColumnOuterWidth = clampedRightPanelWidth + SHELL_EDGE_PADDING

  React.useEffect(() => {
    if (isPanelOpen) {
      setPanelColumnMounted(true)
      return
    }
    const timer = window.setTimeout(() => setPanelColumnMounted(false), PANEL_COLLAPSE_MS)
    return () => clearTimeout(timer)
  }, [isPanelOpen])

  React.useLayoutEffect(() => {
    if (!isPanelOpen) return
    if (!panelColumnShown) return

    if (skipPanelEnterAnimRef.current) {
      setShellAnimExpanded(true)
      skipPanelEnterAnimRef.current = false
      return
    }

    setShellAnimExpanded(false)
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (!cancelled) setShellAnimExpanded(true)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [isPanelOpen, panelColumnShown])

  React.useLayoutEffect(() => {
    if (!panelColumnMounted && !isPanelOpen) {
      setShellAnimExpanded(false)
    }
  }, [panelColumnMounted, isPanelOpen])

  /** 布局：列可见即预留满宽 + 底板延伸，与 flex 列 outer width 一致 */
  const contentBaseInsetRight =
    showRightPanel && panelColumnShown ? clampedRightPanelWidth : 0

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

  const shellExpanded = isPanelOpen && shellAnimExpanded
  const bodyVisible = isPanelOpen && shellAnimExpanded

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
          <NavIsland showSidebar={showLeftSidebar} sidebarWidth={navSidebarWidth}>
            <FunctionalRail />
            {showLeftSidebar && (
              <LeftSidebar activeRailItem={activeRailItem} width={navSidebarWidth} />
            )}
          </NavIsland>
        </div>

        <WorkspaceManagerDialog
          open={workspaceManagerOpen}
          onOpenChange={setWorkspaceManagerOpen}
        />

        <div
          className={cn(
            'relative z-[60] min-w-0 flex-1 p-2',
            showRightPanel && panelColumnShown && 'pr-0'
          )}
        >
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
                showRightPanel && panelColumnShown ? `${SHELL_EDGE_PADDING}px` : '0px',
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

        {showRightPanel && panelColumnShown && (
          <div
            className="relative z-[70] flex shrink-0 items-stretch self-stretch p-2 pl-0"
            style={{ width: rightColumnOuterWidth }}
          >
            <div className="relative flex h-full min-h-0 w-full items-stretch">
              {shellExpanded && (
                <div
                  className="absolute bottom-0 left-0 top-0 z-10 w-[8px] -translate-x-1/2 cursor-col-resize transition-colors hover:bg-primary/30 active:bg-primary/50"
                  onMouseDown={handleMouseDown}
                />
              )}
              <div
                className={cn(
                  'right-panel-expand-shell right-nav-island-glass nav-island-glass nav-island-glass--float',
                  'relative flex h-full min-h-0 w-full flex-col overflow-hidden',
                  shellExpanded && 'right-panel-expand-shell--expanded',
                  isMac && 'right-nav-island-glass--mac'
                )}
                style={{
                  ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
                  ['--right-panel-toggle-y' as string]: `${RIGHT_PANEL_TOGGLE_TOP + 18}px`,
                }}
              >
                <div
                  className={cn(
                    'right-panel-expand-body nav-island-body relative flex min-h-0 flex-1 flex-col pr-9',
                    bodyVisible && 'right-panel-expand-body--visible'
                  )}
                >
                  <RightSidePanel width={clampedRightPanelWidth} />
                </div>
              </div>
            </div>
          </div>
        )}

        {showRightPanel && (
          <div
            className="right-panel-plate-toggle pointer-events-auto absolute z-[80] titlebar-no-drag"
            style={{
              top: SHELL_EDGE_PADDING + RIGHT_PANEL_TOGGLE_TOP,
              right: SHELL_EDGE_PADDING,
            }}
          >
            <RightPanelToggle open={isPanelOpen} onToggle={toggleRightPanel} />
          </div>
        )}
      </div>
    </AppShellProvider>
  )
}
