import { describe, expect, it } from 'vitest'

import {
  normalizeSessionPresentation,
  normalizeSessionPresentationRecord,
  normalizeOfficeSessionViewState,
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

  it('bounds persisted Office layout values before restoring them', () => {
    expect(
      normalizeOfficeSessionViewState({
        chatCollapsed: true,
        chatWidth: 9_999,
        camera: { scale: 0, offsetX: 24, offsetY: Number.NaN },
      })
    ).toEqual({
      chatCollapsed: true,
      chatWidth: 620,
      chatHeight: 600,
      chatPosition: { x: -1, y: -1 },
      chatUISize: 'medium',
      camera: { scale: 0.3, offsetX: 24, offsetY: 0 },
    })
  })
})
