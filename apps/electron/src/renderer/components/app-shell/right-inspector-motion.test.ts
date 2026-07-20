import { describe, expect, test } from 'vitest'

import { createInspectorMotionKeyframes, getInspectorProxyStyle } from './right-inspector-motion'

const CAPSULE = { left: 954, top: 64, width: 46, height: 188 }
const PANEL = { left: 680, top: 64, width: 320, height: 720 }

describe('right inspector motion', () => {
  test('uses a fixed panel box and compositor transforms instead of animated geometry', () => {
    const frames = createInspectorMotionKeyframes(CAPSULE, PANEL, 'opening')

    for (const frame of frames) {
      expect(frame).not.toHaveProperty('left')
      expect(frame).not.toHaveProperty('top')
      expect(frame).not.toHaveProperty('width')
      expect(frame).not.toHaveProperty('height')
      expect(frame.transform).toContain('translate3d(')
    }

    expect(getInspectorProxyStyle(PANEL)).toMatchObject({
      left: '680px',
      top: '64px',
      width: '320px',
      height: '720px',
      transformOrigin: 'top right',
    })
  })

  test('opens from the rail footprint and finishes at the panel geometry', () => {
    const frames = createInspectorMotionKeyframes(CAPSULE, PANEL, 'opening')

    expect(frames.map((frame) => frame.offset)).toEqual([0, 0.2, 0.48, 0.74, 1])
    expect(frames[0]?.transform).toContain('scale(0.1437, 0.2611)')
    expect(frames[1]?.transform).toContain('translate3d(-2px, 4px, 0)')
    expect(frames.at(-1)?.transform).toBe('translate3d(0px, 0px, 0) scale(1, 1)')
  })

  test('closing is the exact spatial reverse with monotonic offsets', () => {
    const opening = createInspectorMotionKeyframes(CAPSULE, PANEL, 'opening')
    const closing = createInspectorMotionKeyframes(CAPSULE, PANEL, 'closing')

    expect(closing.map((frame) => frame.offset)).toEqual([0, 0.26, 0.52, 0.8, 1])
    expect(closing[0]?.transform).toBe(opening.at(-1)?.transform)
    expect(closing.at(-1)?.transform).toBe(opening[0]?.transform)
  })

  test('clamps zero-sized geometry to finite transforms', () => {
    const frames = createInspectorMotionKeyframes(
      { left: 0, top: 0, width: 0, height: 0 },
      { left: 0, top: 0, width: 0, height: 0 },
      'opening'
    )

    expect(frames.every((frame) => !String(frame.transform).includes('Infinity'))).toBe(true)
    expect(frames.every((frame) => !String(frame.transform).includes('NaN'))).toBe(true)
  })
})
