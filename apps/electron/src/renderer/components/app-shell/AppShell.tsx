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
import {
  createInspectorMotionKeyframes,
  getInspectorProxyStyle,
  type InspectorMotionRect,
} from './right-inspector-motion'
import { deriveShellLayout } from './shell-layout'
import { SpatialTopBar } from './SpatialTopBar'

import {
  agentSidePanelOpenAtom,
  agentSidePanelPlacementAtom,
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
/** 覆盖层 / design 退场时长 */
const DESIGN_MODE_EXIT_MS = 260
/**
 * 右栏 morph：对齐 layout-direction-study 左侧边栏手法
 * - 真面板在 morph 中隐藏，由独立 surface 用 WAAPI 多关键帧做几何插值
 * - 内容先离场 / 后入场，不与面板几何抢同一条 transition
 */
const INSPECTOR_OPEN_MS = 300
const INSPECTOR_CLOSE_MS = 260
const INSPECTOR_CONTENT_LEAVE_MS = 42
const INSPECTOR_CONTENT_REVEAL_MS = 130
const RIGHT_RAIL_COLLAPSED_WIDTH = 46
const RIGHT_RAIL_COLLAPSED_HEIGHT_FALLBACK = 188

type InspectorPhase = 'collapsed' | 'opening' | 'open' | 'closing'

function clampRightPanelWidth(width: number): number {
  return Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, width))
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function measureCollapsedRailHeight(island: HTMLElement | null): number {
  if (!island) return RIGHT_RAIL_COLLAPSED_HEIGHT_FALLBACK
  const peek = island.querySelector<HTMLElement>('.right-panel-rail--peek')
  if (peek) {
    const h = Math.max(peek.scrollHeight, peek.offsetHeight)
    if (h > 40) return Math.ceil(h)
  }
  return RIGHT_RAIL_COLLAPSED_HEIGHT_FALLBACK
}

function localMorphRect(
  rect: DOMRect | InspectorMotionRect,
  overlay: DOMRect
): InspectorMotionRect {
  return {
    left: rect.left - overlay.left,
    top: rect.top - overlay.top,
    width: rect.width,
    height: rect.height,
  }
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
  const rightPanelPlacement = useAtomValue(agentSidePanelPlacementAtom)
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
  /** 真实占列：仅展开 + dock；折叠胶囊与 float 展开仍走 overlay */
  const inspectorDocked = inspectorOpen && rightPanelPlacement === 'dock'
  const workspaceInactive = shellLayout.canvas !== 'none'
  const workspaceRef = useInertElement<HTMLElement>(workspaceInactive)

  const navRailWidth = NAV_RAIL_WIDTH
  const navSidebarWidth = NAV_SIDEBAR_WIDTH
  // 单一导航框架：rail 与 sidebar 并列，共享外框且不与主工作区重叠。
  const navClusterWidth = getNavClusterWidth(showLeftSidebar, navRailWidth, navSidebarWidth)
  /* nav 贴 main（shell-island-gap=0）；光学左缝在 content 内 session-gutter */
  const contentBaseInsetLeft = navClusterWidth + SHELL_EDGE_PADDING

  const [workspaceManagerOpen, setWorkspaceManagerOpen] = useAtom(workspaceManagerOpenAtom)
  const [rightPanelWidth, setRightPanelWidth] = useAtom(agentSidePanelWidthAtom)
  const dragging = React.useRef(false)
  const clampedRightPanelWidth = clampRightPanelWidth(rightPanelWidth)

  const islandRef = React.useRef<HTMLDivElement>(null)
  const morphLayerRef = React.useRef<HTMLDivElement>(null)
  const morphSurfaceRef = React.useRef<HTMLDivElement>(null)
  const morphAnimRef = React.useRef<Animation | null>(null)
  const morphVersionRef = React.useRef(0)
  const contentLeavePendingRef = React.useRef(false)
  const wasInspectorOpenRef = React.useRef(inspectorOpen)
  const collapsedRailHeightRef = React.useRef(RIGHT_RAIL_COLLAPSED_HEIGHT_FALLBACK)
  const rightPanelWidthRef = React.useRef(clampedRightPanelWidth)
  rightPanelWidthRef.current = clampedRightPanelWidth
  /** morph 中隐藏真面板，由 surface 承担视觉（对齐原型 is-sidebar-morphing） */
  const [inspectorPhase, setInspectorPhase] = React.useState<InspectorPhase>(
    inspectorOpen ? 'open' : 'collapsed'
  )
  const [isContentLeaving, setIsContentLeaving] = React.useState(false)
  const [isContentRevealing, setIsContentRevealing] = React.useState(false)
  const inspectorShellExpanded = inspectorOpen || inspectorPhase !== 'collapsed'
  const isInspectorMorphing = inspectorPhase === 'opening' || inspectorPhase === 'closing'
  const inspectorClosing = !inspectorOpen && inspectorPhase !== 'collapsed'

  const resetMorphSurface = React.useCallback(() => {
    morphAnimRef.current?.cancel()
    morphAnimRef.current = null
    const surface = morphSurfaceRef.current
    if (!surface) return
    surface.classList.remove('is-active', 'is-opening', 'is-closing')
    surface.removeAttribute('style')
  }, [])

  React.useLayoutEffect(() => {
    if (inspectorShellExpanded) return
    collapsedRailHeightRef.current = measureCollapsedRailHeight(islandRef.current)
  }, [inspectorShellExpanded])

  // 四态空间过渡：真面板静置，代理层用 FLIP transform 完成胶囊 ↔ 面板 morph。
  React.useLayoutEffect(() => {
    const openingEdge = inspectorOpen && !wasInspectorOpenRef.current
    const closingEdge = !inspectorOpen && wasInspectorOpenRef.current
    wasInspectorOpenRef.current = inspectorOpen

    if (!openingEdge && !closingEdge) {
      return
    }

    const version = ++morphVersionRef.current
    let cancelled = false

    const run = async () => {
      if (prefersReducedMotion()) {
        contentLeavePendingRef.current = false
        setInspectorPhase(inspectorOpen ? 'open' : 'collapsed')
        setIsContentLeaving(false)
        setIsContentRevealing(false)
        resetMorphSurface()
        return
      }

      const layer = morphLayerRef.current
      const surface = morphSurfaceRef.current
      const island = islandRef.current
      if (!layer || !surface || !island) {
        contentLeavePendingRef.current = false
        resetMorphSurface()
        setInspectorPhase(inspectorOpen ? 'open' : 'collapsed')
        setIsContentLeaving(false)
        setIsContentRevealing(false)
        return
      }

      const activeAnimation = morphAnimRef.current
      if (
        activeAnimation &&
        surface.classList.contains('is-active') &&
        activeAnimation.playState !== 'finished'
      ) {
        surface.classList.toggle('is-opening', openingEdge)
        surface.classList.toggle('is-closing', closingEdge)
        setInspectorPhase(openingEdge ? 'opening' : 'closing')
        setIsContentLeaving(false)
        setIsContentRevealing(false)
        activeAnimation.reverse()
        await activeAnimation.finished.catch(() => undefined)
        if (cancelled || version !== morphVersionRef.current) return

        resetMorphSurface()
        setInspectorPhase(openingEdge ? 'open' : 'collapsed')
        if (openingEdge) {
          setIsContentRevealing(true)
          window.setTimeout(() => {
            if (version === morphVersionRef.current) setIsContentRevealing(false)
          }, INSPECTOR_CONTENT_REVEAL_MS)
        }
        return
      }

      if (openingEdge && contentLeavePendingRef.current) {
        contentLeavePendingRef.current = false
        setInspectorPhase('open')
        setIsContentLeaving(false)
        setIsContentRevealing(true)
        window.setTimeout(() => {
          if (version === morphVersionRef.current) setIsContentRevealing(false)
        }, INSPECTOR_CONTENT_REVEAL_MS)
        return
      }

      if (closingEdge) {
        setInspectorPhase('open')
        contentLeavePendingRef.current = true
        // 1) 内容先离场（原型 70ms）
        setIsContentLeaving(true)
        await waitMs(INSPECTOR_CONTENT_LEAVE_MS)
        if (cancelled || version !== morphVersionRef.current) return
        contentLeavePendingRef.current = false

        const overlay = layer.getBoundingClientRect()
        const panelRect = localMorphRect(island.getBoundingClientRect(), overlay)
        const capsuleRect: InspectorMotionRect = {
          left: panelRect.left + panelRect.width - RIGHT_RAIL_COLLAPSED_WIDTH,
          top: panelRect.top,
          width: RIGHT_RAIL_COLLAPSED_WIDTH,
          height: collapsedRailHeightRef.current,
        }

        morphAnimRef.current?.cancel()
        Object.assign(surface.style, {
          ...getInspectorProxyStyle(panelRect),
          opacity: '1',
        })
        surface.classList.add('is-active', 'is-closing')
        // 真面板隐藏；surface 演面板→胶囊（布局可先收成胶囊，视觉由 surface 接管）
        setInspectorPhase('closing')
        setIsContentLeaving(false)

        const anim = surface.animate(
          createInspectorMotionKeyframes(capsuleRect, panelRect, 'closing'),
          { duration: INSPECTOR_CLOSE_MS, easing: 'linear', fill: 'forwards' }
        )
        morphAnimRef.current = anim
        await anim.finished.catch(() => undefined)
        if (cancelled || version !== morphVersionRef.current) return

        surface.classList.remove('is-active', 'is-closing')
        surface.removeAttribute('style')
        morphAnimRef.current = null
        setInspectorPhase('collapsed')
        return
      }

      // openingEdge：先展开布局（真面板隐藏），surface 从胶囊演到满面板，再 reveal 内容
      setInspectorPhase('opening')
      setIsContentRevealing(false)

      const overlay = layer.getBoundingClientRect()
      const panelBox = island.getBoundingClientRect()
      // 若尚未铺满，用 stack 几何兜底
      const stackBox = island.parentElement?.getBoundingClientRect()
      const panelDom =
        panelBox.width > RIGHT_RAIL_COLLAPSED_WIDTH + 20
          ? panelBox
          : stackBox && stackBox.width > 0
            ? stackBox
            : panelBox
      const panelRect = localMorphRect(panelDom, overlay)
      // 强制目标为当前面板宽 × stack 高（右缘对齐）
      panelRect.width = rightPanelWidthRef.current
      panelRect.left = panelRect.left + panelDom.width - rightPanelWidthRef.current
      panelRect.height = stackBox?.height || panelRect.height

      const capsuleRect: InspectorMotionRect = {
        left: panelRect.left + panelRect.width - RIGHT_RAIL_COLLAPSED_WIDTH,
        top: panelRect.top,
        width: RIGHT_RAIL_COLLAPSED_WIDTH,
        height: collapsedRailHeightRef.current,
      }

      morphAnimRef.current?.cancel()
      Object.assign(surface.style, {
        ...getInspectorProxyStyle(panelRect),
        opacity: '0.96',
      })
      surface.classList.add('is-active', 'is-opening')

      const anim = surface.animate(
        createInspectorMotionKeyframes(capsuleRect, panelRect, 'opening'),
        { duration: INSPECTOR_OPEN_MS, easing: 'linear', fill: 'forwards' }
      )
      morphAnimRef.current = anim
      await anim.finished.catch(() => undefined)
      if (cancelled || version !== morphVersionRef.current) return

      surface.classList.remove('is-active', 'is-opening')
      surface.removeAttribute('style')
      morphAnimRef.current = null
      setInspectorPhase('open')
      setIsContentRevealing(true)
      window.setTimeout(() => {
        if (version === morphVersionRef.current) setIsContentRevealing(false)
      }, INSPECTOR_CONTENT_REVEAL_MS)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [inspectorOpen, resetMorphSurface])

  React.useEffect(() => {
    return () => {
      morphVersionRef.current += 1
      contentLeavePendingRef.current = false
      resetMorphSurface()
    }
  }, [resetMorphSurface])

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
        data-right-placement={
          inspectorOpen ? rightPanelPlacement : showRightPanel ? 'collapsed' : 'hidden'
        }
        style={{
          ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
          ['--nav-island-outer-radius-tl' as string]: `${isMac ? NAV_ISLAND_MAC_TOP_LEFT_RADIUS : NAV_ISLAND_OUTER_RADIUS}px`,
          /* dock 占位：面板宽 + 窗右 gutter；与左栏一样结构缝 0，光学缝靠 session-gutter */
          ['--right-inspector-width' as string]: `${clampedRightPanelWidth}px`,
          ['--right-inspector-reserve' as string]: inspectorDocked
            ? `calc(${clampedRightPanelWidth}px + var(--spatial-gutter))`
            : '0px',
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
            className="app-shell-content-stage relative h-full min-h-0"
            style={{
              ['--content-chrome-bleed-left' as string]: '0px',
              ['--content-chrome-bleed-right' as string]: '0px',
              /* 折叠避开胶囊；float 可重叠；dock 由 main margin-right 动画占位 */
              ['--content-foreground-safe-right' as string]:
                shellLayout.inspector === 'collapsed' ? '56px' : '0px',
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

        {/* 右栏 morph 层：对齐原型 sidebar-morph-surface（真面板 morph 时隐藏） */}
        <div ref={morphLayerRef} className="right-inspector-morph-layer" aria-hidden>
          <div ref={morphSurfaceRef} className="right-inspector-morph-surface" />
        </div>

        {showRightPanel && (
          <div
            className={cn(
              'app-shell-right-stack',
              inspectorShellExpanded
                ? 'app-shell-right-stack--open'
                : 'app-shell-right-stack--collapsed',
              inspectorShellExpanded &&
                (rightPanelPlacement === 'dock'
                  ? 'app-shell-right-stack--dock'
                  : 'app-shell-right-stack--float'),
              inspectorClosing && 'app-shell-right-stack--inspector-closing',
              isInspectorMorphing && 'app-shell-right-stack--inspector-morphing',
              isContentLeaving && 'app-shell-right-stack--content-leaving',
              isContentRevealing && 'app-shell-right-stack--content-revealing',
              wantImmersive && 'pointer-events-none opacity-0'
            )}
            data-placement={
              inspectorClosing ? 'closing' : inspectorOpen ? rightPanelPlacement : 'collapsed'
            }
            aria-label={inspectorOpen ? '上下文检查器' : '上下文快捷入口'}
          >
            {inspectorOpen && !isInspectorMorphing && (
              <div
                className="app-shell-right-resize-handle absolute bottom-0 left-0 top-0 z-20 w-[8px] -translate-x-1/2 cursor-col-resize transition-colors hover:bg-primary/30 active:bg-primary/50"
                onMouseDown={handleMouseDown}
              />
            )}

            <div
              ref={islandRef}
              data-session-transition-enter="rail"
              className={cn(
                'right-nav-island-glass nav-island-glass nav-island-glass--float',
                'relative ml-auto flex min-h-0 flex-col',
                inspectorShellExpanded
                  ? 'h-full min-h-full flex-1 overflow-hidden self-stretch'
                  : 'h-auto overflow-visible justify-start',
                inspectorShellExpanded && 'nav-island-glass--expanded',
                isMac && inspectorShellExpanded && 'right-nav-island-glass--mac'
              )}
              style={{
                width: inspectorShellExpanded ? clampedRightPanelWidth : RIGHT_RAIL_COLLAPSED_WIDTH,
                ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
                ['--nav-rail-width' as string]: `${RIGHT_PANEL_RAIL_WIDTH}px`,
              }}
            >
              {inspectorPhase === 'open' && (
                <InertRegion
                  className="nav-island-sidebar nav-island-body relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden"
                  data-presence={shellLayout.inspector}
                  inactive={!inspectorOpen}
                >
                  <RightInspectorFrame width={clampedRightPanelWidth} />
                </InertRegion>
              )}

              {/*
                竖向 rail 只属于折叠胶囊。
                展开态入口在顶栏 tabs，禁止再挂 peek（会叠在面板右侧）。
                morph 时也不挂：胶囊高度用 fallback，避免展开后还露一列图标。
              */}
              {!inspectorShellExpanded && (
                <RightPanelRail panelOpen={false} className="right-panel-rail--peek" />
              )}
            </div>
          </div>
        )}
      </div>
    </AppShellProvider>
  )
}
