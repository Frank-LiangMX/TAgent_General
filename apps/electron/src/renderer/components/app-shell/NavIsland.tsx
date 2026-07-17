/**
 * NavIsland — 左侧导航浮岛
 *
 * Soft UI 拆分：
 * - NavRailIsland：独立 icon rail pill（始终存在）
 * - NavSidebarIsland：会话/功能侧栏独立卡片（按需）
 *
 * 与主区同高贴边（AppShell p-2），不另开整窗空顶带；
 * mac 红绿灯 / Win 窗控叠在浮岛顶缘，观感与原先顶栏融合一致。
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
        isMac && 'nav-island-glass--mac nav-rail-island--mac'
      )}
      style={{
        width,
        ['--nav-rail-width' as string]: `${width}px`,
      }}
    >
      {/*
        mac：顶缘留出红绿灯叠层安全高（不另开整窗空带）
        灯视觉上仍「融」在 pill 顶，图标从安全高下方开始
      */}
      {isMac ? (
        <div
          className="nav-rail-mac-lights-slot shrink-0 titlebar-drag-region"
          style={{ height: NAV_MAC_CHROME_HEIGHT }}
          aria-hidden
        />
      ) : null}
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
  return (
    <div
      className={cn(
        'nav-island-glass nav-island-glass--float nav-sidebar-island relative flex h-full flex-col overflow-hidden flex-shrink-0',
        'animate-in fade-in slide-in-from-left-1 duration-300'
      )}
      style={{ width }}
    >
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
