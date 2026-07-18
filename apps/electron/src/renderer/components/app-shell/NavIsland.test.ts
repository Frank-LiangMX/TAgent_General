import { describe, expect, it } from 'vitest'

import { getNavClusterWidth } from './NavIsland'

describe('getNavClusterWidth', () => {
  it('returns only the rail width while the sidebar is hidden', () => {
    expect(getNavClusterWidth(false, 60, 240)).toBe(60)
  })

  it('adds rail and sidebar widths without overlapping primary regions', () => {
    expect(getNavClusterWidth(true, 60, 240)).toBe(308)
  })

  it('accepts a custom structural gap', () => {
    expect(getNavClusterWidth(true, 60, 240, 12)).toBe(312)
  })
})
