/**
 * DesignCanvas — Design Preview 画布（v3）
 *
 * 双模渲染：
 *  - v3 节点树：CanvasRenderer（SVG），数据源 currentDocumentAtom
 *  - v2 兼容：HtmlRenderer（iframe），数据源 designHtmlAtom
 *
 * 优先级：v3 > v2。有 ShapeOp 形状时走 SVG，否则 fallback HTML。
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v3.md
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Eye, Sparkles, X } from 'lucide-react'
import * as React from 'react'

import {
  designHtmlAtom,
  designCssAtom,
  designVersionAtom,
  designDeviceAtom,
  selectedElementIdsAtom,
  designActiveToolAtom,
  type DesignCanvasTool,
} from '@/atoms/design-preview-atoms'
import {
  selectedShapeIdsAtom,
  selectShapeAtom,
  hoveredShapeIdAtom,
  clearSelectionAtom,
} from '@/design/canvas-selection-store'
import { currentDocumentAtom } from '@/design/canvas-shape-store'
import { viewportAtom } from '@/design/canvas-viewport-store'
import { CanvasRenderer } from '@/design/canvas-renderer'
import { useCanvasSelection } from '@/hooks/useCanvasSelection'
import { cn } from '@/lib/utils'

import { DesignDock } from './DesignDock'
import { DeviceFrame } from './DeviceFrame'
import { CanvasMinimap } from './CanvasMinimap'
import { ElementHighlightOverlay } from './ElementHighlightOverlay'
import { HtmlRenderer } from './HtmlRenderer'
import { ImportDropZone } from './ImportDropZone'
import { LayerTreePanel } from './LayerTreePanel'
import { VersionTimeline } from './VersionTimeline'

export interface DesignCanvasProps {
  className?: string
}

function DisabledState(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl border border-border/60 bg-background/60 shadow-sm">
        <Eye className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Design Preview 未启用</p>
        <p className="mx-auto max-w-[220px] text-xs leading-relaxed text-muted-foreground">
          让 Agent 生成 UI 原型后会自动启用
        </p>
      </div>
    </div>
  )
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10">
        <Sparkles className="size-5" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">等待 Agent 生成 UI 原型</p>
        <p className="mx-auto max-w-[220px] text-xs leading-relaxed text-muted-foreground">
          在对话中说「帮我做一个登录页面」，选中元素后可直接告诉 Agent 修改这里
        </p>
      </div>
    </div>
  )
}

/** 原型基调的工具栏胶囊按钮（细发丝描边 + 半透明底） */
const toolbarChipClass =
  'flex h-7 items-center gap-1.5 rounded-lg border border-border/45 bg-background/50 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-background/75 hover:text-foreground disabled:pointer-events-none disabled:opacity-45'

/** 是否在可编辑区域（输入框等），空格键不应触发平移 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

export function DesignCanvas({ className }: DesignCanvasProps): React.ReactElement {
  // ── v3 节点树数据 ──
  const doc = useAtomValue(currentDocumentAtom)
  const selectedIds = useAtomValue(selectedShapeIdsAtom)
  const hoveredId = useAtomValue(hoveredShapeIdAtom)
  const selectShape = useSetAtom(selectShapeAtom)
  const setHovered = useSetAtom(hoveredShapeIdAtom)
  const clearSel = useSetAtom(clearSelectionAtom)
  const [viewport, setViewport] = useAtom(viewportAtom)

  // ── v2 HTML 兼容数据 ──
  const html = useAtomValue(designHtmlAtom)
  const css = useAtomValue(designCssAtom)
  const version = useAtomValue(designVersionAtom)
  const device = useAtomValue(designDeviceAtom)
  const [activeTool, setActiveTool] = useAtom(designActiveToolAtom)
  const setV2SelectedIds = useSetAtom(selectedElementIdsAtom)

  // Layers 浮岛默认收起为把手（对齐原型 canvas-layer-handle）
  const [layersOpen, setLayersOpen] = React.useState(false)

  // ── iframe bridge（连接注入脚本 → 选中态/分层） ──
  const [iframeEl, setIframeEl] = React.useState<HTMLIFrameElement | null>(null)

  // ── 拖拽平移（screen 坐标：iframe 内中键与父窗口一致）──
  const dragRef = React.useRef<{
    sx: number
    sy: number
    px: number
    py: number
    moved: boolean
  } | null>(null)
  const viewportRef = React.useRef(viewport)
  viewportRef.current = viewport

  const beginPanAtScreen = React.useCallback((screenX: number, screenY: number) => {
    const vp = viewportRef.current
    dragRef.current = { sx: screenX, sy: screenY, px: vp.panX, py: vp.panY, moved: false }
  }, [])

  const applyPanAtScreen = React.useCallback(
    (screenX: number, screenY: number) => {
      const d = dragRef.current
      if (!d) return
      const dx = screenX - d.sx
      const dy = screenY - d.sy
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return
      d.moved = true
      setViewport((prev) => ({ ...prev, panX: d.px + dx, panY: d.py + dy }))
    },
    [setViewport]
  )

  const endPan = React.useCallback(() => {
    dragRef.current = null
  }, [])

  const beginPan = React.useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault()
      beginPanAtScreen(e.screenX, e.screenY)
    },
    [beginPanAtScreen]
  )

  // ── 临时平移（空格 / 中键）：按住切 pan，松开恢复之前工具 ──
  const activeToolRef = React.useRef(activeTool)
  activeToolRef.current = activeTool
  const toolBeforeTempPanRef = React.useRef<DesignCanvasTool | null>(null)
  const tempPanHoldCountRef = React.useRef(0)
  const middleHeldRef = React.useRef(false)

  const enterTempPan = React.useCallback(() => {
    if (tempPanHoldCountRef.current === 0) {
      toolBeforeTempPanRef.current = activeToolRef.current
      if (activeToolRef.current !== 'pan') {
        setActiveTool('pan')
      }
    }
    tempPanHoldCountRef.current += 1
  }, [setActiveTool])

  const exitTempPan = React.useCallback(() => {
    if (tempPanHoldCountRef.current <= 0) return
    tempPanHoldCountRef.current -= 1
    if (tempPanHoldCountRef.current > 0) return
    const prev = toolBeforeTempPanRef.current
    toolBeforeTempPanRef.current = null
    if (prev != null) setActiveTool(prev)
  }, [setActiveTool])

  const beginMiddleTempPan = React.useCallback(
    (screenX: number, screenY: number) => {
      if (middleHeldRef.current) {
        // 已在中键临时平移中（例如重复 pan:start），只更新拖拽起点
        beginPanAtScreen(screenX, screenY)
        return
      }
      middleHeldRef.current = true
      enterTempPan()
      beginPanAtScreen(screenX, screenY)
    },
    [beginPanAtScreen, enterTempPan]
  )

  const endMiddleTempPan = React.useCallback(() => {
    if (!middleHeldRef.current) {
      endPan()
      return
    }
    middleHeldRef.current = false
    endPan()
    exitTempPan()
  }, [endPan, exitTempPan])

  const { attachToIframe } = useCanvasSelection({
    onPanStart: beginMiddleTempPan,
    onPanMove: applyPanAtScreen,
    onPanEnd: endMiddleTempPan,
  })
  const handleIframeReady = React.useCallback(
    (iframe: HTMLIFrameElement) => {
      setIframeEl(iframe)
      attachToIframe(iframe)
    },
    [attachToIframe]
  )

  const hasV3Content = Object.keys(doc.shapes).length > 1 // 多于 __root__
  const hasHtmlContent = Boolean(html)
  const hasContent = hasV3Content || hasHtmlContent

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [containerEl, setContainerEl] = React.useState<HTMLDivElement | null>(null)
  const containerRefCallback = React.useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el
    setContainerEl(el)
  }, [])

  // ── Ctrl+滚轮缩放 ──
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const dir = e.deltaY < 0 ? 1 : -1
      setViewport((prev) => {
        const step = prev.zoom * 0.1
        const next = Math.max(0.1, Math.min(4, prev.zoom + dir * step))
        return next === prev.zoom ? prev : { ...prev, zoom: next }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [setViewport])

  // ── 空格键临时平移（与中键同一套 enter/exit）──
  React.useEffect(() => {
    let spaceHeld = false
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (isEditableTarget(e.target)) return
      if (e.repeat) return
      if (spaceHeld) return
      e.preventDefault()
      spaceHeld = true
      enterTempPan()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (!spaceHeld) return
      spaceHeld = false
      exitTempPan()
    }
    const onBlur = () => {
      if (spaceHeld) {
        spaceHeld = false
        exitTempPan()
      }
      if (middleHeldRef.current) {
        endMiddleTempPan()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [enterTempPan, exitTempPan, endMiddleTempPan])

  /** 中键：临时切平移并开始拖拽（空白区域；iframe 内由 bridge 转发） */
  const handleContainerMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
        beginMiddleTempPan(e.screenX, e.screenY)
      }
    },
    [beginMiddleTempPan]
  )

  /** 平移工具 / 临时平移：覆盖层左键拖拽 */
  const handlePanOverlayMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      beginPan(e)
    },
    [beginPan]
  )

  // 选择模式下点击画布空白区域取消 v2 选中
  const handleContainerClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'select') return
      if (e.target !== e.currentTarget) return
      setV2SelectedIds([])
    },
    [activeTool, setV2SelectedIds]
  )

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      applyPanAtScreen(e.screenX, e.screenY)
    }
    const onUp = (e: MouseEvent) => {
      if (e.button === 1) {
        endMiddleTempPan()
        return
      }
      // 左键松开：只结束拖拽，不恢复工具（空格仍可能按住）
      if (e.button === 0) endPan()
    }
    // 阻止中键自动滚动（autoscroll）
    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('auxclick', onAuxClick)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('auxclick', onAuxClick)
    }
  }, [applyPanAtScreen, endPan, endMiddleTempPan])

  const isPanTool = activeTool === 'pan'

  return (
    <div className={cn('flex h-full w-full flex-col px-2.5 pb-2.5 pt-2', className)}>
      <div className="flex flex-1 flex-col relative min-w-0">
        {/* 顶部工具栏：原型 scene-toolbar 基调，工具/缩放/刷新与导入同一行 */}
        <div className="mb-2 flex items-center gap-1.5">
          {hasContent && (
            <>
              <DesignDock />
              <span className="mx-0.5 h-4 w-px bg-border/40" />
            </>
          )}
          <ImportDropZone />
          {selectedIds.length > 0 && (
            <button
              type="button"
              className={cn(toolbarChipClass, 'border-primary/30 bg-primary/10 text-primary')}
              onClick={() => clearSel()}
            >
              <span>已选中 {selectedIds.length} 个元素</span>
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* 画布场域：内嵌大圆角卡片 + 原型同款细点阵网格（relative 用于覆盖层定位） */}
        <div
          ref={containerRefCallback}
          className={cn(
            'flex-1 overflow-hidden relative rounded-2xl border border-border/45',
            isPanTool && 'cursor-grab'
          )}
          onMouseDown={handleContainerMouseDown}
          onClick={handleContainerClick}
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.3) 0.75px, transparent 0.8px)`,
            backgroundSize: `${15 * viewport.zoom}px ${15 * viewport.zoom}px`,
            backgroundColor: 'hsl(var(--muted) / 0.4)',
          }}
        >
          {hasV3Content ? (
            <div
              style={{
                transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
                transformOrigin: '0 0',
                width: '100%',
                height: '100%',
              }}
            >
              <CanvasRenderer
                document={doc}
                selectedIds={selectedIds}
                hoveredId={hoveredId}
                onShapeClick={(id, _e) => selectShape(id)}
                onShapeHover={(id) => setHovered(id)}
              />
            </div>
          ) : hasHtmlContent ? (
            <div
              className="flex items-start justify-center p-6"
              style={{
                transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {/* relative 包裹：高亮层与 DeviceFrame 同坐标系，跟随 pan/zoom transform */}
              <div className="relative inline-block">
                <DeviceFrame device={device}>
                  <HtmlRenderer
                    html={html!}
                    css={css}
                    device={device}
                    version={version}
                    onIframeReady={handleIframeReady}
                  />
                </DeviceFrame>
                <ElementHighlightOverlay iframeEl={iframeEl} />
              </div>
            </div>
          ) : (
            <EmptyState />
          )}

          {/* 平移覆盖层：挡住 iframe，让左键拖拽能平移（否则事件被 iframe 吞掉） */}
          {isPanTool && hasContent && (
            <div
              className="absolute inset-0 z-30 cursor-grab active:cursor-grabbing"
              onMouseDown={handlePanOverlayMouseDown}
              aria-hidden="true"
            />
          )}

          {/* Layers 浮岛：右上角单一浮窗，点把手行展开分层树（原型 canvas-layer-handle） */}
          {hasContent && (
            <div className="pointer-events-none absolute bottom-3 right-3 top-3 z-40 flex w-60 flex-col items-stretch">
              <LayerTreePanel
                className={cn(
                  'pointer-events-auto min-h-0 shadow-lg shadow-foreground/5',
                  !layersOpen && 'w-auto self-end'
                )}
                open={layersOpen}
                onToggle={() => setLayersOpen((v) => !v)}
              />
            </div>
          )}

          {/* 左下角常驻缩略图 */}
          {hasContent && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-40">
              <CanvasMinimap containerEl={containerEl} />
            </div>
          )}
        </div>

        {/* 版本时间线：画布下方居中胶囊条（仅 v3 模式） */}
        {hasV3Content && <VersionTimeline />}
      </div>
    </div>
  )
}
