import { describe, expect, it } from 'vitest'

import {
  applyMacSquircleMaskToBitmap,
  blitCenteredOnCanvas,
  isInsideMacSquircle,
  MAC_DOCK_CANVAS_SIZE,
  MAC_DOCK_CONTENT_SCALE,
} from './dock-icon-mac-mask'

describe('macOS Dock squircle 蒙版', () => {
  it('中心与近边缘区域在蒙版内', () => {
    const size = 1024
    expect(isInsideMacSquircle(512, 512, size, size)).toBe(true)
    expect(isInsideMacSquircle(512, 16, size, size)).toBe(true)
    expect(isInsideMacSquircle(16, 512, size, size)).toBe(true)
  })

  it('四角在蒙版外', () => {
    const size = 1024
    expect(isInsideMacSquircle(0, 0, size, size)).toBe(false)
    expect(isInsideMacSquircle(1023, 1023, size, size)).toBe(false)
  })

  it('蒙版仅清除区外 alpha', () => {
    const width = 4
    const height = 4
    const bitmap = Buffer.alloc(width * height * 4, 255)
    const masked = applyMacSquircleMaskToBitmap(bitmap, width, height)
    expect(masked[3]).toBe(0)
    expect(masked[(2 * width + 2) * 4 + 3]).toBe(255)
  })

  it('缩略图居中贴到画布', () => {
    const patch = Buffer.alloc(2 * 2 * 4, 0)
    patch[3] = 255
    const canvas = blitCenteredOnCanvas(patch, 2, 2, 4)
    expect(canvas[3]).toBe(0)
    expect(canvas[(1 * 4 + 1) * 4 + 3]).toBe(255)
  })

  it('内容缩放小于满幅', () => {
    expect(MAC_DOCK_CONTENT_SCALE).toBeLessThan(1)
    expect(Math.round(MAC_DOCK_CANVAS_SIZE * MAC_DOCK_CONTENT_SCALE)).toBeLessThan(
      MAC_DOCK_CANVAS_SIZE
    )
  })
})
