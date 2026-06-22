/**
 * RightNavIsland - 右侧文件面板浮岛
 *
 * 悬浮在主区域之上的右侧浮岛，与左侧 NavIsland 样式一致。
 * 支持拖拽调整宽度，手柄放在浮岛左边缘。
 */

import * as React from 'react'

import { detectIsMac, NAV_ISLAND_OUTER_RADIUS } from '@/lib/platform'
import { cn } from '@/lib/utils'

interface RightNavIslandProps {
  /** 是否展开面板 */
  isOpen: boolean
  /** 面板宽度 */
  width: number
  /** 子组件 */
  children: React.ReactNode
  /** 拖拽调整宽度的回调 */
  onDragStart: (e: React.MouseEvent) => void
}

export function RightNavIsland({
  isOpen,
  width,
  children,
  onDragStart,
}: RightNavIslandProps): React.ReactElement | null {
  const isMac = React.useMemo(() => detectIsMac(), [])

  if (!isOpen) return null

  // 与左侧 NavIsland 外层结构一致：p-2（但左侧是 pr-0，右侧是 pl-0）
  // self-stretch 让高度拉伸到父容器（shell-glass）的高度
  return (
    <div className="p-2 pl-0 relative z-[70] flex shrink-0 items-stretch self-stretch">
      {/* 拖拽手柄 — 绝对定位，居中于主区域和浮岛的缝隙 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[8px] -translate-x-1/2 cursor-col-resize active:bg-primary/50 transition-colors z-10"
        onMouseDown={onDragStart}
      />

      {/* 浮岛容器 */}
      <div
        className={cn(
          'right-nav-island-glass nav-island-glass nav-island-glass--float',
          'relative flex h-full flex-col overflow-hidden flex-shrink-0',
          isMac && 'right-nav-island-glass--mac'
        )}
        style={{
          width,
          ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
        }}
      >
        {children}
      </div>
    </div>
  )
}