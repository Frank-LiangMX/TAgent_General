/**
 * DesignDock — 画布浮动 Dock 工具栏
 *
 * - 框选 / 抓取模式切换
 * - 缩放控制
 * - 刷新 / 清空
 * - 全屏切换
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  Hand,
  Maximize2,
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
  designFullscreenAtom,
  designSelectionAtom,
  designZoomAtom,
  refreshDesignCanvasAtom,
  setDesignZoomAtom,
  type DesignCanvasTool,
} from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'

const TOOLS: Array<{ value: DesignCanvasTool; icon: React.ReactNode; label: string }> = [
  { value: 'select', icon: <MousePointer2 className="size-4" />, label: '选择' },
  { value: 'interact', icon: <MousePointerClick className="size-4" />, label: '交互' },
  { value: 'pan', icon: <Hand className="size-4" />, label: '平移' },
]

export interface DesignDockProps {
  className?: string
}

export function DesignDock({ className }: DesignDockProps): React.ReactElement {
  const [activeTool, setActiveTool] = useAtom(designActiveToolAtom)
  const zoom = useAtomValue(designZoomAtom)
  const setZoom = useSetAtom(setDesignZoomAtom)
  const [fullscreen, setFullscreen] = useAtom(designFullscreenAtom)
  const refresh = useSetAtom(refreshDesignCanvasAtom)
  const clear = useSetAtom(clearDesignCanvasAtom)
  const setSelection = useSetAtom(designSelectionAtom)

  return (
    <div className={cn(
      'pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border/50 bg-background/90 px-1.5 py-1 shadow-lg backdrop-blur-sm',
      className
    )}>
      {TOOLS.map((tool) => (
        <button
          key={tool.value}
          type="button"
          onClick={() => {
            setActiveTool(tool.value)
            if (tool.value === 'select') setSelection(null)
          }}
          className={cn(
            'flex size-7 items-center justify-center rounded-md transition-colors',
            activeTool === tool.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}

      <span className="mx-0.5 h-4 w-px bg-border/40" />

      <button type="button" onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="缩小">
        <MinusCircle className="size-3.5" />
      </button>
      <ZoomInput zoom={zoom} setZoom={setZoom} />
      <button type="button" onClick={() => setZoom(Math.min(2, zoom + 0.25))}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="放大">
        <PlusCircle className="size-3.5" />
      </button>
      <button type="button" onClick={() => setZoom(1)}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="适应">
        <Scan className="size-3.5" />
      </button>

      <span className="mx-0.5 h-4 w-px bg-border/40" />

      <button type="button" onClick={() => refresh()}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="刷新">
        <RefreshCw className="size-3.5" />
      </button>
      <button type="button" onClick={() => clear()}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title="清空">
        <Trash2 className="size-3.5" />
      </button>

      <span className="mx-0.5 h-4 w-px bg-border/40" />

      <button type="button" onClick={() => setFullscreen(!fullscreen)}
        className={cn('flex size-7 items-center justify-center rounded-md transition-colors', fullscreen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        title={fullscreen ? '退出全屏' : '全屏画布'}>
        <Maximize2 className="size-3.5" />
      </button>
    </div>
  )
}

/** 可手输的缩放百分比 */
function ZoomInput({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = React.useCallback(() => {
    const val = parseInt(draft, 10)
    if (!isNaN(val)) {
      setZoom(Math.max(25, Math.min(200, val)) / 100)
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
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
        className="min-w-[2.5rem] text-center text-[11px] font-medium tabular-nums text-foreground bg-muted/60 rounded border border-border/40 outline-none"
        style={{ width: '2.8rem', padding: '1px 2px' }}
      />
    )
  }

  return (
    <button
      type="button"
      className="min-w-[2.5rem] text-center text-[11px] font-medium tabular-nums text-foreground hover:bg-muted/40 rounded"
      onClick={() => { setDraft(String(Math.round(zoom * 100))); setEditing(true) }}
      title="点击输入缩放比例"
    >
      {Math.round(zoom * 100)}%
    </button>
  )
}