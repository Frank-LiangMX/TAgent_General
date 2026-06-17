/**
 * NavIsland - Rail + Sidebar 统一导航浮岛
 *
 * 单块圆角矩形玻璃：Rail 为左翼，Sidebar 从 Rail 右侧同壳展开。
 * macOS：顶栏 chrome 行左侧为红绿灯安全区（拖拽区，无标题文案）。
 */

import * as React from 'react'

import {
  NAV_MAC_CHROME_HEIGHT,
  NAV_RAIL_WIDTH,
  NAV_SIDEBAR_WIDTH,
  detectIsMac,
} from '@/lib/platform'
import { cn } from '@/lib/utils'

export const NAV_SIDEBAR_DEFAULT_WIDTH = NAV_SIDEBAR_WIDTH

interface NavIslandProps {
  /** 是否展开 Sidebar(收起时仅显示 Rail) */
  showSidebar: boolean
  sidebarWidth?: number
  children: React.ReactNode
}

function NavIslandMacChrome(): React.ReactElement {
  return (
    <div
      className="nav-island-chrome flex shrink-0 titlebar-drag-region"
      style={{ height: NAV_MAC_CHROME_HEIGHT }}
    >
      {/* 系统红绿灯占位：仅拖拽，不放可点击控件 */}
      <div className="nav-island-chrome-lights shrink-0" aria-hidden />
      <div className="nav-island-chrome-sidebar min-w-0 flex-1" aria-hidden />
    </div>
  )
}

export function NavIsland({
  showSidebar,
  sidebarWidth = NAV_SIDEBAR_DEFAULT_WIDTH,
  children,
}: NavIslandProps): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])
  const wingOpen = showSidebar
  const islandWidth = wingOpen ? NAV_RAIL_WIDTH + sidebarWidth : NAV_RAIL_WIDTH

  return (
    <div
      className={cn(
        'nav-island-glass nav-island-glass--float relative flex h-full flex-col overflow-hidden flex-shrink-0',
        'transition-[width] duration-300 ease-in-out',
        wingOpen && 'nav-island-glass--expanded',
        isMac && 'nav-island-glass--mac'
      )}
      style={{
        width: islandWidth,
        ['--nav-rail-width' as string]: `${NAV_RAIL_WIDTH}px`,
      }}
    >
      {isMac ? <NavIslandMacChrome /> : null}

      <div className="nav-island-body relative flex min-h-0 flex-1 flex-row">{children}</div>
    </div>
  )
}
