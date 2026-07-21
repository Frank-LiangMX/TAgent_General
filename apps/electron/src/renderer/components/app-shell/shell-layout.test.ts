import { describe, expect, test } from 'vitest'

import {
  deriveRailSelection,
  deriveShellLayout,
  railItemSupportsSidebar,
  type ShellLayoutInput,
} from './shell-layout'

const BASE_INPUT: ShellLayoutInput = {
  topLevelMode: 'general',
  appMode: 'agent',
  activeRailItem: 'sessions',
  activeTabType: 'agent',
  hasCurrentSession: true,
  sidebarRequestedOpen: true,
  rightPanelRequestedOpen: false,
  rightRailItem: 'files',
  globalOfficeMode: false,
  hasOfficeSession: false,
  designEnabled: false,
  designFullscreen: false,
  designImmersive: false,
}

function derive(overrides: Partial<ShellLayoutInput> = {}) {
  return deriveShellLayout({ ...BASE_INPUT, ...overrides })
}

describe('deriveShellLayout', () => {
  test.each([false, true])('office has highest precedence (session ready=%s)', (ready) => {
    expect(
      derive({
        globalOfficeMode: true,
        hasOfficeSession: ready,
        designEnabled: true,
        designFullscreen: true,
        designImmersive: true,
        rightPanelRequestedOpen: true,
        rightRailItem: 'design',
      })
    ).toEqual({
      scene: 'office',
      navigation: 'hidden',
      sidebar: 'hidden',
      inspector: 'hidden',
      composer: 'dock',
      canvas: 'none',
      office: ready ? 'ready' : 'loading',
    })
  })

  test('enters canvas immersive only when Design is enabled', () => {
    expect(derive({ designEnabled: true, designImmersive: true })).toMatchObject({
      scene: 'canvas',
      navigation: 'hidden',
      sidebar: 'hidden',
      inspector: 'hidden',
      composer: 'dock',
      canvas: 'immersive',
    })
    expect(derive({ designEnabled: false, designImmersive: true }).canvas).toBe('none')
  })

  test('magnify preserves navigation and the normal sidebar while replacing inspector', () => {
    expect(
      derive({
        designEnabled: true,
        designFullscreen: true,
        rightPanelRequestedOpen: true,
        rightRailItem: 'design',
      })
    ).toMatchObject({
      scene: 'canvas',
      navigation: 'open',
      sidebar: 'open',
      inspector: 'hidden',
      composer: 'dock',
      canvas: 'magnify',
    })
  })

  test.each([
    ['design disabled', { designEnabled: false }],
    ['fullscreen disabled', { designFullscreen: false }],
    ['wrong inspector item', { rightRailItem: 'files' as const }],
    ['inspector collapsed', { rightPanelRequestedOpen: false }],
    ['inspector unavailable', { activeRailItem: 'skills' as const }],
  ])('does not magnify when %s', (_label, overrides) => {
    expect(
      derive({
        designEnabled: true,
        designFullscreen: true,
        rightPanelRequestedOpen: true,
        rightRailItem: 'design',
        ...overrides,
      }).canvas
    ).toBe('none')
  })

  test.each([
    ['wrong app mode', { appMode: 'draft' as const }],
    ['wrong tab type', { activeTabType: 'draft' as const }],
    ['missing tab', { activeTabType: null }],
    ['missing session', { hasCurrentSession: false }],
    ['wrong rail item', { activeRailItem: 'memory' as const }],
  ])('hides inspector for %s', (_label, overrides) => {
    expect(derive({ rightPanelRequestedOpen: true, ...overrides }).inspector).toBe('hidden')
  })

  test('maps an eligible inspector request to open or collapsed', () => {
    expect(derive({ rightPanelRequestedOpen: true }).inspector).toBe('open')
    expect(derive({ rightPanelRequestedOpen: false }).inspector).toBe('collapsed')
  })

  test.each(['preview', 'rail'] as const)(
    'keeps inspector available for session-bound %s tabs',
    (activeTabType) => {
      expect(derive({ activeTabType, rightPanelRequestedOpen: true }).inspector).toBe('open')
      expect(derive({ activeTabType, rightPanelRequestedOpen: false }).inspector).toBe('collapsed')
    }
  )

  test.each([
    ['general', 'skills'],
    ['general', 'draft'],
    ['ta', 'assets'],
    ['ta', 'pipeline'],
  ] as const)('supports the %s/%s sidebar', (topLevelMode, activeRailItem) => {
    expect(railItemSupportsSidebar(topLevelMode, activeRailItem)).toBe(true)
    expect(derive({ topLevelMode, activeRailItem }).sidebar).toBe('open')
  })

  test.each(['automation', 'memory'] as const)(
    '%s is rail-only in general (no sidebar)',
    (item) => {
      expect(railItemSupportsSidebar('general', item)).toBe(false)
      expect(derive({ activeRailItem: item, sidebarRequestedOpen: true }).sidebar).toBe('collapsed')
    }
  )

  test('memory is rail-only in TA mode (no sidebar)', () => {
    expect(railItemSupportsSidebar('ta', 'memory')).toBe(false)
    expect(
      derive({ topLevelMode: 'ta', activeRailItem: 'memory', sidebarRequestedOpen: true }).sidebar
    ).toBe('collapsed')
  })

  test('collapses sidebar when the user requests it', () => {
    expect(derive({ sidebarRequestedOpen: false }).sidebar).toBe('collapsed')
  })

  test('classifies focus only when neither side panel is open', () => {
    expect(derive({ sidebarRequestedOpen: false, rightPanelRequestedOpen: false }).scene).toBe(
      'focus'
    )
    expect(derive({ sidebarRequestedOpen: true, rightPanelRequestedOpen: false }).scene).toBe(
      'standard'
    )
    expect(derive({ sidebarRequestedOpen: false, rightPanelRequestedOpen: true }).scene).toBe(
      'standard'
    )
  })
})

describe('deriveRailSelection', () => {
  test('collapses an open sidebar when the active item is clicked again', () => {
    expect(
      deriveRailSelection({ activeRailItem: 'sessions', sidebarOpen: true }, 'sessions')
    ).toEqual({ activeRailItem: 'sessions', sidebarOpen: false })
  })

  test('reopens a collapsed sidebar when the active item is clicked again', () => {
    expect(
      deriveRailSelection({ activeRailItem: 'sessions', sidebarOpen: false }, 'sessions')
    ).toEqual({ activeRailItem: 'sessions', sidebarOpen: true })
  })

  test('opens the sidebar when switching to another item that supports it', () => {
    expect(
      deriveRailSelection({ activeRailItem: 'sessions', sidebarOpen: false }, 'skills')
    ).toEqual({ activeRailItem: 'skills', sidebarOpen: true })
  })

  test('keeps sidebar closed when switching to a rail-only item', () => {
    expect(
      deriveRailSelection({ activeRailItem: 'sessions', sidebarOpen: true }, 'automation')
    ).toEqual({ activeRailItem: 'automation', sidebarOpen: false })
    expect(
      deriveRailSelection({ activeRailItem: 'sessions', sidebarOpen: true }, 'memory')
    ).toEqual({ activeRailItem: 'memory', sidebarOpen: false })
  })

  test('re-clicking a rail-only item does not toggle sidebar open', () => {
    expect(
      deriveRailSelection({ activeRailItem: 'automation', sidebarOpen: false }, 'automation')
    ).toEqual({ activeRailItem: 'automation', sidebarOpen: false })
    expect(
      deriveRailSelection({ activeRailItem: 'memory', sidebarOpen: false }, 'memory', 'ta')
    ).toEqual({ activeRailItem: 'memory', sidebarOpen: false })
  })
})
