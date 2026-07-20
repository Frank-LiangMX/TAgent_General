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
      expect(frame.borderRadius).toBeTruthy()
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

    expect(frames.map((frame) => frame.offset)).toEqual([0, 1])
    expect(frames[0]?.transform).toContain('scale(0.1437, 0.2611)')
    expect(frames.at(-1)?.transform).toBe('translate3d(0px, 0px, 0) scale(1, 1)')
    // scale 会压扁圆角：胶囊端用 R/scale 反补偿，避免缩成直角矩形
    expect(frames[0]?.borderRadius).toBe('111.3043px / 61.2766px')
    expect(frames.at(-1)?.borderRadius).toBe('22px')
  })

  test('closing is the exact spatial reverse', () => {
    const opening = createInspectorMotionKeyframes(CAPSULE, PANEL, 'opening')
    const closing = createInspectorMotionKeyframes(CAPSULE, PANEL, 'closing')

    expect(closing.map((frame) => frame.offset)).toEqual([0, 1])
    expect(closing[0]?.transform).toBe(opening.at(-1)?.transform)
    expect(closing.at(-1)?.transform).toBe(opening[0]?.transform)
    expect(closing[0]?.borderRadius).toBe(opening.at(-1)?.borderRadius)
    expect(closing.at(-1)?.borderRadius).toBe(opening[0]?.borderRadius)
  })

  test('compensates border radius so capsule pose keeps a rounded silhouette', () => {
    const frames = createInspectorMotionKeyframes(CAPSULE, PANEL, 'closing')
    const end = frames.at(-1)
    // 111 / 0.1437 ≈ 16, 61 / 0.2611 ≈ 16 — 视觉圆角回到胶囊 16px
    expect(String(end?.borderRadius)).toMatch(/px \/ /)
    expect(end?.borderRadius).not.toBe('22px')
    expect(end?.borderRadius).not.toBe('0px')
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
