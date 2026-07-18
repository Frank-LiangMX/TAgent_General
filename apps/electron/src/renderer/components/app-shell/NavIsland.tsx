/**
 * NavIsland — 左侧导航组合层
 *
 * 只保留一个有明确职责的导航表面：
 * - rail：顶层功能导航列
 * - sidebar：承载会话与功能列表的内容列
 *
 * 两列共享外框，只用结构分隔线建立层级；主区域之间不使用负 margin 或 z-index 叠加。
 */

import * as React from 'react'

import { InertRegion } from './InertRegion'
import type { PanelPresence } from './shell-layout'

import {
  NAV_MAC_CHROME_HEIGHT,
  NAV_RAIL_WIDTH,
  NAV_SIDEBAR_WIDTH,
  detectIsMac,
} from '@/lib/platform'
import { cn } from '@/lib/utils'

export const NAV_SIDEBAR_DEFAULT_WIDTH = NAV_SIDEBAR_WIDTH
export const NAV_CLUSTER_GAP = 8

export function getNavClusterWidth(
  showSidebar: boolean,
  railWidth = NAV_RAIL_WIDTH,
  sidebarWidth = NAV_SIDEBAR_DEFAULT_WIDTH,
  clusterGap = NAV_CLUSTER_GAP
): number {
  return showSidebar ? railWidth + clusterGap + sidebarWidth : railWidth
}

export interface NavIslandProps {
  sidebarPresence: PanelPresence
  sidebarWidth?: number
  railWidth?: number
  children: React.ReactNode
}

export function NavIsland({
  sidebarPresence,
  sidebarWidth = NAV_SIDEBAR_DEFAULT_WIDTH,
  railWidth = NAV_RAIL_WIDTH,
  children,
}: NavIslandProps): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])
  const childList = React.Children.toArray(children)
  const rail = childList[0]
  const sidebar = childList[1]
  const sidebarOpen = sidebarPresence === 'open'

  return (
    <aside
      className={cn('app-nav-stack', sidebarOpen && sidebar && 'app-nav-stack--expanded')}
      aria-label="主导航"
      data-sidebar-presence={sidebarPresence}
      style={{
        ['--app-nav-rail-width' as string]: `${railWidth}px`,
        ['--app-nav-sidebar-width' as string]: `${sidebarWidth}px`,
        ['--app-nav-cluster-gap' as string]: `${NAV_CLUSTER_GAP}px`,
      }}
    >
      <div
        className={cn('app-nav-rail', isMac && 'app-nav-rail--mac')}
        style={{ width: railWidth }}
      >
        {isMac ? (
          <div
            className="app-nav-mac-chrome titlebar-drag-region"
            style={{ height: NAV_MAC_CHROME_HEIGHT }}
            aria-hidden
          />
        ) : null}
        <div className="app-nav-rail-content">{rail}</div>
      </div>

      {sidebar ? (
        <InertRegion
          id="app-navigation-sidebar"
          className="app-nav-sidebar"
          data-surface-role="panel-elevated"
          style={{ width: sidebarWidth }}
          inactive={!sidebarOpen}
        >
          <div className="app-nav-sidebar-content">{sidebar}</div>
        </InertRegion>
      ) : null}
    </aside>
  )
}
