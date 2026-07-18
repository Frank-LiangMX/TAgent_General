/**
 * AppShell - 应用主布局容器
 *
 * Design Preview 两种扩展布局（覆盖层 + 轻量进退场动画）：
 * - 放大模式（fullscreen）：覆盖主内容区，仍露出左侧导航浮岛
 * - 沉浸全屏（immersive）：盖住整个壳层，只留会话 + 画布
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import { FunctionalRail } from './FunctionalRail'
import { InertRegion, useInertElement } from './InertRegion'
import { LeftSidebar } from './LeftSidebar'
import { getNavClusterWidth, NavIsland } from './NavIsland'
import { RightInspectorFrame } from './RightInspectorFrame'
import { RightPanelRail } from './RightPanelRail'
import { deriveShellLayout } from './shell-layout'
import { SpatialTopBar } from './SpatialTopBar'

import {
  agentSidePanelOpenAtom,
  agentSidePanelWidthAtom,
  currentAgentSessionIdAtom,
} from '@/atoms/agent-atoms'
import { globalOfficeModeAtom } from '@/atoms/session-presentation-atoms'
import {
  appModeAtom,
  topLevelModeAtom,
  activeRailItemAtom,
  navigationSidebarOpenAtom,
  rightRailItemAtom,
} from '@/atoms/app-mode'
import { activeTabAtom } from '@/atoms/tab-atoms'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import {
  designFullscreenAtom,
  designEnabledAtom,
  designImmersiveAtom,
} from '@/atoms/design-preview-atoms'
import { DesignImmersiveLayout } from '@/components/design-preview/DesignImmersiveLayout'
import { DesignPreviewPanel } from '@/components/design-preview/DesignPreviewPanel'
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
  RIGHT_PANEL_RAIL_WIDTH,
  SHELL_EDGE_PADDING,
} from '@/lib/platform'
import { cn } from '@/lib/utils'

const OfficeImmersiveShell = React.lazy(() =>
  import('@/components/ai-office/OfficeImmersiveShell').then((module) => ({
    default: module.OfficeImmersiveShell,
  }))
)

const MIN_RIGHT_PANEL_WIDTH = 300
const MAX_RIGHT_PANEL_WIDTH = 420
/** 覆盖层退场动画时长，需与 CSS transition 对齐 */
const DESIGN_MODE_EXIT_MS = 260

function clampRightPanelWidth(width: number): number {
  return Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, width))
}

/** 延迟卸载：先播退场动画再 unmount */
function useDelayedMount(
  active: boolean,
  exitMs = DESIGN_MODE_EXIT_MS
): {
  mounted: boolean
  open: boolean
} {
  const [mounted, setMounted] = React.useState(active)
  const [open, setOpen] = React.useState(active)

  React.useEffect(() => {
    if (active) {
      setMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setOpen(false)
    const t = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(t)
  }, [active, exitMs])

  return { mounted, open }
}

export interface AppShellProps {
  contextValue: AppShellContextType
}

export function AppShell({ contextValue }: AppShellProps): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const appMode = useAtomValue(appModeAtom)
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const rightPanelRequestedOpen = useAtomValue(agentSidePanelOpenAtom)
  const sidebarRequestedOpen = useAtomValue(navigationSidebarOpenAtom)
  const rightRailItem = useAtomValue(rightRailItemAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)
  const activeTab = useAtomValue(activeTabAtom)
  const globalOfficeMode = useAtomValue(globalOfficeModeAtom)
  const designFullscreen = useAtomValue(designFullscreenAtom)
  const designEnabled = useAtomValue(designEnabledAtom)
  const designImmersive = useAtomValue(designImmersiveAtom)
  const setDesignFullscreen = useSetAtom(designFullscreenAtom)
  const setDesignImmersive = useSetAtom(designImmersiveAtom)

  const officeShellSessionId =
    activeTab?.type === 'agent' && globalOfficeMode ? activeTab.sessionId : null
  const shellLayout = deriveShellLayout({
    topLevelMode,
    appMode,
    activeRailItem,
    activeTabType: activeTab?.type ?? null,
    hasCurrentSession: Boolean(currentSessionId),
    sidebarRequestedOpen,
    rightPanelRequestedOpen,
    rightRailItem,
    globalOfficeMode,
    hasOfficeSession: Boolean(officeShellSessionId),
    designEnabled,
    designFullscreen,
    designImmersive,
  })

  const showLeftSidebar = shellLayout.sidebar === 'open'
  const showRightPanel = shellLayout.inspector !== 'hidden'
  const inspectorOpen = shellLayout.inspector === 'open'
  const workspaceInactive = shellLayout.canvas !== 'none'
  const workspaceRef = useInertElement<HTMLElement>(workspaceInactive)

  const navRailWidth = NAV_RAIL_WIDTH
  const navSidebarWidth = NAV_SIDEBAR_WIDTH
  // 单一导航框架：rail 与 sidebar 并列，共享外框且不与主工作区重叠。
  const navClusterWidth = getNavClusterWidth(showLeftSidebar, navRailWidth, navSidebarWidth)
  const contentBaseInsetLeft = navClusterWidth + SHELL_EDGE_PADDING

  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useAtom(workspaceManagerOpenAtom)
  const [rightPanelWidth, setRightPanelWidth] = useAtom(agentSidePanelWidthAtom)
  const dragging = React.useRef(false)
  const clampedRightPanelWidth = clampRightPanelWidth(rightPanelWidth)

  const rightIslandWidth = inspectorOpen
    ? clampedRightPanelWidth + RIGHT_PANEL_RAIL_WIDTH
    : RIGHT_PANEL_RAIL_WIDTH

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
          setRightPanelWidth(clampRightPanelWidth(startWidth + delta))
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

  const wantMagnify = shellLayout.canvas === 'magnify'
  const wantImmersive = shellLayout.canvas === 'immersive'

  const magnify = useDelayedMount(wantMagnify)
  const immersive = useDelayedMount(wantImmersive)
  // Office 模式但 activeTab 还没恢复时，显示 loading
  const officeLoading = shellLayout.office === 'loading'

  // Esc 退出沉浸全屏
  React.useEffect(() => {
    if (!wantImmersive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      setDesignImmersive(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wantImmersive, setDesignImmersive])

  if (officeLoading) {
    return (
      <AppShellProvider value={contextValue}>
        <WindowControls />
        <div
          className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground"
          role="status"
        >
          <div className="flex items-center gap-3">
            <span className="size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            正在恢复办公室…
          </div>
        </div>
      </AppShellProvider>
    )
  }

  if (officeShellSessionId) {
    return (
      <AppShellProvider value={contextValue}>
        <WindowControls />
        <React.Suspense
          fallback={
            <div
              className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground"
              role="status"
            >
              正在进入办公室…
            </div>
          }
        >
          <OfficeImmersiveShell sessionId={officeShellSessionId} />
        </React.Suspense>
      </AppShellProvider>
    )
  }

  return (
    <AppShellProvider value={contextValue}>
      <div
        className={cn(
          'app-shell-scene relative flex h-screen w-screen overflow-hidden',
          isMac ? 'app-shell-scene--mac' : 'app-shell-scene--win'
        )}
        data-shell-scene={shellLayout.scene}
        data-canvas-presentation={shellLayout.canvas}
        data-composer-placement={shellLayout.composer}
        style={{
          ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
          ['--nav-island-outer-radius-tl' as string]: `${isMac ? NAV_ISLAND_MAC_TOP_LEFT_RADIUS : NAV_ISLAND_OUTER_RADIUS}px`,
        }}
      >
        <SpatialTopBar />

        <InertRegion
          className="app-shell-nav"
          data-presence={shellLayout.navigation}
          inactive={shellLayout.navigation === 'hidden'}
        >
          <NavIsland
            sidebarPresence={shellLayout.sidebar}
            sidebarWidth={navSidebarWidth}
            railWidth={navRailWidth}
          >
            <FunctionalRail />
            <LeftSidebar activeRailItem={activeRailItem} width={navSidebarWidth} />
          </NavIsland>
        </InertRegion>

        <ProjectManagerDialog open={workspaceManagerOpen} onOpenChange={setWorkspaceManagerOpen} />

        <main
          ref={workspaceRef}
          className="app-shell-main"
          aria-hidden={workspaceInactive || undefined}
        >
          <div
            className={cn(
              'app-shell-content-stage relative h-full min-h-0',
              showRightPanel && 'app-shell-content-stage--right-rail',
              showRightPanel && inspectorOpen && 'app-shell-content-stage--right-open'
            )}
            style={{
              ['--content-chrome-bleed-left' as string]: '0px',
              ['--content-chrome-bleed-right' as string]: '0px',
              ['--content-foreground-safe-right' as string]:
                shellLayout.inspector === 'collapsed' ? `${RIGHT_PANEL_RAIL_WIDTH}px` : '0px',
            }}
          >
            <div className="app-content-foreground relative h-full min-h-0">
              <MainArea />
            </div>
          </div>
        </main>

        {/* 放大模式覆盖层 */}
        {magnify.mounted && (
          <div
            className="design-mode-overlay design-mode-overlay--magnify"
            data-open={magnify.open ? 'true' : 'false'}
            style={{ left: `${contentBaseInsetLeft + 8}px` }}
            aria-hidden={!magnify.open}
          >
            <div className="flex min-h-0 flex-1">
              <div className="design-theater-chat flex h-full shrink-0 flex-col border-r border-border/40 bg-background">
                <div className="design-theater-chat-inner min-h-0 flex-1">
                  <MainArea />
                </div>
                <div className="flex shrink-0 items-center justify-between border-t border-border/30 px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-primary">放大模式</span>
                  <button
                    type="button"
                    onClick={() => setDesignFullscreen(false)}
                    className="text-primary hover:underline"
                  >
                    退出放大
                  </button>
                </div>
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <DesignPreviewPanel />
              </div>
            </div>
          </div>
        )}

        {/* 沉浸全屏覆盖层（盖住整个壳层；操作在 Dock） */}
        {immersive.mounted && <DesignImmersiveLayout open={immersive.open} />}

        {showRightPanel && (
          <div
            className={cn(
              inspectorOpen
                ? 'app-shell-right-stack app-shell-right-stack--open'
                : 'app-shell-right-stack app-shell-right-stack--collapsed',
              wantImmersive && 'pointer-events-none opacity-0'
            )}
          >
            {inspectorOpen && (
              <div
                className="absolute bottom-0 left-0 top-0 z-20 w-[8px] -translate-x-1/2 cursor-col-resize transition-colors hover:bg-primary/30 active:bg-primary/50"
                onMouseDown={handleMouseDown}
              />
            )}

            <div
              className={cn(
                'right-nav-island-glass nav-island-glass nav-island-glass--float',
                'relative ml-auto flex h-full min-h-0 flex-row justify-end overflow-hidden',
                inspectorOpen && 'nav-island-glass--expanded',
                isMac && 'right-nav-island-glass--mac'
              )}
              style={{
                width: rightIslandWidth,
                ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
                ['--nav-rail-width' as string]: `${RIGHT_PANEL_RAIL_WIDTH}px`,
              }}
            >
              {inspectorOpen && (
                <InertRegion
                  className="nav-island-sidebar nav-island-body relative z-[1] flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                  data-presence={shellLayout.inspector}
                  inactive={false}
                >
                  <RightInspectorFrame width={clampedRightPanelWidth} />
                </InertRegion>
              )}

              <RightPanelRail panelOpen={inspectorOpen} />
            </div>
          </div>
        )}
      </div>
    </AppShellProvider>
  )
}
