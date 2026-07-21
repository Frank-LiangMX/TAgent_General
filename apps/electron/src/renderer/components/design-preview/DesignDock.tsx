/**
 * DesignDock — 画布浮动 Dock 工具栏
 *
 * - 选择 / 交互 / 平移模式切换
 * - 缩放控制
 * - 刷新 / 清空
 * - 放大模式 / 沉浸全屏
 * - 沉浸全屏下：隐藏/显示会话
 */

import { useAtom, useSetAtom } from 'jotai'
import {
  Expand,
  Hand,
  Maximize2,
  MessageSquare,
  Minimize2,
  MinusCircle,
  MousePointer2,
  MousePointerClick,
  PanelLeftClose,
  PlusCircle,
  RefreshCw,
  Scan,
  Trash2,
} from 'lucide-react'
import * as React from 'react'

import {
  clearDesignCanvasAtom,
  designActiveToolAtom,
  designFullscreenAtom,
  designImmersiveAtom,
  designImmersiveHideChatAtom,
  designSelectionAtom,
  refreshDesignCanvasAtom,
  type DesignCanvasTool,
} from '@/atoms/design-preview-atoms'
import { inspectorMagnifiedAtom } from '@/atoms/app-mode'
import { zoomAtom, resetViewportAtom } from '@/design/canvas-viewport-store'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@tagent/ui'

const TOOLS: Array<{ value: DesignCanvasTool; icon: React.ReactNode; label: string; tip: string }> =
  [
    {
      value: 'interact',
      icon: <MousePointerClick className="size-4" />,
      label: '交互',
      tip: '与原型交互',
    },
    { value: 'select', icon: <MousePointer2 className="size-4" />, label: '选择', tip: '选择元素' },
    {
      value: 'pan',
      icon: <Hand className="size-4" />,
      label: '平移',
      tip: '平移画布（按住中键或空格临时切换，松开恢复）',
    },
  ]

function DockTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactElement
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export interface DesignDockProps {
  className?: string
}

export function DesignDock({ className }: DesignDockProps): React.ReactElement {
  const [activeTool, setActiveTool] = useAtom(designActiveToolAtom)
  const [zoom, setZoom] = useAtom(zoomAtom)
  const resetZoom = useSetAtom(resetViewportAtom)
  const [designFullscreen, setDesignFullscreen] = useAtom(designFullscreenAtom)
  const [inspectorMagnified, setInspectorMagnified] = useAtom(inspectorMagnifiedAtom)
  const magnify = inspectorMagnified || designFullscreen
  const setMagnify = (next: boolean) => {
    setInspectorMagnified(next)
    setDesignFullscreen(next)
  }
  const [immersive, setImmersive] = useAtom(designImmersiveAtom)
  const [hideChat, setHideChat] = useAtom(designImmersiveHideChatAtom)
  const refresh = useSetAtom(refreshDesignCanvasAtom)
  const clear = useSetAtom(clearDesignCanvasAtom)
  const setSelection = useSetAtom(designSelectionAtom)

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border/50 bg-background/90 px-1.5 py-1 shadow-lg backdrop-blur-sm',
          className
        )}
      >
        {TOOLS.map((tool) => (
          <DockTooltip key={tool.value} label={tool.tip}>
            <button
              type="button"
              onClick={() => {
                setActiveTool(tool.value)
                if (tool.value === 'select') setSelection(null)
              }}
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                activeTool === tool.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-label={tool.label}
            >
              {tool.icon}
            </button>
          </DockTooltip>
        ))}

        <span className="mx-0.5 h-4 w-px bg-border/40" />

        <DockTooltip label="缩小">
          <button
            type="button"
            onClick={() => setZoom(Math.max(0.1, zoom - 0.25))}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="缩小"
          >
            <MinusCircle className="size-3.5" />
          </button>
        </DockTooltip>
        <ZoomInput zoom={zoom} setZoom={(z: number) => setZoom(z)} />
        <DockTooltip label="放大">
          <button
            type="button"
            onClick={() => setZoom(Math.min(4, zoom + 0.25))}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="放大缩放"
          >
            <PlusCircle className="size-3.5" />
          </button>
        </DockTooltip>
        <DockTooltip label="适应画布">
          <button
            type="button"
            onClick={() => resetZoom()}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="适应"
          >
            <Scan className="size-3.5" />
          </button>
        </DockTooltip>

        <span className="mx-0.5 h-4 w-px bg-border/40" />

        <DockTooltip label="刷新">
          <button
            type="button"
            onClick={() => refresh()}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="刷新"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </DockTooltip>
        <DockTooltip label="清空画布">
          <button
            type="button"
            onClick={() => clear()}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="清空"
          >
            <Trash2 className="size-3.5" />
          </button>
        </DockTooltip>

        <span className="mx-0.5 h-4 w-px bg-border/40" />

        {/* 聚焦模式：扩大画布区，仍保留左侧导航 */}
        {!immersive && (
          <DockTooltip label={magnify ? '退出聚焦' : '聚焦模式'}>
            <button
              type="button"
              onClick={() => setMagnify(!magnify)}
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                magnify
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-label={magnify ? '退出聚焦' : '聚焦模式'}
            >
              {magnify ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </DockTooltip>
        )}

        {/* 沉浸全屏：隐藏壳层，只留会话 + 画布 */}
        <DockTooltip label={immersive ? '退出全屏' : '全屏模式'}>
          <button
            type="button"
            onClick={() => setImmersive(!immersive)}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors',
              immersive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            aria-label={immersive ? '退出全屏' : '全屏模式'}
          >
            {immersive ? <Minimize2 className="size-3.5" /> : <Expand className="size-3.5" />}
          </button>
        </DockTooltip>

        {/* 沉浸全屏下：隐藏 / 显示会话 */}
        {immersive && (
          <DockTooltip label={hideChat ? '显示会话' : '隐藏会话'}>
            <button
              type="button"
              onClick={() => setHideChat(!hideChat)}
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors',
                hideChat
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-label={hideChat ? '显示会话' : '隐藏会话'}
            >
              {hideChat ? (
                <MessageSquare className="size-3.5" />
              ) : (
                <PanelLeftClose className="size-3.5" />
              )}
            </button>
          </DockTooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

/** 可手输的缩放百分比 */
function ZoomInput({
  zoom,
  setZoom,
}: {
  zoom: number
  setZoom: (z: number) => void
}): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = React.useCallback(() => {
    const val = parseInt(draft, 10)
    if (!isNaN(val)) {
      setZoom(Math.max(10, Math.min(400, val)) / 100)
    }
    setEditing(false)
  }, [draft, setZoom])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
        className="min-w-[2.5rem] text-center text-[11px] font-medium tabular-nums text-foreground bg-muted/60 rounded border border-border/40 outline-none"
        style={{ width: '2.8rem', padding: '1px 2px' }}
        aria-label="缩放比例"
      />
    )
  }

  return (
    <DockTooltip label="点击输入缩放比例">
      <button
        type="button"
        className="min-w-[2.5rem] text-center text-[11px] font-medium tabular-nums text-foreground hover:bg-muted/40 rounded"
        onClick={() => {
          setDraft(String(Math.round(zoom * 100)))
          setEditing(true)
        }}
        aria-label={`缩放 ${Math.round(zoom * 100)}%`}
      >
        {Math.round(zoom * 100)}%
      </button>
    </DockTooltip>
  )
}
