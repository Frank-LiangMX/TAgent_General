import { describe, expect, it } from 'vitest'

import { getNavClusterWidth } from './NavIsland'

describe('getNavClusterWidth', () => {
  it('returns rail width plus left edge inset while the sidebar is hidden', () => {
    expect(getNavClusterWidth(false, 60, 240)).toBe(65)
  })

  it('adds rail, gap, sidebar and left edge without overlapping primary regions', () => {
    // 60 + 10(gap) + 240 + 5(edge) = 315
    expect(getNavClusterWidth(true, 60, 240)).toBe(315)
  })

  it('accepts a custom structural gap', () => {
    // 60 + 12(gap) + 240 + 5(edge) = 317
    expect(getNavClusterWidth(true, 60, 240, 12)).toBe(317)
  })
})
