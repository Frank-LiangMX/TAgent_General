/**
 * RightNavIsland - 右侧文件面板浮岛
 *
 * 类似左侧 NavIsland 的浮岛样式，但用于右侧边栏。
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

  return (
    <div
      className={cn(
        'right-nav-island relative z-[60] flex items-stretch',
        isMac ? 'right-nav-island--mac' : 'right-nav-island--win'
      )}
      style={{
        width: width + 8, // 8px 为外边距
        ['--nav-island-outer-radius' as string]: `${NAV_ISLAND_OUTER_RADIUS}px`,
      }}
    >
      {/* 拖拽手柄 — 绝对定位，居中于主区域和浮岛的缝隙 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[8px] -translate-x-1/2 cursor-col-resize active:bg-primary/50 transition-colors z-10"
        onMouseDown={onDragStart}
      />

      {/* 浮岛容器 */}
      <div
        className={cn(
          'right-nav-island-glass relative flex h-full flex-col overflow-hidden flex-shrink-0',
          'nav-island-glass nav-island-glass--float',
          isMac && 'nav-island-glass--mac'
        )}
        style={{ width }}
      >
        {children}
      </div>
    </div>
  )
}