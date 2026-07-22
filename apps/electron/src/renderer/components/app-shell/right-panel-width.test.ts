import { describe, expect, test } from 'vitest'

import {
  applyHalfSplitMagnet,
  clampRightPanelWidth,
  DEFAULT_RIGHT_PANEL_WIDTH,
  getHalfSplitRightPanelWidth,
  getInspectorExclusiveWidth,
  getMaxRightPanelWidth,
  getRightPanelWideSnap,
  MIN_MAIN_CHAT_RESERVE,
  MIN_RIGHT_PANEL_WIDTH,
  RIGHT_PANEL_HALF_SNAP_ENTER_PX,
  RIGHT_PANEL_NARROW_SNAP,
  shouldAutoCollapseLeftSidebar,
  shouldAutoHideShellChrome,
  shouldAutoRestoreLeftSidebar,
  shouldAutoShowShellChrome,
  shouldShowInspectorExclusiveControl,
  SPATIAL_CONVERSATION_MAX,
  toggleRightPanelSnap,
} from './right-panel-width'

describe('getMaxRightPanelWidth', () => {
  test('reserves conversation reading width on medium screens', () => {
    expect(getMaxRightPanelWidth(1200)).toBe(1200 - MIN_MAIN_CHAT_RESERVE)
  })

  test('allows beyond old 1100 cap on ultra-wide screens', () => {
    expect(getMaxRightPanelWidth(2000)).toBe(2000 - MIN_MAIN_CHAT_RESERVE)
    expect(getMaxRightPanelWidth(2000)).toBeGreaterThan(1100)
  })

  test('handles tiny viewports with minimum panel width', () => {
    expect(getMaxRightPanelWidth(400)).toBe(MIN_RIGHT_PANEL_WIDTH)
  })

  test('MIN_MAIN_CHAT_RESERVE aligns with spatial conversation max + margin', () => {
    expect(MIN_MAIN_CHAT_RESERVE).toBe(SPATIAL_CONVERSATION_MAX + 48)
  })
})

describe('getInspectorExclusiveWidth', () => {
  test('fills viewport minus left nav chrome and gutters', () => {
    // 2000 - 5 (rail edge) - 280 (nav) - 16 (right gutter) = 1699
    expect(getInspectorExclusiveWidth(2000, 280)).toBe(1699)
  })

  test('respects minimum panel width', () => {
    expect(getInspectorExclusiveWidth(400, 300)).toBe(MIN_RIGHT_PANEL_WIDTH)
  })
})

describe('shouldAutoCollapseLeftSidebar / restore', () => {
  test('collapses above 30% viewport', () => {
    expect(shouldAutoCollapseLeftSidebar(361, 1200)).toBe(true) // 30.08%
    expect(shouldAutoCollapseLeftSidebar(360, 1200)).toBe(false) // 30% exact → not >
  })

  test('restores below 28% with hysteresis', () => {
    expect(shouldAutoRestoreLeftSidebar(335, 1200)).toBe(true) // 27.9%
    expect(shouldAutoRestoreLeftSidebar(336, 1200)).toBe(false) // 28%
  })
})

describe('shouldAutoHideShellChrome / show', () => {
  test('hides chrome above 50% viewport', () => {
    expect(shouldAutoHideShellChrome(601, 1200)).toBe(true) // 50.08%
    expect(shouldAutoHideShellChrome(600, 1200)).toBe(false) // 50% exact → not >
  })

  test('shows chrome below 45% with hysteresis', () => {
    expect(shouldAutoShowShellChrome(539, 1200)).toBe(true) // 44.9%
    expect(shouldAutoShowShellChrome(540, 1200)).toBe(false) // 45%
  })
})

describe('shouldShowInspectorExclusiveControl', () => {
  test('hidden at or below 50% viewport', () => {
    expect(shouldShowInspectorExclusiveControl(600, 1200)).toBe(false)
    expect(shouldShowInspectorExclusiveControl(380, 1200)).toBe(false)
  })

  test('shown above 50% viewport', () => {
    expect(shouldShowInspectorExclusiveControl(601, 1200)).toBe(true)
  })

  test('always shown when exclusive is already active', () => {
    expect(shouldShowInspectorExclusiveControl(300, 1200, true)).toBe(true)
  })
})

describe('applyHalfSplitMagnet', () => {
  test('snaps into half split within enter zone', () => {
    const half = getHalfSplitRightPanelWidth(1600)
    expect(half).toBe(800)
    const near = applyHalfSplitMagnet(half - RIGHT_PANEL_HALF_SNAP_ENTER_PX, 1600, false)
    expect(near.snapped).toBe(true)
    expect(near.width).toBe(half)
  })

  test('does not snap outside enter zone', () => {
    const half = getHalfSplitRightPanelWidth(1600)
    const far = applyHalfSplitMagnet(half - RIGHT_PANEL_HALF_SNAP_ENTER_PX - 1, 1600, false)
    expect(far.snapped).toBe(false)
    expect(far.width).toBe(half - RIGHT_PANEL_HALF_SNAP_ENTER_PX - 1)
  })

  test('uses wider exit threshold while already snapped', () => {
    const half = getHalfSplitRightPanelWidth(1600)
    // 介于 enter 与 exit 之间：未吸住不吸，已吸住保持
    const offset = RIGHT_PANEL_HALF_SNAP_ENTER_PX + 5
    expect(applyHalfSplitMagnet(half - offset, 1600, false).snapped).toBe(false)
    expect(applyHalfSplitMagnet(half - offset, 1600, true)).toEqual({
      width: half,
      snapped: true,
    })
  })
})

describe('clampRightPanelWidth', () => {
  test('clamps below minimum', () => {
    expect(clampRightPanelWidth(100, 1200)).toBe(MIN_RIGHT_PANEL_WIDTH)
  })

  test('clamps above viewport-derived maximum', () => {
    expect(clampRightPanelWidth(2000, 1200)).toBe(getMaxRightPanelWidth(1200))
  })

  test('preserves valid width', () => {
    expect(clampRightPanelWidth(460, 1200)).toBe(460)
  })

  test('default width fits common laptop viewport', () => {
    expect(clampRightPanelWidth(DEFAULT_RIGHT_PANEL_WIDTH, 1280)).toBe(DEFAULT_RIGHT_PANEL_WIDTH)
  })
})

describe('getRightPanelWideSnap', () => {
  test('targets max width (conversation reserve) instead of 55% viewport', () => {
    expect(getRightPanelWideSnap(1200)).toBe(getMaxRightPanelWidth(1200))
    expect(getRightPanelWideSnap(1200)).not.toBe(660)
  })
})

describe('toggleRightPanelSnap', () => {
  test('from narrow snap goes wide', () => {
    expect(toggleRightPanelSnap(RIGHT_PANEL_NARROW_SNAP, 1200)).toBe(getRightPanelWideSnap(1200))
  })

  test('from wide snap goes narrow', () => {
    expect(toggleRightPanelSnap(getRightPanelWideSnap(1200), 1200)).toBe(
      clampRightPanelWidth(RIGHT_PANEL_NARROW_SNAP, 1200)
    )
  })
})
