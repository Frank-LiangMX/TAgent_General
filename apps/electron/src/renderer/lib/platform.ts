import {
  NAV_ISLAND_MAC_TOP_LEFT_RADIUS,
  NAV_ISLAND_OUTER_RADIUS,
  NAV_MAC_CHROME_HEIGHT,
  NAV_RAIL_PLUGINS_WIDTH,
  NAV_RAIL_WIDTH,
  NAV_SIDEBAR_INSPECTOR_WIDTH,
  NAV_SIDEBAR_PLUGINS_WIDTH,
  NAV_SIDEBAR_WIDTH,
  SHELL_EDGE_PADDING,
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
  NAV_RAIL_PLUGINS_WIDTH,
  NAV_RAIL_WIDTH,
  NAV_SIDEBAR_INSPECTOR_WIDTH,
  NAV_SIDEBAR_PLUGINS_WIDTH,
  NAV_SIDEBAR_WIDTH,
  SHELL_EDGE_PADDING,
  TAB_BAR_HEIGHT,
}

/** macOS 主区 TabBar 上方留白，与导航岛 chrome 底边对齐 */
export const NAV_MAC_TABBAR_TOP_INSET = NAV_MAC_CHROME_HEIGHT - TAB_BAR_HEIGHT
