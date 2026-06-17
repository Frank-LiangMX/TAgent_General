/**
 * 跨端 UI 布局常量（主进程窗口 chrome 与渲染进程须保持一致）
 */

/** AppShell 外边距（Tailwind p-2） */
export const SHELL_EDGE_PADDING = 8

/** 导航 Rail 宽度 */
export const NAV_RAIL_WIDTH = 60

/** 导航浮岛外轮廓圆角（与 content 底板左缘对齐） */
export const NAV_ISLAND_OUTER_RADIUS = 20

/** macOS 导航浮岛左上角圆角（避让红绿灯） */
export const NAV_ISLAND_MAC_TOP_LEFT_RADIUS = 14

/** macOS 导航岛顶栏 chrome 行高度（避让红绿灯；与底部分隔线间距） */
export const NAV_MAC_CHROME_HEIGHT = 32

/** TabBar 内容区高度 */
export const TAB_BAR_HEIGHT = 34

/** 导航岛 body 内首行顶距（Tailwind pt-2） */
export const NAV_ISLAND_BODY_PADDING_TOP = 8

/** 导航岛首行 / 工具行标准高度（size-10） */
export const NAV_ISLAND_ROW_HEIGHT = 40

/** Rail 图标列与下一行之间的间距（Tailwind gap-1.5） */
export const NAV_ISLAND_STACK_GAP = 6

/** 会话侧栏翼默认宽度 */
export const NAV_SIDEBAR_WIDTH = 240

/** 文件 / Skills 侧栏宽度（与会话侧栏统一，保留常量供旧引用） */
export const NAV_SIDEBAR_INSPECTOR_WIDTH = NAV_SIDEBAR_WIDTH

/**
 * macOS 红绿灯在 Rail 内的水平内边距（相对导航岛左缘，非窗口左缘）
 * 需避开 nav-island 20px 圆角，且整组按钮(~52px)须落在 60px Rail 内
 */
export const NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET = 8

/** macOS 系统红绿灯控件近似高度（用于垂直居中） */
export const NAV_MAC_TRAFFIC_LIGHT_HEIGHT = 12

/** macOS 红绿灯相对 chrome 行垂直居中的额外下移（像素） */
export const NAV_MAC_TRAFFIC_LIGHT_Y_OFFSET = 8

/**
 * Electron trafficLightPosition（相对窗口内容区左上角）
 * 窗口左缘 + shell 边距 + rail 内边距
 */
export function getMacTrafficLightPosition(): { x: number; y: number } {
  const x = SHELL_EDGE_PADDING + NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET
  const y =
    Math.max(6, Math.round((NAV_MAC_CHROME_HEIGHT - NAV_MAC_TRAFFIC_LIGHT_HEIGHT) / 2)) +
    NAV_MAC_TRAFFIC_LIGHT_Y_OFFSET
  return { x, y }
}
