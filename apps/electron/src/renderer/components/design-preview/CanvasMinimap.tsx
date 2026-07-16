/**
 * CanvasMinimap — 画布左下角常驻缩略图
 *
 * 显示内容布局轮廓 + 当前可视区域；点击定位、拖拽视口框可平移画布。
 */

import { useAtom, useAtomValue } from 'jotai'
import * as React from 'react'

import {
  DEVICE_PRESETS,
  designDeviceAtom,
  designHtmlAtom,
  type DeviceType,
} from '@/atoms/design-preview-atoms'
import { currentDocumentAtom } from '@/design/canvas-shape-store'
import { viewportAtom } from '@/design/canvas-viewport-store'
import { cn } from '@/lib/utils'

const MAP_W = 148
const MAP_H = 108
const MAP_PAD = 8
/** 与 DesignCanvas HTML 分支 p-6 对齐 */
const CONTENT_PAD = 24

export interface CanvasMinimapProps {
  /** 画布容器（用于读取可视区域尺寸） */
  containerEl: HTMLElement | null
  className?: string
}

interface WorldRect {
  x: number
  y: number
  width: number
  height: number
}

function deviceFrameSize(device: DeviceType): { width: number; height: number } {
  const size = DEVICE_PRESETS[device]
  if (device === 'mobile') return { width: size.width + 16, height: size.height + 36 }
  if (device === 'tablet') return { width: size.width + 24, height: size.height + 24 }
  return { width: size.width + 8, height: size.height + 36 }
}

function unionRect(a: WorldRect, b: WorldRect): WorldRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: right - x, height: bottom - y }
}

function computeV3ContentBounds(
  shapes: Record<string, { bounds: WorldRect; id: string }>
): WorldRect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const shape of Object.values(shapes)) {
    if (shape.id === '__root__') continue
    const b = shape.bounds
    if (b.width <= 0 && b.height <= 0) continue
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 390, height: 844 }
  }
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

export function CanvasMinimap({
  containerEl,
  className,
}: CanvasMinimapProps): React.ReactElement | null {
  const [viewport, setViewport] = useAtom(viewportAtom)
  const device = useAtomValue(designDeviceAtom)
  const html = useAtomValue(designHtmlAtom)
  const doc = useAtomValue(currentDocumentAtom)

  const hasV3 = Object.keys(doc.shapes).length > 1
  const hasHtml = Boolean(html)
  if (!hasV3 && !hasHtml) return null

  const [containerSize, setContainerSize] = React.useState({ width: 1, height: 1 })

  React.useEffect(() => {
    if (!containerEl) return
    const measure = () => {
      setContainerSize({
        width: Math.max(1, containerEl.clientWidth),
        height: Math.max(1, containerEl.clientHeight),
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerEl)
    return () => ro.disconnect()
  }, [containerEl])

  const contentRect = React.useMemo((): WorldRect => {
    if (hasV3) return computeV3ContentBounds(doc.shapes)
    const frame = deviceFrameSize(device)
    return {
      x: CONTENT_PAD,
      y: CONTENT_PAD,
      width: frame.width,
      height: frame.height,
    }
  }, [hasV3, doc.shapes, device])

  const viewRect = React.useMemo((): WorldRect => {
    const z = Math.max(0.01, viewport.zoom)
    return {
      x: -viewport.panX / z,
      y: -viewport.panY / z,
      width: containerSize.width / z,
      height: containerSize.height / z,
    }
  }, [viewport, containerSize])

  // 世界范围：内容 + 视口，再加一点边距，保证缩略图能同时看到布局与当前视野
  const world = React.useMemo(() => {
    const merged = unionRect(contentRect, viewRect)
    const pad = Math.max(40, Math.min(merged.width, merged.height) * 0.08)
    return {
      x: merged.x - pad,
      y: merged.y - pad,
      width: merged.width + pad * 2,
      height: merged.height + pad * 2,
    }
  }, [contentRect, viewRect])

  const mapScale = React.useMemo(() => {
    const availW = MAP_W - MAP_PAD * 2
    const availH = MAP_H - MAP_PAD * 2
    return Math.min(availW / world.width, availH / world.height)
  }, [world])

  const toMap = React.useCallback(
    (wx: number, wy: number) => ({
      x: MAP_PAD + (wx - world.x) * mapScale,
      y: MAP_PAD + (wy - world.y) * mapScale,
    }),
    [world, mapScale]
  )

  const toWorld = React.useCallback(
    (mx: number, my: number) => ({
      x: world.x + (mx - MAP_PAD) / mapScale,
      y: world.y + (my - MAP_PAD) / mapScale,
    }),
    [world, mapScale]
  )

  const contentMap = toMap(contentRect.x, contentRect.y)
  const viewMap = toMap(viewRect.x, viewRect.y)

  const dragRef = React.useRef<{
    mode: 'view' | 'jump'
    startMx: number
    startMy: number
    startPanX: number
    startPanY: number
  } | null>(null)

  const setPanFromViewTopLeft = React.useCallback(
    (worldX: number, worldY: number) => {
      setViewport((prev) => ({
        ...prev,
        panX: -worldX * prev.zoom,
        panY: -worldY * prev.zoom,
      }))
    },
    [setViewport]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const inView =
      mx >= viewMap.x &&
      my >= viewMap.y &&
      mx <= viewMap.x + viewRect.width * mapScale &&
      my <= viewMap.y + viewRect.height * mapScale

    if (inView) {
      dragRef.current = {
        mode: 'view',
        startMx: mx,
        startMy: my,
        startPanX: viewport.panX,
        startPanY: viewport.panY,
      }
    } else {
      // 点击空白：把该点移到视口中心
      const w = toWorld(mx, my)
      setPanFromViewTopLeft(w.x - viewRect.width / 2, w.y - viewRect.height / 2)
      dragRef.current = {
        mode: 'jump',
        startMx: mx,
        startMy: my,
        startPanX: -((w.x - viewRect.width / 2) * viewport.zoom),
        startPanY: -((w.y - viewRect.height / 2) * viewport.zoom),
      }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const dmx = mx - d.startMx
    const dmy = my - d.startMy
    // 迷你图位移 → 世界位移 → pan（pan = -world * zoom）
    const dWorldX = dmx / mapScale
    const dWorldY = dmy / mapScale
    setViewport((prev) => ({
      ...prev,
      panX: d.startPanX - dWorldX * prev.zoom,
      panY: d.startPanY - dWorldY * prev.zoom,
    }))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  // v3：缩略形状（最多 40 个，避免密集时卡顿）
  const thumbShapes = React.useMemo(() => {
    if (!hasV3) return []
    const list = Object.values(doc.shapes)
      .filter(
        (s) => s.id !== '__root__' && s.visible && (s.bounds.width > 0 || s.bounds.height > 0)
      )
      .slice(0, 40)
    return list
  }, [hasV3, doc.shapes])

  return (
    <div
      className={cn(
        'pointer-events-auto select-none overflow-hidden rounded-lg border border-border/50',
        'bg-background/90 shadow-lg backdrop-blur-sm',
        className
      )}
      style={{ width: MAP_W, height: MAP_H }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="navigation"
      aria-label="画布缩略图"
      title="画布缩略图 · 拖拽视口 / 点击定位"
    >
      <div className="relative size-full bg-muted/30">
        {/* 内容轮廓 */}
        <div
          className="absolute rounded-sm border border-foreground/25 bg-foreground/10"
          style={{
            left: contentMap.x,
            top: contentMap.y,
            width: Math.max(2, contentRect.width * mapScale),
            height: Math.max(2, contentRect.height * mapScale),
          }}
        />

        {/* v3 形状缩略 */}
        {thumbShapes.map((s) => {
          const p = toMap(s.bounds.x, s.bounds.y)
          return (
            <div
              key={s.id}
              className="absolute rounded-[1px] bg-primary/35"
              style={{
                left: p.x,
                top: p.y,
                width: Math.max(1, s.bounds.width * mapScale),
                height: Math.max(1, s.bounds.height * mapScale),
              }}
            />
          )
        })}

        {/* 当前视口 */}
        <div
          className="absolute rounded-[2px] border-2 border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
          style={{
            left: viewMap.x,
            top: viewMap.y,
            width: Math.max(6, viewRect.width * mapScale),
            height: Math.max(6, viewRect.height * mapScale),
          }}
        />
      </div>
    </div>
  )
}
