/**
 * DesignDock — 画布顶部工具组（原型 scene-toolbar 基调）
 *
 * - 选择 / 交互 / 平移模式切换
 * - 缩放控制
 * - 刷新 / 清空
 *
 * 窗口态入口（聚焦 / 沉浸全屏）已移除：聚焦走 RightInspectorFrame 头部，Esc 统一退出。
 */

import { useAtom, useSetAtom } from 'jotai'
import {
  Hand,
  MinusCircle,
  MousePointer2,
  MousePointerClick,
  PlusCircle,
  RefreshCw,
  Scan,
  Trash2,
} from 'lucide-react'
import * as React from 'react'

import {
  clearDesignCanvasAtom,
  designActiveToolAtom,
  designSelectionAtom,
  refreshDesignCanvasAtom,
  type DesignCanvasTool,
} from '@/atoms/design-preview-atoms'
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
      <TooltipContent side="bottom" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** 顶部工具栏图标胶囊（与导入按钮同基调） */
const dockChipClass =
  'flex size-7 items-center justify-center rounded-glass-popover border border-border/45 bg-background/50 text-muted-foreground transition-colors hover:bg-background/75 hover:text-foreground'

export interface DesignDockProps {
  className?: string
}

export function DesignDock({ className }: DesignDockProps): React.ReactElement {
  const [activeTool, setActiveTool] = useAtom(designActiveToolAtom)
  const [zoom, setZoom] = useAtom(zoomAtom)
  const resetZoom = useSetAtom(resetViewportAtom)
  const refresh = useSetAtom(refreshDesignCanvasAtom)
  const clear = useSetAtom(clearDesignCanvasAtom)
  const setSelection = useSetAtom(designSelectionAtom)

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center gap-1.5', className)}>
        {TOOLS.map((tool) => (
          <DockTooltip key={tool.value} label={tool.tip}>
            <button
              type="button"
              onClick={() => {
                setActiveTool(tool.value)
                if (tool.value === 'select') setSelection(null)
              }}
              className={cn(
                dockChipClass,
                activeTool === tool.value && 'border-primary/30 bg-primary/10 text-primary'
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
            className={dockChipClass}
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
            className={dockChipClass}
            aria-label="放大缩放"
          >
            <PlusCircle className="size-3.5" />
          </button>
        </DockTooltip>
        <DockTooltip label="适应画布">
          <button
            type="button"
            onClick={() => resetZoom()}
            className={dockChipClass}
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
            className={dockChipClass}
            aria-label="刷新"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </DockTooltip>
        <DockTooltip label="清空画布">
          <button type="button" onClick={() => clear()} className={dockChipClass} aria-label="清空">
            <Trash2 className="size-3.5" />
          </button>
        </DockTooltip>
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
        className="h-7 w-[3.2rem] rounded-glass-popover border border-border/45 bg-background/75 text-center text-[11px] font-medium tabular-nums text-foreground outline-none"
        aria-label="缩放比例"
      />
    )
  }

  return (
    <DockTooltip label="点击输入缩放比例">
      <button
        type="button"
        className="flex h-7 min-w-[3.2rem] items-center justify-center rounded-glass-popover border border-border/45 bg-background/50 px-2 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-background/75 hover:text-foreground"
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
