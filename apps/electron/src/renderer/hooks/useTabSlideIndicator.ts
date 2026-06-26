import * as React from 'react'

import { LIST_SLIDE_TRANSITION } from '@/lib/list-slide-selection'

function tabItemSelector(tabId: string): string {
  return `[data-tab-id="${tabId}"]`
}

interface TabIndicatorMetrics {
  left: number
  width: number
  top: number
  height: number
}

export interface TabSlideIndicatorStyles {
  plateStyle: React.CSSProperties | null
  indicatorStyle: React.CSSProperties | null
}

const EMPTY_STYLES: TabSlideIndicatorStyles = {
  plateStyle: null,
  indicatorStyle: null,
}

function measureTabItem(container: HTMLElement, tabId: string): TabIndicatorMetrics | null {
  const item = container.querySelector<HTMLElement>(tabItemSelector(tabId))
  if (!item) return null
  return {
    left: item.offsetLeft,
    width: item.offsetWidth,
    top: item.offsetTop,
    height: item.offsetHeight,
  }
}

function metricsToStyle(metrics: TabIndicatorMetrics, transition: string): React.CSSProperties {
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

function metricsToIndicatorStyle(
  metrics: TabIndicatorMetrics,
  transition: string
): React.CSSProperties {
  return {
    display: 'block',
    position: 'absolute',
    left: metrics.left + 12,
    width: Math.max(0, metrics.width - 24),
    bottom: 0,
    height: 2,
    transition,
  }
}

export function useTabSlideIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  activeTabId: string | null
): TabSlideIndicatorStyles {
  const prevActiveTabRef = React.useRef<string | null>(null)
  const lastSettledTabRef = React.useRef<string | null>(null)
  const [styles, setStyles] = React.useState<TabSlideIndicatorStyles>(EMPTY_STYLES)

  function buildStyles(metrics: TabIndicatorMetrics, animate: boolean): TabSlideIndicatorStyles {
    const plateTransition = animate ? LIST_SLIDE_TRANSITION : 'none'
    const indicatorTransition = animate
      ? 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none'

    return {
      plateStyle: metricsToStyle(metrics, plateTransition),
      indicatorStyle: metricsToIndicatorStyle(metrics, indicatorTransition),
    }
  }

  const applyMetrics = React.useCallback(
    (animate: boolean) => {
      const container = containerRef.current
      if (!container || !activeTabId) {
        setStyles(EMPTY_STYLES)
        lastSettledTabRef.current = null
        return
      }

      const metrics = measureTabItem(container, activeTabId)
      if (!metrics) return

      setStyles(buildStyles(metrics, animate))
      lastSettledTabRef.current = activeTabId
    },
    [activeTabId, containerRef]
  )

  React.useLayoutEffect(() => {
    const prevTab = prevActiveTabRef.current
    const isTabChange = prevTab !== null && prevTab !== activeTabId

    if (!activeTabId) {
      setStyles(EMPTY_STYLES)
      lastSettledTabRef.current = null
      return
    }

    if (!isTabChange) {
      if (lastSettledTabRef.current === activeTabId) return
      applyMetrics(false)
      return
    }

    applyMetrics(true)
  }, [activeTabId, applyMetrics])

  React.useEffect(() => {
    prevActiveTabRef.current = activeTabId
  }, [activeTabId])

  const activeTabIdRef = React.useRef(activeTabId)
  activeTabIdRef.current = activeTabId

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const syncPosition = (): void => {
      const tabId = activeTabIdRef.current
      if (!tabId) return
      const metrics = measureTabItem(container, tabId)
      if (!metrics) return
      setStyles(buildStyles(metrics, false))
    }

    const resizeObserver = new ResizeObserver(syncPosition)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef])

  return styles
}
