/**
 * ControlBar — Design Preview 工具栏
 *
 * 提供：
 * - 设备切换（Mobile / Tablet / Desktop）
 * - 缩放控制（缩小、放大、适应、重置）
 * - 刷新按钮
 * - 清空按钮
 *
 * 设计来源：docs/plans/2026-07-13-design-preview-design.md §5.1
 */

import { useAtom, useSetAtom } from 'jotai'
import { Maximize2, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react'
import * as React from 'react'

import {
  clearDesignCanvasAtom,
  designDeviceAtom,
  designZoomAtom,
  refreshDesignCanvasAtom,
  setDesignDeviceAtom,
  setDesignZoomAtom,
} from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@tagent/ui'

/** 缩放档位 */
const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

export interface ControlBarProps {
  /** 是否有内容 */
  hasContent: boolean
  /** 自定义类名 */
  className?: string
}

function BarTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactElement
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ControlBar({ hasContent, className }: ControlBarProps): React.ReactElement {
  const [zoom] = useAtom(designZoomAtom)
  const setZoom = useSetAtom(setDesignZoomAtom)
  const refresh = useSetAtom(refreshDesignCanvasAtom)
  const clear = useSetAtom(clearDesignCanvasAtom)

  const handleZoomOut = React.useCallback(() => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= zoom)
    if (currentIndex > 0) {
      setZoom(ZOOM_LEVELS[currentIndex - 1]!)
    }
  }, [zoom, setZoom])

  const handleZoomIn = React.useCallback(() => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= zoom)
    if (currentIndex < ZOOM_LEVELS.length - 1 && currentIndex >= 0) {
      setZoom(ZOOM_LEVELS[currentIndex + 1]!)
    } else if (currentIndex === -1) {
      const next = ZOOM_LEVELS.find((z) => z > zoom)
      if (next) setZoom(next)
    }
  }, [zoom, setZoom])

  const handleZoomReset = React.useCallback(() => {
    setZoom(1.0)
  }, [setZoom])

  const handleFit = React.useCallback(() => {
    setZoom(1.0)
  }, [setZoom])

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/40 bg-background/60 px-2.5 py-1.5 backdrop-blur',
          className
        )}
      >
        <div className="flex items-center gap-0.5">
          <BarTooltip label="缩小">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= ZOOM_LEVELS[0]!}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label="缩小"
            >
              <Minus className="size-3" />
            </button>
          </BarTooltip>
          <BarTooltip label="重置缩放">
            <button
              type="button"
              onClick={handleZoomReset}
              className="min-w-[2.5rem] rounded px-1 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`缩放 ${Math.round(zoom * 100)}%`}
            >
              {Math.round(zoom * 100)}%
            </button>
          </BarTooltip>
          <BarTooltip label="放大">
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label="放大"
            >
              <Plus className="size-3" />
            </button>
          </BarTooltip>
          <BarTooltip label="适应屏幕">
            <button
              type="button"
              onClick={handleFit}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="适应屏幕"
            >
              <Maximize2 className="size-3" />
            </button>
          </BarTooltip>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <BarTooltip label="刷新画布">
            <button
              type="button"
              onClick={() => refresh()}
              disabled={!hasContent}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label="刷新画布"
            >
              <RefreshCw className="size-3" />
            </button>
          </BarTooltip>
          <BarTooltip label="清空画布">
            <button
              type="button"
              onClick={() => clear()}
              disabled={!hasContent}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label="清空画布"
            >
              <Trash2 className="size-3" />
            </button>
          </BarTooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}

/** 简单版工具栏（用于未来嵌入更紧凑场景） */
export function ControlBarCompact({ hasContent, className }: ControlBarProps): React.ReactElement {
  const [device] = useAtom(designDeviceAtom)
  const setDevice = useSetAtom(setDesignDeviceAtom)
  const refresh = useSetAtom(refreshDesignCanvasAtom)

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center gap-1', className)}>
        <button
          type="button"
          onClick={() => setDevice('mobile')}
          className={cn(
            'rounded px-2 py-1 text-xs',
            device === 'mobile' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
          )}
        >
          M
        </button>
        <button
          type="button"
          onClick={() => setDevice('tablet')}
          className={cn(
            'rounded px-2 py-1 text-xs',
            device === 'tablet' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
          )}
        >
          T
        </button>
        <button
          type="button"
          onClick={() => setDevice('desktop')}
          className={cn(
            'rounded px-2 py-1 text-xs',
            device === 'desktop' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
          )}
        >
          D
        </button>
        <BarTooltip label="刷新">
          <button
            type="button"
            onClick={() => hasContent && refresh()}
            disabled={!hasContent}
            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label="刷新"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </BarTooltip>
      </div>
    </TooltipProvider>
  )
}
