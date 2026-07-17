import { describe, expect, test } from 'vitest'

import { shouldShowPendingStreamTurn } from './pending-stream-turn'

describe('shouldShowPendingStreamTurn', () => {
  test('shows while streaming before first live assistant', () => {
    expect(shouldShowPendingStreamTurn({ streaming: true, hasLiveAssistantContent: false })).toBe(
      true
    )
  })

  test('hides once live assistant content exists', () => {
    expect(shouldShowPendingStreamTurn({ streaming: true, hasLiveAssistantContent: true })).toBe(
      false
    )
  })

  test('hides when not streaming', () => {
    expect(shouldShowPendingStreamTurn({ streaming: false, hasLiveAssistantContent: false })).toBe(
      false
    )
  })
})
