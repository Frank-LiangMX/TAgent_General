/**
 * 跨端 UI 布局常量（主进程窗口 chrome 与渲染进程须保持一致）
 */

/** AppShell 外边距（Tailwind p-2） */
export const SHELL_EDGE_PADDING = 8

/** 导航 Rail 宽度 */
export const NAV_RAIL_WIDTH = 60

/** Agent 右侧面板 Rail 宽度（展开/折叠一致） */
export const RIGHT_PANEL_RAIL_WIDTH = 38

/** 导航浮岛外轮廓圆角（Soft UI pill；与 content 底板左缘对齐） */
export const NAV_ISLAND_OUTER_RADIUS = 24

/** macOS 导航浮岛左上角圆角（历史：灯嵌 pill 时削角；灯在外后可与外圆角一致） */
export const NAV_ISLAND_MAC_TOP_LEFT_RADIUS = NAV_ISLAND_OUTER_RADIUS

/**
 * macOS 顶栏安全带高度（红绿灯 + 拖拽）
 *
 * Soft UI：灯落在 shell 底色上，不进 rail pill；
 * 整窗内容（rail / 侧栏 / 主区）从该带下方开始。
 */
export const NAV_MAC_CHROME_HEIGHT = 28

/** TabBar 内容区高度 */
export const TAB_BAR_HEIGHT = 28

/** 导航岛 body 内首行顶距（Tailwind pt-2） */
export const NAV_ISLAND_BODY_PADDING_TOP = 8

/** 导航岛首行 / 工具行标准高度（size-10） */
export const NAV_ISLAND_ROW_HEIGHT = 40

/** Rail 图标列与下一行之间的间距（Tailwind gap-1.5） */
export const NAV_ISLAND_STACK_GAP = 6

/** 会话侧栏翼默认宽度 */
export const NAV_SIDEBAR_WIDTH = 240

/** 文件 / Skills 侧栏宽度（与会话侧栏统一） */
export const NAV_SIDEBAR_INSPECTOR_WIDTH = NAV_SIDEBAR_WIDTH

/**
 * macOS 红绿灯相对窗口左缘的水平 inset
 * Soft UI：灯在 shell 上、不进 pill，略贴左即可
 */
export const NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET = 12

/** macOS 系统红绿灯控件近似高度（用于垂直居中） */
export const NAV_MAC_TRAFFIC_LIGHT_HEIGHT = 12

/** macOS 红绿灯相对 chrome 带垂直微调（像素） */
export const NAV_MAC_TRAFFIC_LIGHT_Y_OFFSET = 0

/**
 * Electron trafficLightPosition（相对窗口内容区左上角）
 * 落在顶栏安全带内，不压独立 rail pill
 */
export function getMacTrafficLightPosition(): { x: number; y: number } {
  const x = NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET
  const y = Math.max(
    6,
    Math.round((NAV_MAC_CHROME_HEIGHT - NAV_MAC_TRAFFIC_LIGHT_HEIGHT) / 2) +
      NAV_MAC_TRAFFIC_LIGHT_Y_OFFSET
  )
  return { x, y }
}
