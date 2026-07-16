/**
 * SelectionOverlay — Design Preview 框选覆盖层
 *
 * 在 iframe 上层覆盖一个透明遮罩，监听鼠标事件实现拖拽框选。
 * 框选完成时把坐标保存到 designSelectionAtom。
 *
 * 设计来源：docs/plans/2026-07-13-design-preview-design.md §5.2
 */

import { useAtom, useSetAtom } from 'jotai'
import * as React from 'react'

import {
  designSelectionAtom,
  setDesignSelectionAtom,
  type SelectionRegion,
} from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'

export interface SelectionOverlayProps {
  /** 是否启用框选 */
  enabled: boolean
  /** iframe 容器的引用（用于坐标计算） */
  containerRef: React.RefObject<HTMLElement>
  /** 自定义类名 */
  className?: string
}

type DragState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function SelectionOverlay({
  enabled,
  containerRef,
  className,
}: SelectionOverlayProps): React.ReactElement | null {
  const [selection, setSelectionLocal] = useAtom(designSelectionAtom)
  const setSelectionGlobal = useSetAtom(setDesignSelectionAtom)
  const [drag, setDrag] = React.useState<DragState | null>(null)

  // 用 ref 避免 useCallback 频繁重建
  const selectionRef = React.useRef(selection)
  selectionRef.current = selection

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || !containerRef.current) return
      // 只响应左键
      if (e.button !== 0) return
      // 已有框选时点击清除
      if (selectionRef.current) {
        setSelectionLocal(null)
        setSelectionGlobal(null)
      }
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setDrag({ startX: x, startY: y, currentX: x, currentY: y })
    },
    [enabled, containerRef, setSelectionLocal, setSelectionGlobal]
  )

  React.useEffect(() => {
    if (!drag || !containerRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setDrag((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null))
    }

    const handleMouseUp = () => {
      // 先读取 drag 的当前值（在 updater 外面读，避免嵌套 setter）
      const current = drag
      if (!current) return
      const x = Math.min(current.startX, current.currentX)
      const y = Math.min(current.startY, current.currentY)
      const width = Math.abs(current.currentX - current.startX)
      const height = Math.abs(current.currentY - current.startY)
      // 忽略太小的框选（点击而非拖拽）
      if (width > 4 && height > 4) {
        const region: SelectionRegion = { x, y, width, height }
        // 在 mouseup 事件回调里直接调用 setter 是合法的
        setSelectionGlobal(region)
      }
      setDrag(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, containerRef, setSelectionGlobal])

  // 计算当前显示的框（拖拽中或已选）
  const rect = React.useMemo(() => {
    if (drag) {
      const x = Math.min(drag.startX, drag.currentX)
      const y = Math.min(drag.startY, drag.currentY)
      const width = Math.abs(drag.currentX - drag.startX)
      const height = Math.abs(drag.currentY - drag.startY)
      return { x, y, width, height }
    }
    if (selection) {
      return selection
    }
    return null
  }, [drag, selection])

  if (!enabled) return null

  return (
    <div
      className={cn('absolute inset-0 cursor-crosshair', drag ? 'select-none' : '', className)}
      onMouseDown={handleMouseDown}
      style={{ userSelect: 'none' }}
    >
      {/* 半透明遮罩，提示用户可以框选 */}
      {rect === null && <div className="pointer-events-none absolute inset-0 bg-primary/[0.02]" />}

      {/* 框选矩形 */}
      {rect && (
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/10"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          }}
        >
          <div className="absolute -top-6 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </div>
        </div>
      )}
    </div>
  )
}
