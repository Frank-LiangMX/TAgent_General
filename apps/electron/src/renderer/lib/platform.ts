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

/** Shell 外边距（AppShell p-2） */
export const SHELL_EDGE_PADDING = 8

/** 导航 Rail 固定宽度 */
export const NAV_RAIL_WIDTH = 60

/** 会话侧栏翼默认宽度 */
export const NAV_SIDEBAR_WIDTH = 240

/** 文件 / Skills 检视侧栏翼宽度 */
export const NAV_SIDEBAR_INSPECTOR_WIDTH = 280

/** macOS 导航岛 / 主区顶栏统一高度（容纳红绿灯 + 一行标题/Tab） */
export const NAV_MAC_CHROME_HEIGHT = 52

/** TabBar 内容区高度 */
export const TAB_BAR_HEIGHT = 34

/** macOS 主区 TabBar 上方留白，与导航岛 chrome 底边对齐 */
export const NAV_MAC_TABBAR_TOP_INSET = NAV_MAC_CHROME_HEIGHT - TAB_BAR_HEIGHT
