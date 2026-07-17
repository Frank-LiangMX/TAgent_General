import { describe, expect, it } from 'vitest'

import {
  normalizeSessionPresentation,
  normalizeSessionPresentationRecord,
} from './session-presentation-atoms'

describe('session presentation preference', () => {
  it('keeps Office opt-in and defaults every other value to classic', () => {
    expect(normalizeSessionPresentation('office')).toBe('office')
    expect(normalizeSessionPresentation('classic')).toBe('classic')
    expect(normalizeSessionPresentation('immersive')).toBe('classic')
    expect(normalizeSessionPresentation(undefined)).toBe('classic')
  })

  it('migrates malformed storage without letting it change the default', () => {
    expect(normalizeSessionPresentationRecord(null)).toEqual({})
    expect(
      normalizeSessionPresentationRecord({
        'session-office': 'office',
        'session-classic': 'classic',
        'session-invalid': true,
      })
    ).toEqual({
      'session-office': 'office',
      'session-classic': 'classic',
      'session-invalid': 'classic',
    })
  })
})
