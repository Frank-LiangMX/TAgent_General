/**
 * DesignCanvas — Design Preview 画布（v2）
 *
 * v1 → v2 关键变化：
 *  1) 接入 FrameBridgeClient：iframe 内点选/hover 通过 postMessage 回流到 jotai atoms
 *  2) 选中元素后用 iframe 内部 outline 高亮（不走父窗口 SelectionOverlay 单矩形）
 *  3) 容器尺寸内的右键空白处：框选（v2 第一版暂保留原拖拽框选为 fallback）
 *  4) 在画布容器内嵌入 LayerTreePanel（左侧可折叠栏）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §3-§4
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Eye, Layers as LayersIcon, Sparkles, X } from 'lucide-react'
import * as React from 'react'

import {
  canvasLayersAtom,
  designActiveToolAtom,
  designCanvasStateAtom,
  designDeviceAtom,
  designEnabledAtom,
  designFullscreenAtom,
  designSelectionAtom,
  designVersionAtom,
  designViewportAtom,
  designZoomAtom,
  selectedElementIdsAtom,
  setDesignZoomAtom,
  type DesignCanvasTool,
} from '@/atoms/design-preview-atoms'
import { useCanvasSelection } from '@/hooks/useCanvasSelection'
import { useVersionSnapshotWatcher, useViewingState } from '@/hooks/useVersionSnapshot'
import { cn } from '@/lib/utils'

import { DesignDock } from './DesignDock'
import { DeviceFrame } from './DeviceFrame'
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
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Eye className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Design Preview 未启用</p>
        <p className="text-xs text-muted-foreground">让 Agent 生成 UI 原型后会自动启用</p>
      </div>
    </div>
  )
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">等待 Agent 生成 UI 原型</p>
        <p className="text-xs text-muted-foreground">在对话中说「帮我做一个登录页面」</p>
      </div>
    </div>
  )
}

/** 小地图预览（左下角） */
function MiniMap({
  html,
  css,
  device,
  zoom,
  viewport,
}: {
  html: string
  css?: string | null
  device: { width: number; height: number }
  zoom: number
  viewport: { panX: number; panY: number }
}): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const mmW = expanded ? 200 : 120
  const mmH = expanded ? (200 * device.height) / device.width : (120 * device.height) / device.width
  const mmScale = mmW / device.width

  const vpW = mmW / zoom
  const vpH = mmH / zoom
  const vpX = -viewport.panX * mmScale
  const vpY = -viewport.panY * mmScale

  return (
    <div
      className="absolute bottom-3 left-3 z-50 overflow-hidden rounded-lg border border-border/40 bg-background/90 shadow-lg backdrop-blur-sm transition-all cursor-pointer"
      style={{ width: mmW, height: mmH }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="relative w-full h-full overflow-hidden">
        <iframe
          srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;overflow:hidden}body{font-family:system-ui,sans-serif;background:#fff;color:#1a1a1a;width:${device.width}px;height:${device.height}px;transform:scale(${mmScale});transform-origin:0 0}${css ?? ''}</style></head><body>${html}</body></html>`}
          sandbox="allow-scripts"
          title="minimap"
          className="border-0 bg-white pointer-events-none"
          style={{ width: device.width, height: device.height }}
        />
        <div
          className="absolute border-[1.5px] border-primary/70 bg-primary/8 pointer-events-none rounded-sm"
          style={{
            left: Math.max(0, vpX),
            top: Math.max(0, vpY),
            width: Math.min(vpW, mmW - vpX),
            height: Math.min(vpH, mmH - vpY),
          }}
        />
      </div>
    </div>
  )
}

export function DesignCanvas({ className }: DesignCanvasProps): React.ReactElement {
  const enabled = useAtomValue(designEnabledAtom)
  // v2: viewing 状态——优先返回 activeSnapshotId 对应的快照；否则当前 base
  const viewing = useViewingState()
  const html = viewing.html
  const css = viewing.css
  const device = useAtomValue(designDeviceAtom)
  const zoom = useAtomValue(designZoomAtom)
  const version = useAtomValue(designVersionAtom)
  const viewport = useAtomValue(designViewportAtom)
  const setViewport = useSetAtom(designViewportAtom)
  const setZoom = useSetAtom(setDesignZoomAtom)
  const [selection, setSelection] = useAtom(designSelectionAtom)
  useAtomValue(designCanvasStateAtom)
  useAtomValue(designFullscreenAtom)

  // v2: 选中元素 id 列表（来自 iframe 内点选 / 框选）
  const selectedIds = useAtomValue(selectedElementIdsAtom)
  const setSelected = useSetAtom(selectedElementIdsAtom)
  const layers = useAtomValue(canvasLayersAtom)

  // v2: bridge hook（创建 + attachToIframe）
  const { attachToIframe, onIframeReloaded } = useCanvasSelection()

  // v2: 监听 html/css 变化 → 自动建快照
  useVersionSnapshotWatcher()

  // v2: 监听 bridge 的 iframe 就绪回调——确保 attach 后再 postMessage 才有 e.source 命中
  const handleIframeReady = React.useCallback(
    (iframe: HTMLIFrameElement) => {
      attachToIframe(iframe)
    },
    [attachToIframe],
  )
  const handleIframeLoaded = React.useCallback(() => {
    onIframeReloaded()
  }, [onIframeReloaded])

  // v2: layers 面板折叠
  const [layersOpen, setLayersOpen] = React.useState(true)

  const activeTool = useAtomValue(designActiveToolAtom)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const iframeContainerRef = React.useRef<HTMLDivElement>(null)
  const iframeElRef = React.useRef<HTMLIFrameElement | null>(null)
  const deviceSize = { width: 1280, height: 800 }

  // ── Ctrl+滚轮缩放（保留 v1 行为） ──
  // 用 native event listener + {passive: false} 才能 preventDefault；
  // React 17+ 的 onWheel 会被注册为 passive，preventDefault 会报警告。
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      // 读最新 zoom：依赖 atom 单值
      const z = currentZoomRef.current
      const dir = e.deltaY < 0 ? 1 : -1
      const step = z * 0.1
      const next = Math.max(0.25, Math.min(2, z + dir * step))
      if (next !== z) setZoom(next)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => {
      el.removeEventListener('wheel', handler)
    }
  }, [setZoom])

  const currentZoomRef = React.useRef(zoom)
  currentZoomRef.current = zoom

  // 保留旧 onWheel 给 React 渲染类型校验；运行时靠上面 native listener
  const handleWheel = React.useCallback((_e: React.WheelEvent) => {
    /* noop: 真实逻辑在 native listener 中 */
  }, [])

  // ── 拖拽平移 ──
  // v2 默认行为：在画布空白处（不在 iframe 上）按住左键 = 平移。
  // 拖到 iframe 上 / 点 iframe 内元素 → 走 iframe 内 click 选中。
  // 中键 / Shift+左键 / 触摸板右键 也走平移。
  // 拖拽距离 > 4px 才算拖（避免和点击冲突）。
  const dragRef = React.useRef<{
    startX: number
    startY: number
    panX: number
    panY: number
    moved: boolean
  } | null>(null)
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      // 交互模式：禁止所有平移，让 iframe 内控件正常工作
      if (activeTool === 'interact') return

      // 平移模式：任何左键/中键/右键都平移
      if (activeTool === 'pan') {
        e.preventDefault()
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          panX: viewport.panX,
          panY: viewport.panY,
          moved: false,
        }
        return
      }

      // 选择模式：e.target 在 iframe 内 → 让 iframe 处理点击/选中
      if ((e.target as HTMLElement).tagName === 'IFRAME') {
        const isPanGesture =
          e.button === 1 || (e.button === 0 && (e.shiftKey || e.metaKey || e.altKey)) || e.button === 2
        if (!isPanGesture) return
      }
      // 中键 / Shift+左键 / Meta+左键 / Alt+左键 / 触摸板右键 → 平移
      const isPanGesture =
        e.button === 1 ||
        (e.button === 0 && (e.shiftKey || e.metaKey || e.altKey)) ||
        e.button === 2
      const isLeftDrag = e.button === 0 && !e.shiftKey && !e.metaKey && !e.altKey
      if (!isPanGesture && !isLeftDrag) return
      e.preventDefault()
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: viewport.panX,
        panY: viewport.panY,
        moved: false,
      }
    },
    [viewport, activeTool],
  )

  // 全局鼠标监听：用 native listener 保证 mousemove 能正确触发
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return
      d.moved = true
      setViewport({ panX: d.panX + dx, panY: d.panY + dy })
    }
    const handleMouseUp = () => {
      // 移动距离 < 4px 视为点击——不重置 viewport，但清 drag 状态
      dragRef.current = null
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [setViewport])

  // 阻止画布内右键菜单，避免右键平移时被系统菜单打断
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      if (e.button === 2) e.preventDefault()
    }
    el.addEventListener('contextmenu', handler)
    return () => el.removeEventListener('contextmenu', handler)
  }, [])

  if (!enabled) {
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div
          className="flex-1 overflow-hidden bg-background"
          style={{
            backgroundImage:
              'radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <DisabledState />
        </div>
      </div>
    )
  }

  const hasContent = Boolean(html)
  const sel = selection

  return (
    <div className={cn('flex h-full w-full', className)}>
      {/* 左侧 Layers（v2 新增） */}
      {layersOpen && (
        <div className="w-56 shrink-0">
          <LayerTreePanel />
        </div>
      )}

      <div className="flex flex-1 flex-col relative min-w-0">
        {/* v2: 顶部 toolbar：layers 开关 + 选中信息 */}
        <div className="flex items-center gap-2 border-b border-border/40 bg-background/60 px-3 py-1.5 backdrop-blur">
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted',
              layersOpen && 'bg-muted',
            )}
            onClick={() => setLayersOpen((v) => !v)}
          >
            <LayersIcon className="size-3.5" />
            <span>分层</span>
          </button>

          <div className="ml-1">
            <ImportDropZone />
          </div>
          {selectedIds.length > 0 && (
            <>
              <div className="ml-2 text-[11px] text-muted-foreground">
                已选中 {selectedIds.length} 个元素
              </div>
              <button
                type="button"
                className="ml-auto flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setSelected([])}
              >
                <X className="size-3" />
                取消选中
              </button>
            </>
          )}
          {viewing.isViewingHistory && (
            <div className="ml-auto rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
              查看历史 v{viewing.fromSnapshot?.version}（只读）
            </div>
          )}
        </div>

        {/* v2: 版本时间线 */}
        <VersionTimeline />

        <div
          ref={containerRef}
          className="flex-1 overflow-hidden"
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundColor: 'hsl(var(--background))',
          }}
        >
          {hasContent && html ? (
            <div
              className="flex items-start justify-center"
              style={{
                transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${zoom})`,
                transformOrigin: '0 0',
                minWidth: '100%',
                minHeight: '100%',
              }}
            >
              <div className="p-6" ref={iframeContainerRef}>
                <DeviceFrame device={device}>
                  <HtmlRenderer
                    html={html}
                    css={css}
                    device={device}
                    version={version}
                    onIframeReady={(el) => {
                      iframeElRef.current = el
                      handleIframeReady(el)
                    }}
                    onIframeLoaded={handleIframeLoaded}
                  />
                </DeviceFrame>
              </div>
              {/* v2: 保留 v1 的单矩形框选用于 v1 兼容；新选中用 iframe outline */}
              {sel && (
                <div
                  className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                  style={{
                    left: sel.x,
                    top: sel.y,
                    width: sel.width,
                    height: sel.height,
                  }}
                >
                  <div className="absolute -top-6 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground whitespace-nowrap">
                    {Math.round(sel.width)} × {Math.round(sel.height)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>

        {hasContent && html && (
          <MiniMap html={html} css={css} device={deviceSize} zoom={zoom} viewport={viewport} />
        )}

        {hasContent && html && (
          <div className="absolute bottom-3 right-3 z-50 pointer-events-none">
            <DesignDock />
          </div>
        )}

        {/* v2: 选中元素高亮覆盖层（仅选择模式显示） */}
        {hasContent && html && activeTool === 'select' && (
          <ElementHighlightOverlay
            geometry={{
              iframeEl: iframeElRef.current,
              zoom,
            }}
          />
        )}
      </div>
    </div>
  )
}