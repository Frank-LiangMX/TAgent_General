/**
 * useCanvasSelection — 画布选中态 hook（v2）
 *
 * 职责：
 *  1) 创建并维护 FrameBridgeClient 实例（生命周期 = 组件生命周期）
 *  2) 把 iframe 上报的 layers / click / hover 路由到 jotai atoms
 *  3) 把 jotai 中 selectedElementIds 同步回 iframe（高亮）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.1-§4.2
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import {
  canvasLayersAtom,
  designActiveToolAtom,
  hoveredElementIdAtom,
  selectedElementIdsAtom,
  type CanvasElement,
} from '@/atoms/design-preview-atoms'

import { FrameBridgeClient } from '@/lib/canvas-frame-bridge'

export interface UseCanvasSelectionResult {
  bridge: React.MutableRefObject<FrameBridgeClient | null>
  /** iframe onLoad 时调用，把 iframe 绑到 bridge */
  attachToIframe: (iframe: HTMLIFrameElement) => void
  /** iframe contentWindow 重写后调用（srcDoc reload） */
  onIframeReloaded: () => void
}

export interface UseCanvasSelectionOptions {
  /** iframe 内中键平移（screen 坐标） */
  onPanStart?: (screenX: number, screenY: number) => void
  onPanMove?: (screenX: number, screenY: number) => void
  onPanEnd?: () => void
}

/**
 * 父组件用法：
 *   const { attachToIframe } = useCanvasSelection()
 *   <iframe ref={el => el && attachToIframe(el)} ... />
 *
 * 设计上 bridge 自身单例；handlers 在 hook 内稳定绑定，组件不需关心。
 */
export function useCanvasSelection(
  options?: UseCanvasSelectionOptions,
): UseCanvasSelectionResult {
  const setLayers = useSetAtom(canvasLayersAtom)
  const setHovered = useSetAtom(hoveredElementIdAtom)
  const setSelected = useSetAtom(selectedElementIdsAtom)
  const selectedIds = useAtomValue(selectedElementIdsAtom)

  const onPanStartRef = React.useRef(options?.onPanStart)
  onPanStartRef.current = options?.onPanStart
  const onPanMoveRef = React.useRef(options?.onPanMove)
  onPanMoveRef.current = options?.onPanMove
  const onPanEndRef = React.useRef(options?.onPanEnd)
  onPanEndRef.current = options?.onPanEnd

  // 单例 client：每次 render 不重建
  const bridgeRef = React.useRef<FrameBridgeClient | null>(null)
  if (bridgeRef.current === null) {
    bridgeRef.current = new FrameBridgeClient()
  }

  // 监听 tool 模式变化 → 同步到 iframe；离开选择模式时销毁选中/hover 高亮框
  const activeTool = useAtomValue(designActiveToolAtom)
  React.useEffect(() => {
    bridgeRef.current?.setMode(activeTool)
    if (activeTool !== 'select') {
      setSelected([])
      setHovered(null)
      bridgeRef.current?.clearHighlight()
    }
  }, [activeTool, setSelected, setHovered])

  // stable handlers：每次 render 复用同一函数引用（闭包捕获 setXxx 函数引用稳定）
  const handlersRef = React.useRef({
    onLayers: (layers: CanvasElement[]) => setLayers(layers),
    onElementClicked: (id: string | null, _bounds: CanvasElement['bounds'] | null, additive: boolean) => {
      if (id === null) {
        // 点击空白区域：取消所有选中
        setSelected([])
        return
      }
      setSelected((prev: string[]) => {
        if (additive) {
          return prev.includes(id) ? prev.filter((x: string) => x !== id) : [...prev, id]
        }
        // 非 add：点击元素直接选中（不 toggle），已选中的同一个元素保持选中
        return prev.includes(id) ? prev : [id]
      })
    },
    onElementHovered: (id: string | null) => setHovered(id),
    onPanStart: (screenX: number, screenY: number) => {
      onPanStartRef.current?.(screenX, screenY)
    },
    onPanMove: (screenX: number, screenY: number) => {
      onPanMoveRef.current?.(screenX, screenY)
    },
    onPanEnd: () => {
      onPanEndRef.current?.()
    },
  })

  // 用 ref 避免 useEffect 的闭包陈旧问题
  const activeToolRef = React.useRef(activeTool)
  activeToolRef.current = activeTool

  const attachToIframe = React.useCallback((iframe: HTMLIFrameElement) => {
    const client = bridgeRef.current
    if (!client) return
    client.attach(iframe, handlersRef.current)
    // attach 完成后立即把当前 mode 同步过去
    const tool = activeToolRef.current
    if (tool) client.setMode(tool)
  }, [])

  /** iframe contentWindow 重写后（srcDoc reload）必须调一次，否则 message 收不到 */
  const onIframeReloaded = React.useCallback(() => {
    bridgeRef.current?.onIframeReloaded()
  }, [])

  // 选中态变化时同步到 iframe 高亮
  React.useEffect(() => {
    const client = bridgeRef.current
    if (!client) return
    if (selectedIds.length > 0) {
      client.setHighlight(selectedIds)
    } else {
      client.clearHighlight()
    }
  }, [selectedIds])

  // 卸载时 detach
  React.useEffect(() => {
    const client = bridgeRef.current
    return () => {
      client?.detach()
    }
  }, [])

  return {
    bridge: bridgeRef,
    attachToIframe,
    onIframeReloaded,
  }
}