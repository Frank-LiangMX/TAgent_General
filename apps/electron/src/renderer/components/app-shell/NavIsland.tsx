/**
 * NavIsland — 左侧导航浮岛
 *
 * Soft UI 拆分：
 * - NavRailIsland：独立 icon rail pill（始终存在）
 * - NavSidebarIsland：会话/功能侧栏独立卡片（按需）
 * 二者间距由 AppShell 的 gap 控制，不再同壳展开。
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

/** Rail 与 Sidebar 浮岛间距（与 shell edge 同量级） */
export const NAV_RAIL_SIDEBAR_GAP = 8

function NavIslandMacChrome({
  variant,
}: {
  /** rail：红绿灯安全区；sidebar：等高占位，与 rail 顶对齐 */
  variant: 'rail' | 'sidebar'
}): React.ReactElement {
  return (
    <div
      className={cn(
        'nav-island-chrome flex shrink-0',
        variant === 'rail' ? 'titlebar-drag-region' : ''
      )}
      style={{ height: NAV_MAC_CHROME_HEIGHT }}
    >
      {variant === 'rail' ? (
        <div className="nav-island-chrome-lights shrink-0 w-full" aria-hidden />
      ) : (
        <div className="min-w-0 flex-1 titlebar-drag-region" aria-hidden />
      )}
    </div>
  )
}

export interface NavRailIslandProps {
  /** Rail 列宽 */
  width?: number
  children: React.ReactNode
}

/** 独立 icon rail 浮岛（参考 Soft UI 左侧 pill） */
export function NavRailIsland({
  width = NAV_RAIL_WIDTH,
  children,
}: NavRailIslandProps): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])

  return (
    <div
      className={cn(
        'nav-island-glass nav-island-glass--float nav-rail-island relative flex h-full flex-col overflow-hidden flex-shrink-0',
        isMac && 'nav-island-glass--mac'
      )}
      style={{
        width,
        ['--nav-rail-width' as string]: `${width}px`,
      }}
    >
      {isMac ? <NavIslandMacChrome variant="rail" /> : null}
      <div className="nav-island-body relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export interface NavSidebarIslandProps {
  width?: number
  children: React.ReactNode
}

/** 独立侧栏浮岛（会话列表 / 草稿 / 看板列表等） */
export function NavSidebarIsland({
  width = NAV_SIDEBAR_DEFAULT_WIDTH,
  children,
}: NavSidebarIslandProps): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])

  return (
    <div
      className={cn(
        'nav-island-glass nav-island-glass--float nav-sidebar-island relative flex h-full flex-col overflow-hidden flex-shrink-0',
        'animate-in fade-in slide-in-from-left-1 duration-300',
        isMac && 'nav-island-glass--mac'
      )}
      style={{ width }}
    >
      {isMac ? <NavIslandMacChrome variant="sidebar" /> : null}
      <div className="nav-island-body relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

/**
 * @deprecated 保留类型兼容；请用 NavRailIsland + NavSidebarIsland
 */
export interface NavIslandProps {
  showSidebar: boolean
  sidebarWidth?: number
  railWidth?: number
  children: React.ReactNode
}

/**
 * 兼容旧用法：把 children 按「第一个 = rail，其余 = sidebar」拆分渲染为双浮岛。
 * 新代码请直接使用 NavRailIsland / NavSidebarIsland。
 */
export function NavIsland({
  showSidebar,
  sidebarWidth = NAV_SIDEBAR_DEFAULT_WIDTH,
  railWidth = NAV_RAIL_WIDTH,
  children,
}: NavIslandProps): React.ReactElement {
  const childList = React.Children.toArray(children)
  const railChild = childList[0]
  const sidebarChild = childList[1]

  return (
    <div className="flex h-full items-stretch gap-2">
      <NavRailIsland width={railWidth}>{railChild}</NavRailIsland>
      {showSidebar && sidebarChild ? (
        <NavSidebarIsland width={sidebarWidth}>{sidebarChild}</NavSidebarIsland>
      ) : null}
    </div>
  )
}
