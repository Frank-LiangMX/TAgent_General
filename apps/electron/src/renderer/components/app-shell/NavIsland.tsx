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
/** rail 与 sidebar 间距：略小于 gutter，视觉上更贴侧栏 */
export const NAV_CLUSTER_GAP = 10
/** 左轨相对窗口左缘外距（与 app-shell.css --spatial-rail-edge-left 一致） */
export const NAV_RAIL_EDGE_LEFT = 5

export function getNavClusterWidth(
  showSidebar: boolean,
  railWidth = NAV_RAIL_WIDTH,
  sidebarWidth = NAV_SIDEBAR_DEFAULT_WIDTH,
  clusterGap = NAV_CLUSTER_GAP,
  railEdgeLeft = NAV_RAIL_EDGE_LEFT
): number {
  const core = showSidebar ? railWidth + clusterGap + sidebarWidth : railWidth
  return core + railEdgeLeft
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
        style={
          {
            width: railWidth,
            ['--nav-mac-chrome-height' as string]: `${NAV_MAC_CHROME_HEIGHT}px`,
          } as React.CSSProperties
        }
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
          style={{ width: sidebarOpen ? sidebarWidth : 0 }}
          inactive={!sidebarOpen}
        >
          <div className="app-nav-sidebar-content">{sidebar}</div>
        </InertRegion>
      ) : null}
    </aside>
  )
}
