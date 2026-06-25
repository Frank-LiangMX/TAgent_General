import * as React from 'react'

import { LIST_SLIDE_ACCENT_TRANSITION, LIST_SLIDE_TRANSITION } from '@/lib/list-slide-selection'

export function draftListItemSelector(draftId: string): string {
  return `[data-draft-list-id="${draftId}"]`
}

interface DraftListIndicatorMetrics {
  left: number
  width: number
  top: number
  height: number
}

export interface DraftListSlideStyles {
  plateStyle: React.CSSProperties | null
  accentStyle: React.CSSProperties | null
}

const EMPTY_STYLES: DraftListSlideStyles = {
  plateStyle: null,
  accentStyle: null,
}

function measureDraftListItem(
  container: HTMLElement,
  draftId: string
): DraftListIndicatorMetrics | null {
  const item = container.querySelector<HTMLElement>(draftListItemSelector(draftId))
  if (!item) return null

  return {
    left: item.offsetLeft,
    width: item.offsetWidth,
    top: item.offsetTop,
    height: item.offsetHeight,
  }
}

function rowMetricsToAccentMetrics(row: DraftListIndicatorMetrics): DraftListIndicatorMetrics {
  return {
    left: row.left + 6,
    top: row.top + 8,
    width: 3,
    height: Math.max(0, row.height - 16),
  }
}

function metricsToPlateStyle(
  metrics: DraftListIndicatorMetrics,
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
  metrics: DraftListIndicatorMetrics,
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
  rowMetrics: DraftListIndicatorMetrics,
  animate: boolean
): DraftListSlideStyles {
  const plateTransition = animate ? LIST_SLIDE_TRANSITION : 'none'
  const accentTransition = animate ? LIST_SLIDE_ACCENT_TRANSITION : 'none'

  return {
    plateStyle: metricsToPlateStyle(rowMetrics, plateTransition),
    accentStyle: metricsToAccentStyle(rowMetricsToAccentMetrics(rowMetrics), accentTransition),
  }
}

/**
 * 草稿列表滑动指示器：玻璃底板 + 左侧状态竖条同步滑动
 */
export function useDraftListSlideIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  activeDraftId: string | null,
  layoutKey = ''
): DraftListSlideStyles {
  const prevActiveRef = React.useRef<string | null>(null)
  const lastSettledRef = React.useRef<string | null>(null)
  const lastLayoutKeyRef = React.useRef(layoutKey)
  const [styles, setStyles] = React.useState<DraftListSlideStyles>(EMPTY_STYLES)

  const applyMetrics = React.useCallback(
    (animate: boolean) => {
      const container = containerRef.current
      if (!container || !activeDraftId) {
        setStyles(EMPTY_STYLES)
        lastSettledRef.current = null
        return
      }

      const metrics = measureDraftListItem(container, activeDraftId)
      if (!metrics) return

      setStyles(buildSlideStyles(metrics, animate))
      lastSettledRef.current = activeDraftId
    },
    [activeDraftId, containerRef]
  )

  React.useLayoutEffect(() => {
    const prevDraft = prevActiveRef.current
    const isDraftChange = prevDraft !== null && prevDraft !== activeDraftId
    const isLayoutChange = lastLayoutKeyRef.current !== layoutKey
    lastLayoutKeyRef.current = layoutKey

    if (!activeDraftId) {
      setStyles(EMPTY_STYLES)
      lastSettledRef.current = null
      return
    }

    if (!isDraftChange && !isLayoutChange) {
      if (lastSettledRef.current === activeDraftId) return
      applyMetrics(false)
      return
    }

    applyMetrics(true)
  }, [activeDraftId, layoutKey, applyMetrics])

  React.useEffect(() => {
    prevActiveRef.current = activeDraftId
  }, [activeDraftId])

  const activeDraftIdRef = React.useRef(activeDraftId)
  activeDraftIdRef.current = activeDraftId

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const syncPosition = (): void => {
      const draftId = activeDraftIdRef.current
      if (!draftId) return
      const metrics = measureDraftListItem(container, draftId)
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
