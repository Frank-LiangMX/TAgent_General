import * as React from 'react'

import { LIST_SLIDE_ACCENT_TRANSITION, LIST_SLIDE_TRANSITION } from '@/lib/list-slide-selection'

/** 布局过渡（折叠/展开约 200ms）跟随循环时长，略长以覆盖收尾帧 */
const FOLLOW_DURATION_MS = 320
/** 会话切换滑动时长，对齐 LIST_SLIDE_TRANSITION 的 0.35s */
const SLIDE_LOCK_MS = 380
const FRAME_MS = 16

/** @deprecated 使用 LIST_SLIDE_TRANSITION */
export const SESSION_LIST_SLIDE_TRANSITION = LIST_SLIDE_TRANSITION

/** @deprecated 使用 LIST_SLIDE_ACCENT_TRANSITION */
export const SESSION_LIST_ACCENT_TRANSITION = LIST_SLIDE_ACCENT_TRANSITION

export function sessionListItemSelector(sessionId: string): string {
  return `[data-session-list-id="${sessionId}"]`
}

interface SessionListIndicatorMetrics {
  left: number
  width: number
  top: number
  height: number
}

export interface SessionListSlideStyles {
  plateStyle: React.CSSProperties | null
  accentStyle: React.CSSProperties | null
}

const EMPTY_STYLES: SessionListSlideStyles = {
  plateStyle: null,
  accentStyle: null,
}

function measureSessionListItem(
  container: HTMLElement,
  sessionId: string
): SessionListIndicatorMetrics | null {
  const item = container.querySelector<HTMLElement>(sessionListItemSelector(sessionId))
  if (!item) return null

  const containerRect = container.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()

  return {
    left: itemRect.left - containerRect.left,
    width: itemRect.width,
    top: itemRect.top - containerRect.top + container.scrollTop,
    height: itemRect.height,
  }
}

function rowMetricsToAccentMetrics(row: SessionListIndicatorMetrics): SessionListIndicatorMetrics {
  return {
    left: row.left + 6,
    top: row.top + 8,
    width: 3,
    height: Math.max(0, row.height - 16),
  }
}

function metricsToPlateStyle(
  metrics: SessionListIndicatorMetrics,
  transition: string
): React.CSSProperties {
  return {
    display: 'block',
    position: 'absolute',
    left: metrics.left,
    width: metrics.width,
    top: metrics.top,
    height: metrics.height,
    transition,
  }
}

function metricsToAccentStyle(
  metrics: SessionListIndicatorMetrics,
  transition: string
): React.CSSProperties {
  return {
    display: 'block',
    position: 'absolute',
    left: metrics.left,
    width: metrics.width,
    top: metrics.top,
    height: metrics.height,
    transition,
  }
}

function buildSlideStyles(
  rowMetrics: SessionListIndicatorMetrics,
  animate: boolean
): SessionListSlideStyles {
  const plateTransition = animate ? LIST_SLIDE_TRANSITION : 'none'
  const accentTransition = animate ? LIST_SLIDE_ACCENT_TRANSITION : 'none'

  return {
    plateStyle: metricsToPlateStyle(rowMetrics, plateTransition),
    accentStyle: metricsToAccentStyle(rowMetricsToAccentMetrics(rowMetrics), accentTransition),
  }
}

/**
 * 侧栏会话列表滑动指示器：玻璃底板 + 左侧状态竖条同步滑动
 *
 * 定位策略（修复折叠/展开期间蒙版错乱 + 保留切换滑动）：
 * - 会话切换：启动 ~0.38s 滑动锁定，期间每帧带 transition 让浏览器平滑插值到新位置
 * - 布局变化（折叠/展开/resize/滚动）：触发限时跟随循环，滑动锁定外逐帧无动画贴合选中项真实位置
 * - 任意时刻蒙版只由唯一来源（跟随循环）更新，避免多更新源互相覆盖导致抖动
 * - 无事件时循环自动停止，降低主线程开销
 */
export function useSessionListSlideIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  activeSessionId: string | null,
  layoutKey = ''
): SessionListSlideStyles {
  const [styles, setStyles] = React.useState<SessionListSlideStyles>(EMPTY_STYLES)

  // 当前生效的 sessionId（跟随循环闭包内读取，保证拿到最新值）
  const activeSessionIdRef = React.useRef<string | null>(activeSessionId)
  activeSessionIdRef.current = activeSessionId

  // 上一次的 sessionId，用于判定是否为切换（切换启动滑动锁定）
  const prevActiveSessionRef = React.useRef<string | null>(null)

  // 跟随循环：限时续命，无事件时自动停止
  const rafRef = React.useRef(0)
  const idleUntilRef = React.useRef(0)
  // 滑动锁定到期时间：期间每帧带 transition，让浏览器平滑播放切换滑动，
  // 避免无动画帧提前截断 transition 导致"像跳大类"的生硬切换
  const slideLockUntilRef = React.useRef(0)

  // 启动/续命跟随循环。幂等：已在跑则只续命。
  const kickFollowLoop = React.useCallback(() => {
    idleUntilRef.current = performance.now() + FOLLOW_DURATION_MS
    if (rafRef.current) return

    const tick = (): void => {
      const container = containerRef.current
      const sessionId = activeSessionIdRef.current
      if (!container || !sessionId) {
        rafRef.current = 0
        return
      }

      const metrics = measureSessionListItem(container, sessionId)
      if (metrics) {
        // 滑动锁定期内持续带 transition（浏览器自行插值到新位置），
        // 过期后转无动画贴合（用于折叠/resize/滚动的逐帧跟随）
        const animate = performance.now() < slideLockUntilRef.current
        setStyles(buildSlideStyles(metrics, animate))
        idleUntilRef.current = performance.now() + FOLLOW_DURATION_MS
      }

      if (performance.now() < idleUntilRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = 0
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [containerRef])

  // 会话切换：启动滑动锁定，让蒙版平滑滑到新会话位置
  React.useLayoutEffect(() => {
    const prev = prevActiveSessionRef.current
    if (activeSessionId && prev !== null && prev !== activeSessionId) {
      slideLockUntilRef.current = performance.now() + SLIDE_LOCK_MS
    }
    prevActiveSessionRef.current = activeSessionId

    if (activeSessionId) {
      kickFollowLoop()
    } else {
      setStyles(EMPTY_STYLES)
    }
  }, [activeSessionId, kickFollowLoop])

  // 布局变化（折叠/展开改变 layoutKey）触发跟随
  React.useEffect(() => {
    if (!layoutKey) return
    if (activeSessionId) kickFollowLoop()
  }, [layoutKey, activeSessionId, kickFollowLoop])

  // 容器尺寸变化（resize / 折叠导致容器变高变矮）触发跟随
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      if (activeSessionIdRef.current) kickFollowLoop()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [containerRef, kickFollowLoop])

  // 滚动时跟随（选中项相对容器 top 随 scrollTop 变化）
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onScroll = (): void => {
      if (activeSessionIdRef.current) kickFollowLoop()
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [containerRef, kickFollowLoop])

  // 卸载时取消未完成的 rAF
  React.useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return styles
}
