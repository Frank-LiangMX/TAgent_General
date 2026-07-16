/**
 * CanvasOverlay — 画布鼠标交互覆盖层
 *
 * 统一处理两种交互模式：
 * - pan: 手型拖拽平移画布
 * - select: 十字框选区域
 *
 * 使用 useRef 跟踪拖拽状态，store.get() 读取最新视口值，
 * 避免自定义 write atom 不支持回调模式的问题。
 *
 * 设计来源：参考 Kun agent 的 hand-tool + select-tool
 */

import { useAtom, useSetAtom, useStore } from 'jotai'
import * as React from 'react'

import {
  designActiveToolAtom,
  designViewportAtom,
  designSelectionAtom,
  type SelectionRegion,
} from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'

export interface CanvasOverlayProps {
  enabled: boolean
  containerRef: React.RefObject<HTMLElement>
  className?: string
  zoom: number
}

type DragState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function CanvasOverlay({
  enabled,
  containerRef,
  className,
  zoom,
}: CanvasOverlayProps): React.ReactElement | null {
  const store = useStore()
  const [activeTool] = useAtom(designActiveToolAtom)
  const [selection, setSelection] = useAtom(designSelectionAtom)
  const setViewport = useSetAtom(designViewportAtom)

  const dragRef = React.useRef<DragState | null>(null)
  const [displayDrag, setDisplayDrag] = React.useState<DragState | null>(null)

  if (!enabled) return null

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (activeTool === 'pan') {
      const state: DragState = {
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      }
      dragRef.current = state
      setDisplayDrag(state)
      return
    }

    if (activeTool === 'select') {
      setSelection(null)
      const state: DragState = { startX: x, startY: y, currentX: x, currentY: y }
      dragRef.current = state
      setDisplayDrag(state)
    }
  }

  React.useEffect(() => {
    if (!enabled || !containerRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return

      if (activeTool === 'pan') {
        drag.currentX = e.clientX
        drag.currentY = e.clientY
        setDisplayDrag({ ...drag })
      } else {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        drag.currentX = e.clientX - rect.left
        drag.currentY = e.clientY - rect.top
        setDisplayDrag({ ...drag })
      }
    }

    const handleMouseUp = () => {
      const drag = dragRef.current
      if (!drag) {
        setDisplayDrag(null)
        return
      }
      dragRef.current = null
      setDisplayDrag(null)

      if (activeTool === 'pan') {
        const dx = drag.currentX - drag.startX
        const dy = drag.currentY - drag.startY
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          const current = store.get(designViewportAtom)
          setViewport({
            panX: current.panX + dx,
            panY: current.panY + dy,
          })
        }
      } else {
        const x = Math.min(drag.startX, drag.currentX) / zoom
        const y = Math.min(drag.startY, drag.currentY) / zoom
        const width = Math.abs(drag.currentX - drag.startX) / zoom
        const height = Math.abs(drag.currentY - drag.startY) / zoom
        if (width * zoom > 4 && height * zoom > 4) {
          const region: SelectionRegion = { x, y, width, height }
          setSelection(region)
        }
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [enabled, containerRef, activeTool, zoom, setViewport, setSelection, store])

  const selectionRect =
    activeTool === 'select'
      ? displayDrag
        ? {
            x: Math.min(displayDrag.startX, displayDrag.currentX),
            y: Math.min(displayDrag.startY, displayDrag.currentY),
            width: Math.abs(displayDrag.currentX - displayDrag.startX),
            height: Math.abs(displayDrag.currentY - displayDrag.startY),
          }
        : selection
          ? {
              x: selection.x * zoom,
              y: selection.y * zoom,
              width: selection.width * zoom,
              height: selection.height * zoom,
            }
          : null
      : null

  return (
    <div
      className={cn(
        'absolute inset-0',
        activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
        className
      )}
      onMouseDown={handleMouseDown}
      style={{ userSelect: 'none' }}
    >
      {selectionRect && (
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/10"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        >
          <div className="absolute -top-6 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground whitespace-nowrap">
            {Math.round(selectionRect.width / zoom)} × {Math.round(selectionRect.height / zoom)}
          </div>
        </div>
      )}
    </div>
  )
}
