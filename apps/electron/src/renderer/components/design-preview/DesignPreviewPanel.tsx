/**
 * DesignPreviewPanel — 右侧 Design Preview 面板
 *
 * 作为 rightRail 的 Design 入口，展示 DesignCanvas 主组件。
 * 沉浸全屏时隐藏面板标题栏，把空间留给画布。
 */

import { useAtomValue } from 'jotai'
import { Eye } from 'lucide-react'
import * as React from 'react'

import { designImmersiveAtom } from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'

import { DesignCanvas } from './DesignCanvas'

export interface DesignPreviewPanelProps {
  /** 面板宽度 */
  width?: number
  /** 自定义类名 */
  className?: string
}

/** 面板标题栏 */
function DesignPanelHeader(): React.ReactElement {
  return (
    <div className="design-panel-header flex items-center gap-2 border-b border-border/40 bg-background/60 px-4 py-2.5 backdrop-blur">
      <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
        <Eye className="size-3.5 text-primary" />
      </div>
      <div className="flex-1">
        <h2 className="text-sm font-medium text-foreground">Design Preview</h2>
        <p className="text-[11px] text-muted-foreground">AI 生成 UI 原型的即时预览</p>
      </div>
    </div>
  )
}

export function DesignPreviewPanel({
  width,
  className,
}: DesignPreviewPanelProps): React.ReactElement {
  const immersive = useAtomValue(designImmersiveAtom)

  return (
    <div
      className={cn('design-preview-panel flex h-full flex-col bg-background', className)}
      style={width ? { width } : undefined}
    >
      {!immersive && <DesignPanelHeader />}
      <div className="flex-1 overflow-hidden">
        <DesignCanvas />
      </div>
    </div>
  )
}
