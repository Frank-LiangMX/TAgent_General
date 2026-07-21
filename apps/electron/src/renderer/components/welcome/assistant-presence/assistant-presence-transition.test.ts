import { describe, expect, it } from 'vitest'

import {
  buildAssistantTransitionKeyframes,
  calculateAssistantTransitionGeometry,
} from './assistant-presence-transition'

describe('assistant presence transition', () => {
  it('moves between element centers and scales to the compact target', () => {
    const geometry = calculateAssistantTransitionGeometry(
      { left: 100, top: 100, width: 144, height: 144 },
      { left: 20, top: 600, width: 68, height: 68 }
    )

    expect(geometry).toEqual({
      deltaX: -118,
      deltaY: 462,
      scale: 68 / 144,
    })
  })

  it('ends at the exact target transform', () => {
    const geometry = { deltaX: -118, deltaY: 462, scale: 68 / 144 }
    const keyframes = buildAssistantTransitionKeyframes(geometry)

    expect(keyframes.at(-1)).toMatchObject({
      opacity: 1,
      transform: `translate3d(-118px, 462px, 0) scale(${68 / 144})`,
    })
  })

  it('falls back to a neutral scale for invalid source geometry', () => {
    const geometry = calculateAssistantTransitionGeometry(
      { left: 10, top: 20, width: 0, height: 0 },
      { left: 30, top: 40, width: 68, height: 68 }
    )

    expect(geometry.scale).toBe(1)
  })
})
