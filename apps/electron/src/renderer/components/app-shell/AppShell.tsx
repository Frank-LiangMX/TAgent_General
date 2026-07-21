/**
 * AppShell - 应用主布局容器
 *
 * Design Preview 两种扩展布局（覆盖层 + 轻量进退场动画）：
 * - 放大模式（fullscreen）：覆盖主内容区，仍露出左侧导航浮岛
 * - 沉浸全屏（immersive）：盖住整个壳层，只留会话 + 画布
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Minimize2 } from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'

import { FunctionalRail } from './FunctionalRail'
import { InertRegion, useInertElement } from './InertRegion'
import { LeftSidebar } from './LeftSidebar'
import { getNavClusterWidth, NavIsland } from './NavIsland'
import { RightInspectorFrame } from './RightInspectorFrame'
import { RightPanelRail } from './RightPanelRail'
import { shouldDismissFloatInspector } from './right-inspector-dismiss'
import {
  createInspectorMotionKeyframes,
  getInspectorProxyStyle,
  INSPECTOR_MOTION_EASE,
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
  inspectorMagnifiedAtom,
  focusSplitRatioAtom,
} from '@/atoms/app-mode'
import { activeTabAtom } from '@/atoms/tab-atoms'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import {
  designFullscreenAtom,
  designEnabledAtom,
  designImmersiveAtom,
} from '@/atoms/design-preview-atoms'
import { DesignImmersiveLayout } from '@/components/design-preview/DesignImmersiveLayout'
import { RailItemContent } from '@/components/app-shell/RightSidePanel'
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
 * 右栏 morph：
 * - 代理 surface 做胶囊↔面板几何
 * - 结束后与真面板「交叠交接」（先挂真壳、再溶掉代理），避免闪一下
 * - 缓动偏线性，减少末端阻尼爬行
 */
const INSPECTOR_OPEN_MS = 200
const INSPECTOR_CLOSE_MS = 170
/** 关闭时内容离场尽量短 */
const INSPECTOR_CONTENT_LEAVE_MS = 16
/** 内容淡入（仅 header/tabs/body，壳层不闪） */
const INSPECTOR_CONTENT_REVEAL_MS = 80
/** 代理盖住真壳的交叠帧 + 溶出时长 */
const INSPECTOR_HANDOFF_FADE_MS = 48
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

/** 等 n 帧 paint，用于 morph 代理与真面板交叠交接 */
function waitFrames(count = 1): Promise<void> {
  return new Promise((resolve) => {
    let left = Math.max(1, count)
    const tick = () => {
      left -= 1
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
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
  const setRightPanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const rightPanelPlacement = useAtomValue(agentSidePanelPlacementAtom)
  const sidebarRequestedOpen = useAtomValue(navigationSidebarOpenAtom)
  const rightRailItem = useAtomValue(rightRailItemAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)
  const activeTab = useAtomValue(activeTabAtom)
  const globalOfficeMode = useAtomValue(globalOfficeModeAtom)
  const designFullscreen = useAtomValue(designFullscreenAtom)
  const designEnabled = useAtomValue(designEnabledAtom)
  const designImmersive = useAtomValue(designImmersiveAtom)
  const inspectorMagnified = useAtomValue(inspectorMagnifiedAtom)
  const setInspectorMagnified = useSetAtom(inspectorMagnifiedAtom)
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
    inspectorMagnified,
    globalOfficeMode,
    hasOfficeSession: Boolean(officeShellSessionId),
    designEnabled,
    designFullscreen,
    designImmersive,
  })

  const exitMagnify = React.useCallback(() => {
    setInspectorMagnified(false)
    setDesignFullscreen(false)
  }, [setDesignFullscreen, setInspectorMagnified])

  // 聚焦模式：会话列 / 面板分界线拖拽
  const [focusSplitRatio, setFocusSplitRatio] = useAtom(focusSplitRatioAtom)
  const focusDragging = React.useRef(false)
  const handleFocusSplitDrag = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const containerEl = (e.currentTarget as HTMLElement).closest(
        '[data-focus-split]'
      ) as HTMLElement | null
      if (!containerEl) return
      focusDragging.current = true
      const rect = containerEl.getBoundingClientRect()
      let rafId = 0

      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      // 拖拽期间避免 iframe / webview 吞掉 mousemove
      document.querySelectorAll('iframe, webview').forEach((f) => {
        ;(f as HTMLElement).style.pointerEvents = 'none'
      })

      const onMouseMove = (ev: MouseEvent) => {
        if (!focusDragging.current || rafId) return
        rafId = requestAnimationFrame(() => {
          rafId = 0
          const ratio = (ev.clientX - rect.left) / Math.max(1, rect.width)
          setFocusSplitRatio(Math.max(0.28, Math.min(0.62, ratio)))
        })
      }
      const onMouseUp = () => {
        focusDragging.current = false
        if (rafId) cancelAnimationFrame(rafId)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        document.querySelectorAll('iframe, webview').forEach((f) => {
          ;(f as HTMLElement).style.pointerEvents = ''
        })
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [setFocusSplitRatio]
  )

  const showLeftSidebar = shellLayout.sidebar === 'open'
  const showRightPanel = shellLayout.inspector !== 'hidden'
  const inspectorOpen = shellLayout.inspector === 'open'
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

  const rightStackRef = React.useRef<HTMLDivElement>(null)
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

  /**
   * dock 占位跟 phase（对齐左栏 shellExpanded）：
   * opening 才撑开、closing 即收窄；禁止用 inspectorOpen（一点击 main 秒切）。
   */
  const dockReserveActive =
    rightPanelPlacement === 'dock' && (inspectorPhase === 'open' || inspectorPhase === 'opening')
  const rightLayoutMotionMs =
    rightPanelPlacement === 'dock' && inspectorPhase === 'opening'
      ? INSPECTOR_OPEN_MS
      : rightPanelPlacement === 'dock' && inspectorPhase === 'closing'
        ? INSPECTOR_CLOSE_MS
        : 240
  /** morph / 收起过程中保持 dock，避免 data 掉成 collapsed 导致 main 过渡被关掉 */
  const rightPlacementAttr =
    rightPanelPlacement === 'dock' && inspectorPhase !== 'collapsed'
      ? 'dock'
      : inspectorOpen
        ? rightPanelPlacement
        : showRightPanel
          ? 'collapsed'
          : 'hidden'

  const resetMorphSurface = React.useCallback(() => {
    morphAnimRef.current?.cancel()
    morphAnimRef.current = null
    const surface = morphSurfaceRef.current
    if (!surface) return
    surface.classList.remove('is-active', 'is-opening', 'is-closing')
    surface.removeAttribute('style')
  }, [])

  /**
   * float 浮层：点 inspector 外自动收起；dock 占位常驻，不监听。
   * morph 中不响应，避免动画期间误关。
   */
  React.useEffect(() => {
    if (!inspectorOpen) return
    if (rightPanelPlacement !== 'float') return
    if (isInspectorMorphing) return

    const onPointerDown = (event: PointerEvent): void => {
      if (!shouldDismissFloatInspector(event.target, rightStackRef.current ?? islandRef.current)) {
        return
      }
      setRightPanelOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [inspectorOpen, rightPanelPlacement, isInspectorMorphing, setRightPanelOpen])

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

      /**
       * 交叠交接：代理仍盖在上面 → 挂真壳并 paint → 代理溶出。
       * 禁止「先卸代理、再挂真壳」（会空一帧闪白/闪空）。
       */
      const handoffToReal = async (mode: 'open' | 'collapsed') => {
        const finishedAnim = morphAnimRef.current
        // 把 WAAPI 终态写进 inline，再 cancel，避免 fill:forwards 锁死 opacity
        if (finishedAnim) {
          try {
            finishedAnim.commitStyles()
          } catch {
            // 部分环境无 commitStyles：忽略，依赖当前 computed
          }
          finishedAnim.cancel()
          morphAnimRef.current = null
        }

        // 代理固定盖在终态几何上（展开=满面板，收回=胶囊）
        surface.style.opacity = '1'
        surface.style.transition = 'none'
        surface.classList.add('is-active')

        if (mode === 'open') {
          // 内容直接上，不再 0→1 二次淡入（否则代理溶掉后会「空壳再闪内容」）
          setInspectorPhase('open')
          setIsContentRevealing(false)
        } else {
          setInspectorPhase('collapsed')
          setIsContentRevealing(false)
        }
        setIsContentLeaving(false)

        // 等 React commit + 真壳至少 paint 一帧（含 backdrop-filter 首帧）
        await waitFrames(2)
        if (cancelled || version !== morphVersionRef.current) return

        // 代理轻溶：盖住真壳与代理材质差
        surface.style.transition = `opacity ${INSPECTOR_HANDOFF_FADE_MS}ms linear`
        // 强制 reflow，确保 transition 生效
        void surface.offsetWidth
        surface.style.opacity = '0'
        await waitMs(INSPECTOR_HANDOFF_FADE_MS)
        if (cancelled || version !== morphVersionRef.current) return

        surface.classList.remove('is-active', 'is-opening', 'is-closing')
        surface.removeAttribute('style')
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
        await handoffToReal(openingEdge ? 'open' : 'collapsed')
        return
      }

      if (openingEdge && contentLeavePendingRef.current) {
        contentLeavePendingRef.current = false
        setIsContentLeaving(false)
        // 关闭中途又打开：代理可能不在，直接真壳
        if (surface.classList.contains('is-active')) {
          await handoffToReal('open')
        } else {
          setInspectorPhase('open')
          setIsContentRevealing(true)
          window.setTimeout(() => {
            if (version === morphVersionRef.current) setIsContentRevealing(false)
          }, INSPECTOR_CONTENT_REVEAL_MS)
        }
        return
      }

      if (closingEdge) {
        // 关闭：先量展开几何，再卸内容 + morph
        contentLeavePendingRef.current = true
        setIsContentLeaving(true)

        const overlay = layer.getBoundingClientRect()
        const panelRect = localMorphRect(island.getBoundingClientRect(), overlay)
        const capsuleRect: InspectorMotionRect = {
          left: panelRect.left + panelRect.width - RIGHT_RAIL_COLLAPSED_WIDTH,
          top: panelRect.top,
          width: RIGHT_RAIL_COLLAPSED_WIDTH,
          height: collapsedRailHeightRef.current,
        }

        await waitMs(INSPECTOR_CONTENT_LEAVE_MS)
        if (cancelled || version !== morphVersionRef.current) return
        contentLeavePendingRef.current = false

        morphAnimRef.current?.cancel()
        surface.style.transition = ''
        Object.assign(surface.style, {
          ...getInspectorProxyStyle(panelRect),
          opacity: '1',
        })
        surface.classList.add('is-active', 'is-closing')
        surface.classList.remove('is-opening')
        // 真面板隐藏并卸载内容；surface 演面板→胶囊
        setInspectorPhase('closing')
        setIsContentLeaving(false)

        const anim = surface.animate(
          createInspectorMotionKeyframes(capsuleRect, panelRect, 'closing'),
          {
            duration: INSPECTOR_CLOSE_MS,
            easing: INSPECTOR_MOTION_EASE,
            fill: 'forwards',
          }
        )
        morphAnimRef.current = anim
        await anim.finished.catch(() => undefined)
        if (cancelled || version !== morphVersionRef.current) return
        await handoffToReal('collapsed')
        return
      }

      // openingEdge：先展开布局（真面板隐藏），surface 从胶囊演到满面板
      setInspectorPhase('opening')
      setIsContentRevealing(false)

      const overlay = layer.getBoundingClientRect()
      const panelBox = island.getBoundingClientRect()
      const stackBox = island.parentElement?.getBoundingClientRect()
      const panelDom =
        panelBox.width > RIGHT_RAIL_COLLAPSED_WIDTH + 20
          ? panelBox
          : stackBox && stackBox.width > 0
            ? stackBox
            : panelBox
      const panelRect = localMorphRect(panelDom, overlay)
      panelRect.width = rightPanelWidthRef.current
      panelRect.left = panelRect.left + panelDom.width - rightPanelWidthRef.current
      const bandHeight =
        stackBox && stackBox.height > RIGHT_RAIL_COLLAPSED_HEIGHT_FALLBACK
          ? stackBox.height
          : panelRect.height
      panelRect.height = bandHeight

      const capsuleRect: InspectorMotionRect = {
        left: panelRect.left + panelRect.width - RIGHT_RAIL_COLLAPSED_WIDTH,
        top: panelRect.top,
        width: RIGHT_RAIL_COLLAPSED_WIDTH,
        height: collapsedRailHeightRef.current,
      }

      morphAnimRef.current?.cancel()
      surface.style.transition = ''
      Object.assign(surface.style, {
        ...getInspectorProxyStyle(panelRect),
        opacity: '1',
      })
      surface.classList.add('is-active', 'is-opening')
      surface.classList.remove('is-closing')

      const anim = surface.animate(
        createInspectorMotionKeyframes(capsuleRect, panelRect, 'opening'),
        {
          duration: INSPECTOR_OPEN_MS,
          easing: INSPECTOR_MOTION_EASE,
          fill: 'forwards',
        }
      )
      morphAnimRef.current = anim
      await anim.finished.catch(() => undefined)
      if (cancelled || version !== morphVersionRef.current) return
      await handoffToReal('open')
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

  // Esc 退出沉浸全屏 / 放大模式
  React.useEffect(() => {
    if (!wantImmersive && !wantMagnify) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (wantImmersive) {
        setDesignImmersive(false)
        return
      }
      exitMagnify()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wantImmersive, wantMagnify, setDesignImmersive, exitMagnify])

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
        data-right-placement={rightPlacementAttr}
        style={{
          ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
          ['--nav-island-outer-radius-tl' as string]: `${isMac ? NAV_ISLAND_MAC_TOP_LEFT_RADIUS : NAV_ISLAND_OUTER_RADIUS}px`,
          /* dock 占位：跟 phase 同步过渡，与 morph / 左栏让位同拍 */
          ['--right-inspector-width' as string]: `${clampedRightPanelWidth}px`,
          ['--right-inspector-reserve' as string]: dockReserveActive
            ? `calc(${clampedRightPanelWidth}px + var(--spatial-gutter))`
            : '0px',
          ['--right-inspector-layout-ms' as string]: `${rightLayoutMotionMs}ms`,
          ['--right-inspector-layout-ease' as string]: INSPECTOR_MOTION_EASE,
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
            activeRailItem={activeRailItem}
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

        {/* 聚焦模式：收起导航，只留 main（会话 | 面板）浮在场景渐变上 */}
        {magnify.mounted && (
          <div
            className="design-mode-overlay design-mode-overlay--magnify"
            data-open={magnify.open ? 'true' : 'false'}
            aria-hidden={!magnify.open}
          >
            <div className="focus-stage flex min-h-0 flex-1" data-focus-split>
              <div
                className="design-theater-chat focus-stage-chat flex h-full shrink-0 flex-col"
                style={{ width: `${focusSplitRatio * 100}%` }}
              >
                <div className="design-theater-chat-inner app-shell-content-stage min-h-0 flex-1">
                  <MainArea />
                </div>
              </div>
              <div
                className="focus-split-handle titlebar-no-drag"
                role="separator"
                aria-orientation="vertical"
                aria-label="拖拽调整会话与面板宽度"
                onMouseDown={handleFocusSplitDrag}
              />
              <div className="focus-stage-panel relative min-w-0 flex-1 overflow-hidden">
                <RailItemContent item={rightRailItem} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="focus-exit-btn titlebar-no-drag absolute right-3 top-3 z-20"
                      onClick={exitMagnify}
                      aria-label="退出聚焦模式"
                    >
                      <Minimize2 size={15} strokeWidth={1.5} aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">退出聚焦（Esc）</TooltipContent>
                </Tooltip>
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
            ref={rightStackRef}
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
                  <RightInspectorFrame />
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
