import {
  NAV_ISLAND_MAC_TOP_LEFT_RADIUS,
  NAV_ISLAND_OUTER_RADIUS,
  NAV_MAC_CHROME_HEIGHT,
  NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET,
  NAV_RAIL_WIDTH,
  NAV_SIDEBAR_INSPECTOR_WIDTH,
  NAV_SIDEBAR_WIDTH,
  RIGHT_PANEL_RAIL_WIDTH,
  SHELL_EDGE_PADDING,
  SHELL_TOP_SAFE_HEIGHT,
  TAB_BAR_HEIGHT,
} from '@tagent/shared'

export function detectIsWindows(): boolean {
  const platform =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
  if (typeof platform === 'string' && platform.toLowerCase().includes('win')) {
    return true
  }
  return typeof navigator !== 'undefined' && /win/i.test(navigator.platform || '')
}

export function detectIsMac(): boolean {
  const platform =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
  if (typeof platform === 'string' && platform.toLowerCase().includes('mac')) {
    return true
  }
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '')
}

export function detectIsLinux(): boolean {
  const platform =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
  if (typeof platform === 'string' && platform.toLowerCase().includes('linux')) {
    return true
  }
  return typeof navigator !== 'undefined' && /linux/i.test(navigator.platform || '')
}

/** 获取当前平台类型 */
export function getPlatform(): 'mac' | 'windows' | 'linux' {
  if (detectIsMac()) return 'mac'
  if (detectIsWindows()) return 'windows'
  if (detectIsLinux()) return 'linux'
  return 'windows' // 默认 fallback
}

export {
  NAV_ISLAND_MAC_TOP_LEFT_RADIUS,
  NAV_ISLAND_OUTER_RADIUS,
  NAV_MAC_CHROME_HEIGHT,
  NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET,
  NAV_RAIL_WIDTH,
  NAV_SIDEBAR_INSPECTOR_WIDTH,
  NAV_SIDEBAR_WIDTH,
  RIGHT_PANEL_RAIL_WIDTH,
  SHELL_EDGE_PADDING,
  SHELL_TOP_SAFE_HEIGHT,
  TAB_BAR_HEIGHT,
}

/** 主区 TabBar 上方留白（顶栏安全带与 TabBar 高差；两端共用） */
export const NAV_MAC_TABBAR_TOP_INSET = Math.max(0, SHELL_TOP_SAFE_HEIGHT - TAB_BAR_HEIGHT)
