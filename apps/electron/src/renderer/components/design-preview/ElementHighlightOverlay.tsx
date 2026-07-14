/**
 * SelectionOverlay — Design Preview v2 选中元素高亮覆盖层
 *
 * 取代 v1 的 SelectionOverlay（单矩形）。
 * v2 行为：根据 selectedElements + bounds 在 iframe 之上画多个虚线框。
 *
 * 数据源：useViewingState() 从 useViewingState 提供 active snapshot 的话层；
 * 元素 bounds 来自 canvasLayersAtom。
 *
 * 为什么用父窗口覆盖层而不是 iframe 内 outline：
 *  - 跨 origin/iframe 重写场景稳定（iframe 内 outline 会被 srcDoc 重写清掉）
 *  - 视觉风格可与画布控件统一
 *  - 支持 hover 态（半透明虚线）
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import {
  canvasLayersAtom,
  hoveredElementIdAtom,
  selectedElementIdsAtom,
  type CanvasElement,
} from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'

export interface ElementHighlightOverlayProps {
  className?: string
  /** iframe 位置 + 缩放系数 */
  geometry: {
    /** iframe 元素（用于取 bounding rect） */
    iframeEl: HTMLIFrameElement | null
    /** 当前 zoom 系数 */
    zoom: number
  }
}

/**
 * 把 iframe 内的 bounds 转换成父窗口坐标系下的矩形位置。
 */
function boundsToClientRect(
  bounds: { x: number; y: number; width: number; height: number },
  iframeRect: DOMRect,
  zoom: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: iframeRect.left + bounds.x * zoom,
    top: iframeRect.top + bounds.y * zoom,
    width: bounds.width * zoom,
    height: bounds.height * zoom,
  }
}

export function ElementHighlightOverlay({
  className,
  geometry,
}: ElementHighlightOverlayProps): React.ReactElement | null {
  const layers = useAtomValue(canvasLayersAtom)
  const selectedIds = useAtomValue(selectedElementIdsAtom)
  const hoveredId = useAtomValue(hoveredElementIdAtom)

  const [iframeRect, setIframeRect] = React.useState<DOMRect | null>(null)

  // 监听 iframe 位置变化（resize/scroll/zoom）
  React.useEffect(() => {
    const ifr = geometry.iframeEl
    if (!ifr) return
    const update = () => {
      try {
        setIframeRect(ifr.getBoundingClientRect())
      } catch {
        setIframeRect(null)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(ifr)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [geometry.iframeEl])

  // 计算选中元素 + hover 元素 的覆盖矩形（必须在 iframeRect 判断之前，遵守 hooks 规则）
  const layersById = React.useMemo(() => {
    const m = new Map<string, CanvasElement>()
    for (const l of layers) m.set(l.id, l)
    return m
  }, [layers])

  const rects = React.useMemo(() => {
    if (!iframeRect) return []
    const result: Array<{
      id: string
      left: number
      top: number
      width: number
      height: number
      type: 'selected' | 'hover' | 'empty'
    }> = []

    // 1) 选中元素（蓝色实线）
    for (const id of selectedIds) {
      const el = layersById.get(id)
      if (!el) continue
      const r = boundsToClientRect(el.bounds, iframeRect, geometry.zoom)
      result.push({ id, ...r, type: 'selected' })
    }
    // 2) hover 元素（如果不是已选中的，灰色虚线 + 半透明覆盖）
    if (hoveredId && !selectedIds.includes(hoveredId)) {
      const el = layersById.get(hoveredId)
      if (el) {
        const r = boundsToClientRect(el.bounds, iframeRect, geometry.zoom)
        result.push({ id: hoveredId, ...r, type: 'hover' })
      }
    }
    // 3) 选中列表里如果某个 id 没有 layer（已 stale），仍占位显示一个空标注
    for (const id of selectedIds) {
      if (!layersById.get(id)) {
        result.push({ id, left: 0, top: 0, width: 0, height: 0, type: 'empty' })
      }
    }
    return result
  }, [layersById, selectedIds, hoveredId, iframeRect, geometry.zoom])

  if (rects.length === 0) return null

  return (
    <div
      className={cn('pointer-events-none fixed inset-0 z-40', className)}
      aria-hidden="true"
    >
      {rects.map((r) =>
        r.type === 'empty' ? null : (
          <div
            key={r.id}
            data-element-highlight={r.id}
            className={cn(
              'absolute',
              r.type === 'selected' &&
                'border-2 border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.5)]',
              r.type === 'hover' &&
                'border border-dashed border-muted-foreground/70 bg-muted-foreground/5',
            )}
            style={{
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
            }}
          />
        ),
      )}
    </div>
  )
}