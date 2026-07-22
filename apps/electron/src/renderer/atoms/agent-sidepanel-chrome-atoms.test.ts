import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SIDE_PANEL_PLACEMENT,
  DEFAULT_SIDE_PANEL_WIDTH,
  migrateSidePanelPlacement,
  migrateSidePanelWidth,
} from './agent-atoms'
import { migrateInspectorExclusive } from './app-mode'

describe('agent sidepanel chrome per-session migration', () => {
  it('normalizes width with default fallback', () => {
    expect(migrateSidePanelWidth(420)).toBe(420)
    expect(migrateSidePanelWidth(undefined)).toBe(DEFAULT_SIDE_PANEL_WIDTH)
    expect(migrateSidePanelWidth(Number.NaN)).toBe(DEFAULT_SIDE_PANEL_WIDTH)
  })

  it('normalizes placement with default fallback', () => {
    expect(migrateSidePanelPlacement('dock')).toBe('dock')
    expect(migrateSidePanelPlacement('float')).toBe('float')
    expect(migrateSidePanelPlacement('overlay')).toBe(DEFAULT_SIDE_PANEL_PLACEMENT)
    expect(migrateSidePanelPlacement(undefined)).toBe(DEFAULT_SIDE_PANEL_PLACEMENT)
  })

  it('normalizes inspector exclusive with default fallback', () => {
    expect(migrateInspectorExclusive(true)).toBe(true)
    expect(migrateInspectorExclusive(false)).toBe(false)
    expect(migrateInspectorExclusive(undefined)).toBe(false)
  })
})
