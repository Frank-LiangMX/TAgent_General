import * as React from 'react'

import { LIST_SLIDE_ACCENT_TRANSITION, LIST_SLIDE_TRANSITION } from '@/lib/list-slide-selection'

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

  return {
    left: item.offsetLeft,
    width: item.offsetWidth,
    top: item.offsetTop,
    height: item.offsetHeight,
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
 */
export function useSessionListSlideIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  activeSessionId: string | null,
  layoutKey = ''
): SessionListSlideStyles {
  const prevActiveSessionRef = React.useRef<string | null>(null)
  const lastSettledSessionRef = React.useRef<string | null>(null)
  const lastLayoutKeyRef = React.useRef(layoutKey)
  const [styles, setStyles] = React.useState<SessionListSlideStyles>(EMPTY_STYLES)

  const applyMetrics = React.useCallback(
    (animate: boolean) => {
      const container = containerRef.current
      if (!container || !activeSessionId) {
        setStyles(EMPTY_STYLES)
        lastSettledSessionRef.current = null
        return
      }

      const metrics = measureSessionListItem(container, activeSessionId)
      if (!metrics) return

      setStyles(buildSlideStyles(metrics, animate))
      lastSettledSessionRef.current = activeSessionId
    },
    [activeSessionId, containerRef]
  )

  React.useLayoutEffect(() => {
    const prevSession = prevActiveSessionRef.current
    const isSessionChange = prevSession !== null && prevSession !== activeSessionId
    const isLayoutChange = lastLayoutKeyRef.current !== layoutKey
    lastLayoutKeyRef.current = layoutKey

    if (!activeSessionId) {
      setStyles(EMPTY_STYLES)
      lastSettledSessionRef.current = null
      return
    }

    if (!isSessionChange && !isLayoutChange) {
      if (lastSettledSessionRef.current === activeSessionId) return
      applyMetrics(false)
      return
    }

    applyMetrics(true)
  }, [activeSessionId, layoutKey, applyMetrics])

  React.useEffect(() => {
    prevActiveSessionRef.current = activeSessionId
  }, [activeSessionId])

  const activeSessionIdRef = React.useRef(activeSessionId)
  activeSessionIdRef.current = activeSessionId

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const syncPosition = (): void => {
      const sessionId = activeSessionIdRef.current
      if (!sessionId) return
      const metrics = measureSessionListItem(container, sessionId)
      if (!metrics) return
      setStyles(buildSlideStyles(metrics, false))
    }

    const resizeObserver = new ResizeObserver(syncPosition)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef])

  return styles
}
