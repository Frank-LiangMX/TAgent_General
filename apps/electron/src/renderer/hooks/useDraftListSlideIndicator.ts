import * as React from 'react'

import {
  measureOffsetListItem,
  useListSlideIndicator,
  type ListIndicatorMetrics,
  type ListSlideStyles,
} from '@/hooks/useListSlideIndicator'

export function draftListItemSelector(draftId: string): string {
  return `[data-draft-list-id="${draftId}"]`
}

export type DraftListSlideStyles = ListSlideStyles

function measureDraftListItem(
  container: HTMLElement,
  draftId: string
): ListIndicatorMetrics | null {
  return measureOffsetListItem('data-draft-list-id', container, draftId)
}

/**
 * 草稿列表滑动指示器：玻璃底板 + 左侧状态竖条同步滑动
 */
export function useDraftListSlideIndicator(
  containerRef: React.RefObject<HTMLElement | null>,
  activeDraftId: string | null,
  layoutKey = ''
): DraftListSlideStyles {
  return useListSlideIndicator(containerRef, activeDraftId, measureDraftListItem, layoutKey)
}
