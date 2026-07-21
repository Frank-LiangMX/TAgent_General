/**
 * DesignPreviewPanel — 右侧 Design Preview 面板
 *
 * 作为 rightRail 的 Design 入口，展示 DesignCanvas 主组件。
 * 标题 chrome 由外层 RightInspectorFrame 统一提供，本组件不再自带 header。
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

import { DesignCanvas } from './DesignCanvas'

export interface DesignPreviewPanelProps {
  /** 自定义类名 */
  className?: string
}

export function DesignPreviewPanel({ className }: DesignPreviewPanelProps): React.ReactElement {
  return (
    <div className={cn('design-preview-panel flex h-full flex-col bg-transparent', className)}>
      <div className="flex-1 overflow-hidden">
        <DesignCanvas />
      </div>
    </div>
  )
}
