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

/** 导航 Rail 固定宽度 */
export const NAV_RAIL_WIDTH = 60

/** 会话侧栏翼默认宽度 */
export const NAV_SIDEBAR_WIDTH = 240

/** 文件 / Skills 检视侧栏翼宽度 */
export const NAV_SIDEBAR_INSPECTOR_WIDTH = 280

/** macOS 导航岛 chrome 高度（仅左侧栏顶部,用于避让红绿灯按钮） */
export const NAV_MAC_CHROME_HEIGHT = 38

/** TabBar 内容区高度 */
export const TAB_BAR_HEIGHT = 34
