/**
 * macOS Dock 图标 squircle 蒙版
 *
 * app.dock.setIcon(path) 不会套用系统圆角，需在运行时对 PNG 施加与 macOS 一致的连续曲率蒙版。
 * 不修改 resources 里的原始图标文件。
 */

import { existsSync } from 'node:fs'

import { app, nativeImage, type NativeImage } from 'electron'

import {
  applyMacSquircleMaskToBitmap,
  blitCenteredOnCanvas,
  MAC_DOCK_CANVAS_SIZE,
  MAC_DOCK_CONTENT_SCALE,
} from './dock-icon-mac-mask'

function normalizeToCanvas(source: NativeImage): NativeImage {
  const { width, height } = source.getSize()
  if (width === MAC_DOCK_CANVAS_SIZE && height === MAC_DOCK_CANVAS_SIZE) {
    return source
  }
  return source.resize({
    width: MAC_DOCK_CANVAS_SIZE,
    height: MAC_DOCK_CANVAS_SIZE,
    quality: 'best',
  })
}

/** 从 PNG 生成带 squircle 蒙版、尺寸与系统 Dock 对齐的图标 */
export function createMacDockIconFromPng(pngPath: string): NativeImage | null {
  if (!existsSync(pngPath)) {
    return null
  }

  const source = nativeImage.createFromPath(pngPath)
  if (source.isEmpty()) {
    return null
  }

  const normalized = normalizeToCanvas(source)

  // 先满幅套 squircle，再缩小居中；顺序反了会在缩小后的方图内留下直角黑边
  const maskedBitmap = applyMacSquircleMaskToBitmap(
    normalized.toBitmap({ scaleFactor: 1.0 }),
    MAC_DOCK_CANVAS_SIZE,
    MAC_DOCK_CANVAS_SIZE,
  )
  const maskedFull = nativeImage.createFromBuffer(maskedBitmap, {
    width: MAC_DOCK_CANVAS_SIZE,
    height: MAC_DOCK_CANVAS_SIZE,
    scaleFactor: 1.0,
  })

  const contentSize = Math.round(MAC_DOCK_CANVAS_SIZE * MAC_DOCK_CONTENT_SCALE)
  const scaled = maskedFull.resize({
    width: contentSize,
    height: contentSize,
    quality: 'best',
  })

  const canvas = blitCenteredOnCanvas(
    scaled.toBitmap({ scaleFactor: 1.0 }),
    contentSize,
    contentSize,
    MAC_DOCK_CANVAS_SIZE,
  )

  const dockIcon = nativeImage.createFromBuffer(canvas, {
    width: MAC_DOCK_CANVAS_SIZE,
    height: MAC_DOCK_CANVAS_SIZE,
    scaleFactor: 1.0,
  })

  return dockIcon.isEmpty() ? null : dockIcon
}

/** 设置 macOS Dock 图标（失败时回退为未蒙版 PNG） */
export function setMacDockIconFromPng(pngPath: string): boolean {
  if (process.platform !== 'darwin' || !app.dock) {
    return false
  }

  const masked = createMacDockIconFromPng(pngPath)
  if (masked) {
    app.dock.setIcon(masked)
    return true
  }

  const fallback = nativeImage.createFromPath(pngPath)
  if (fallback.isEmpty()) {
    console.warn('[图标] 无法加载 Dock PNG:', pngPath)
    return false
  }

  app.dock.setIcon(fallback)
  return true
}
