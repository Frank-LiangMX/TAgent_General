/**
 * 跨端 UI 布局常量（主进程窗口 chrome 与渲染进程须保持一致）
 */

/** AppShell 外边距（Tailwind p-2） */
export const SHELL_EDGE_PADDING = 8

/** 导航 Rail 宽度 */
export const NAV_RAIL_WIDTH = 54

/** Agent 右侧面板 Rail 宽度（展开/折叠一致） */
export const RIGHT_PANEL_RAIL_WIDTH = 38

/** 导航浮岛外轮廓圆角（Soft UI pill；与 content 底板左缘对齐） */
export const NAV_ISLAND_OUTER_RADIUS = 24

/**
 * macOS 浮岛左上角圆角（略小于外圆角，灯叠在 pill 顶缘时更自然）
 */
export const NAV_ISLAND_MAC_TOP_LEFT_RADIUS = 16

/**
 * macOS 红绿灯垂直参考带高度（不用于整窗下沉）
 * 灯叠在 rail pill 顶缘附近，与 shell p-2 对齐
 */
export const NAV_MAC_CHROME_HEIGHT = 28

/**
 * @deprecated 历史别名；勿再做整窗顶带高度
 */
export const SHELL_TOP_SAFE_HEIGHT = 0

/** TabBar 内容区高度 */
export const TAB_BAR_HEIGHT = 28

/** 导航岛 body 内首行顶距（Tailwind pt-2） */
export const NAV_ISLAND_BODY_PADDING_TOP = 8

/** 导航岛首行 / 工具行标准高度（size-10） */
export const NAV_ISLAND_ROW_HEIGHT = 36

/** Rail 图标列与下一行之间的间距（Tailwind gap-1.5） */
export const NAV_ISLAND_STACK_GAP = 6

/** 会话侧栏翼默认宽度 */
export const NAV_SIDEBAR_WIDTH = 240

/** 文件 / Skills 侧栏宽度（与会话侧栏统一） */
export const NAV_SIDEBAR_INSPECTOR_WIDTH = NAV_SIDEBAR_WIDTH

/**
 * macOS 红绿灯相对窗口左缘的水平 inset
 * = shell 边距 + rail 内边距，灯叠在独立 rail pill 顶左
 */
export const NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET = 8

/** macOS 系统红绿灯控件近似高度（用于垂直居中） */
export const NAV_MAC_TRAFFIC_LIGHT_HEIGHT = 12

/** macOS 红绿灯相对 pill 顶缘的垂直微调 */
export const NAV_MAC_TRAFFIC_LIGHT_Y_OFFSET = 2

/**
 * Electron trafficLightPosition（相对窗口内容区左上角）
 * 叠在 rail 浮岛顶缘（shell p-2 之内），不另开空顶带
 */
export function getMacTrafficLightPosition(): { x: number; y: number } {
  const x = SHELL_EDGE_PADDING + NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET
  const y =
    SHELL_EDGE_PADDING +
    Math.max(4, Math.round((NAV_MAC_CHROME_HEIGHT - NAV_MAC_TRAFFIC_LIGHT_HEIGHT) / 2)) +
    NAV_MAC_TRAFFIC_LIGHT_Y_OFFSET
  return { x, y }
}
