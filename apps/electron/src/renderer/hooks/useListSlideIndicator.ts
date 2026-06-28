import * as React from 'react'

import { LIST_SLIDE_ACCENT_TRANSITION, LIST_SLIDE_TRANSITION } from '@/lib/list-slide-selection'

export interface ListIndicatorMetrics {
  left: number
  width: number
  top: number
  height: number
}

export interface ListSlideStyles {
  plateStyle: React.CSSProperties | null
  accentStyle: React.CSSProperties | null
}

export type ListItemMeasurer = (container: HTMLElement, itemId: string) => ListIndicatorMetrics | null

const EMPTY_STYLES: ListSlideStyles = {
  plateStyle: null,
  accentStyle: null,
}

export function createListItemSelector(dataAttr: string) {
  return (itemId: string): string => `[${dataAttr}="${itemId}"]`
}

export function measureOffsetListItem(
  dataAttr: string,
  container: HTMLElement,
  itemId: string
): ListIndicatorMetrics | null {
  const item = container.querySelector<HTMLElement>(`[${dataAttr}="${itemId}"]`)
  if (!item) return null

  return {
    left: item.offsetLeft,
    width: item.offsetWidth,
    top: item.offsetTop,
    height: item.offsetHeight,
  }
}

function rowMetricsToAccentMetrics(row: ListIndicatorMetrics): ListIndicatorMetrics {
  return {
    left: row.left + 6,
    top: row.top + 8,
    width: 3,
    height: Math.max(0, row.height - 16),
  }
}

function metricsToPlateStyle(metrics: ListIndicatorMetrics, transition: string): React.CSSProperties {
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

function metricsToAccentStyle(metrics: ListIndicatorMetrics, transition: string): React.CSSProperties {
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

function buildSlideStyles(rowMetrics: ListIndicatorMetrics, animate: boolean): ListSlideStyles {
  const plateTransition = animate ? LIST_SLIDE_TRANSITION : 'none'
  const accentTransition = animate ? LIST_SLIDE_ACCENT_TRANSITION : 'none'

  return {
    plateStyle: metricsToPlateStyle(rowMetrics, plateTransition),
    accentStyle: metricsToAccentStyle(rowMetricsToAccentMetrics(rowMetrics), accentTransition),
  }
}

/**
 * 通用列表滑动指示器：玻璃底板 + 左侧竖条同步滑动
 */
export function useListSlideIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  activeItemId: string | null,
  measureItem: ListItemMeasurer,
  layoutKey = ''
): ListSlideStyles {
  const prevActiveRef = React.useRef<string | null>(null)
  const lastSettledRef = React.useRef<string | null>(null)
  const lastLayoutKeyRef = React.useRef(layoutKey)
  const [styles, setStyles] = React.useState<ListSlideStyles>(EMPTY_STYLES)

  const applyMetrics = React.useCallback(
    (animate: boolean) => {
      const container = containerRef.current
      if (!container || !activeItemId) {
        setStyles(EMPTY_STYLES)
        lastSettledRef.current = null
        return
      }

      const metrics = measureItem(container, activeItemId)
      if (!metrics) return

      setStyles(buildSlideStyles(metrics, animate))
      lastSettledRef.current = activeItemId
    },
    [activeItemId, containerRef, measureItem]
  )

  React.useLayoutEffect(() => {
    const prevActive = prevActiveRef.current
    const isActiveChange = prevActive !== null && prevActive !== activeItemId
    const isLayoutChange = lastLayoutKeyRef.current !== layoutKey
    lastLayoutKeyRef.current = layoutKey

    if (!activeItemId) {
      setStyles(EMPTY_STYLES)
      lastSettledRef.current = null
      return
    }

    if (!isActiveChange && !isLayoutChange) {
      if (lastSettledRef.current === activeItemId) return
      applyMetrics(false)
      return
    }

    applyMetrics(true)
  }, [activeItemId, layoutKey, applyMetrics])

  React.useEffect(() => {
    prevActiveRef.current = activeItemId
  }, [activeItemId])

  const activeItemIdRef = React.useRef(activeItemId)
  activeItemIdRef.current = activeItemId

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const syncPosition = (): void => {
      const itemId = activeItemIdRef.current
      if (!itemId) return
      const metrics = measureItem(container, itemId)
      if (!metrics) return
      setStyles(buildSlideStyles(metrics, false))
    }

    const resizeObserver = new ResizeObserver(syncPosition)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef, measureItem])

  return styles
}

export const PLUGIN_NAV_LIST_ATTR = 'data-plugin-nav-id'

export const pluginNavItemSelector = createListItemSelector(PLUGIN_NAV_LIST_ATTR)

export function measurePluginNavItem(container: HTMLElement, itemId: string): ListIndicatorMetrics | null {
  return measureOffsetListItem(PLUGIN_NAV_LIST_ATTR, container, itemId)
}
