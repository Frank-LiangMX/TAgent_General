import { describe, expect, test } from 'vitest'

import {
  buildSidebarMorphPath,
  createSidebarMorphKeyframes,
  createSidebarTetherKeyframes,
  localSidebarRect,
} from './left-sidebar-motion'

const SOURCE = { left: 12, top: 120, width: 36, height: 36 }
const PANEL = { left: 60, top: 64, width: 254, height: 720 }
const OVERLAY = { left: 0, top: 0, width: 1400, height: 900 }

describe('left sidebar motion (prototype path)', () => {
  test('buildSidebarMorphPath produces droplet/stream/gathered between source and target', () => {
    const path = buildSidebarMorphPath(SOURCE, PANEL, OVERLAY)
    expect(path.source.width).toBe(36)
    expect(path.target.width).toBe(254)
    expect(path.droplet.width).toBeGreaterThan(path.source.width)
    expect(path.stream.width).toBeGreaterThan(path.droplet.width)
    expect(path.gathered.width).toBeLessThan(path.target.width)
  })

  test('opening keyframes animate geometry not only transform', () => {
    const frames = createSidebarMorphKeyframes(SOURCE, PANEL, OVERLAY, 'opening')
    expect(frames.map((f) => f.offset)).toEqual([0, 0.22, 0.46, 0.74, 1])
    for (const frame of frames) {
      expect(frame).toHaveProperty('left')
      expect(frame).toHaveProperty('width')
      expect(frame).toHaveProperty('height')
      expect(frame).toHaveProperty('borderRadius')
    }
    expect(frames[0]?.opacity).toBe(0)
    expect(frames.at(-1)?.opacity).toBe(1)
  })

  test('closing reverses the spatial path endpoints', () => {
    const opening = createSidebarMorphKeyframes(SOURCE, PANEL, OVERLAY, 'opening')
    const closing = createSidebarMorphKeyframes(SOURCE, PANEL, OVERLAY, 'closing')
    expect(closing[0]?.left).toBe(opening.at(-1)?.left)
    expect(closing[0]?.width).toBe(opening.at(-1)?.width)
    expect(closing.at(-1)?.left).toBe(opening[0]?.left)
    expect(closing.at(-1)?.width).toBe(opening[0]?.width)
  })

  test('tether keyframes scale along X', () => {
    const open = createSidebarTetherKeyframes('opening')
    expect(open[0]?.transform).toContain('scaleX')
    expect(open.at(-1)?.opacity).toBe(0)
  })

  test('localSidebarRect subtracts overlay origin', () => {
    expect(
      localSidebarRect(
        { left: 100, top: 80, width: 200, height: 400 },
        { left: 10, top: 20, width: 1000, height: 800 }
      )
    ).toEqual({ left: 90, top: 60, width: 200, height: 400 })
  })
})
