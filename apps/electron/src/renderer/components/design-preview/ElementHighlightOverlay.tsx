/**
 * ElementHighlightOverlay — 选中 / hover 元素高亮覆盖层
 *
 * v2 HTML 模式：必须放在画布 transform（pan/zoom）容器内部，
 * 与 iframe 共用同一套 CSS transform，这样拖拽/缩放时高亮框自然跟随，不会偏移。
 *
 * 坐标：iframe 相对本层的本地偏移 + CanvasElement.bounds（均为未缩放 CSS px）。
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import { currentDocumentAtom } from '@/design/canvas-shape-store'
import { selectedShapeIdsAtom, hoveredShapeIdAtom } from '@/design/canvas-selection-store'
import { canvasLayersAtom, selectedElementIdsAtom, hoveredElementIdAtom } from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'

export interface ElementHighlightOverlayProps {
  className?: string
  /** iframe 元素（v2 模式） */
  iframeEl?: HTMLIFrameElement | null
}

interface LocalRect {
  left: number
  top: number
  width: number
  height: number
}

/** 把 iframe 的视口矩形换算成相对 overlayRoot 的本地（未缩放）坐标 */
function measureIframeLocal(
  iframeEl: HTMLIFrameElement,
  overlayRoot: HTMLElement,
): LocalRect | null {
  try {
    const ir = iframeEl.getBoundingClientRect()
    const rr = overlayRoot.getBoundingClientRect()
    // 祖先 transform: scale 会同等放大两者的 getBoundingClientRect；
    // 用 overlay 的 offsetWidth 反推 scale，得到未缩放本地坐标。
    const scale = rr.width > 0 && overlayRoot.offsetWidth > 0
      ? rr.width / overlayRoot.offsetWidth
      : 1
    if (scale <= 0) return null
    return {
      left: (ir.left - rr.left) / scale,
      top: (ir.top - rr.top) / scale,
      width: ir.width / scale,
      height: ir.height / scale,
    }
  } catch {
    return null
  }
}

export function ElementHighlightOverlay({
  className,
  iframeEl,
}: ElementHighlightOverlayProps): React.ReactElement | null {
  const v3Doc = useAtomValue(currentDocumentAtom)
  const v3Selected = useAtomValue(selectedShapeIdsAtom)
  const v3Hovered = useAtomValue(hoveredShapeIdAtom)
  const hasV3 = Object.keys(v3Doc.shapes).length > 1

  const v2Layers = useAtomValue(canvasLayersAtom)
  const v2Selected = useAtomValue(selectedElementIdsAtom)
  const v2Hovered = useAtomValue(hoveredElementIdAtom)

  const rootRef = React.useRef<HTMLDivElement>(null)
  const [iframeLocal, setIframeLocal] = React.useState<LocalRect | null>(null)

  const refresh = React.useCallback(() => {
    const root = rootRef.current
    if (!root || !iframeEl) {
      setIframeLocal(null)
      return
    }
    setIframeLocal(measureIframeLocal(iframeEl, root))
  }, [iframeEl])

  React.useLayoutEffect(() => {
    refresh()
  }, [refresh, v2Selected, v2Hovered, v2Layers])

  React.useEffect(() => {
    if (!iframeEl) return
    const ro = new ResizeObserver(() => refresh())
    ro.observe(iframeEl)
    const root = rootRef.current
    if (root) ro.observe(root)
    window.addEventListener('resize', refresh)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', refresh)
    }
  }, [iframeEl, refresh])

  const rects = React.useMemo(() => {
    const result: Array<{
      id: string
      left: number
      top: number
      width: number
      height: number
      type: 'selected' | 'hover'
    }> = []

    if (hasV3) {
      for (const id of v3Selected) {
        const shape = v3Doc.shapes[id]
        if (!shape) continue
        result.push({
          id,
          left: shape.bounds.x,
          top: shape.bounds.y,
          width: shape.bounds.width,
          height: shape.bounds.height,
          type: 'selected',
        })
      }
      if (v3Hovered && !v3Selected.includes(v3Hovered)) {
        const shape = v3Doc.shapes[v3Hovered]
        if (shape) {
          result.push({
            id: v3Hovered,
            left: shape.bounds.x,
            top: shape.bounds.y,
            width: shape.bounds.width,
            height: shape.bounds.height,
            type: 'hover',
          })
        }
      }
      return result
    }

    if (!iframeLocal || v2Layers.length === 0) return result

    const push = (id: string, type: 'selected' | 'hover') => {
      const el = v2Layers.find((l) => l.id === id)
      if (!el) return
      result.push({
        id,
        left: iframeLocal.left + el.bounds.x,
        top: iframeLocal.top + el.bounds.y,
        width: el.bounds.width,
        height: el.bounds.height,
        type,
      })
    }

    for (const id of v2Selected) push(id, 'selected')
    if (v2Hovered && !v2Selected.includes(v2Hovered)) push(v2Hovered, 'hover')

    return result
  }, [hasV3, v3Doc, v3Selected, v3Hovered, v2Layers, v2Selected, v2Hovered, iframeLocal])

  if (!hasV3 && !iframeEl) return null
  if (rects.length === 0 && !iframeEl) return null

  return (
    <div
      ref={rootRef}
      className={cn('pointer-events-none absolute inset-0 z-10', className)}
      aria-hidden="true"
    >
      {rects.map((r) => (
        <div
          key={`${r.type}-${r.id}`}
          className={cn(
            'absolute',
            r.type === 'selected' &&
              'border-2 border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.5)]',
            r.type === 'hover' &&
              'border border-dashed border-muted-foreground/70 bg-muted-foreground/5',
          )}
          style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
        />
      ))}
    </div>
  )
}
