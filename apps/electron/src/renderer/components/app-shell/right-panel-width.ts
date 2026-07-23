/**
 * 右栏（上下文检查器）宽度约束。
 *
 * 右栏可调宽是为将来替代主区 preview 分屏做准备；本次不删除 MainArea 内分屏。
 * 最大宽度保证主会话区至少保留完整阅读宽度（--spatial-conversation-max）。
 */

/** 右栏最小宽度（px） */
export const MIN_RIGHT_PANEL_WIDTH = 300

/**
 * 主会话完整阅读宽度（px），与 app-shell.css `--spatial-conversation-max` 对齐。
 */
export const SPATIAL_CONVERSATION_MAX = 680

/**
 * 主会话区最小保留宽度 = 阅读宽 + 左右内边距余量（48px）。
 * 右栏 max ≈ viewportWidth - MIN_MAIN_CHAT_RESERVE。
 */
export const MIN_MAIN_CHAT_RESERVE = SPATIAL_CONVERSATION_MAX + 48 // 728

/** shell 右缘 gutter，与 app-shell.css `--spatial-gutter` 对齐 */
export const SPATIAL_GUTTER = 16

/** 左轨外距，与 app-shell.css `--spatial-rail-edge-left` 对齐 */
export const SPATIAL_RAIL_EDGE_LEFT = 5

/**
 * @deprecated 旧版绝对上限（1100px），已改为按会话阅读宽 reserve；保留导出以免外部引用报错。
 */
export const MAX_RIGHT_PANEL_WIDTH_CAP = 1100

/**
 * @deprecated 旧版视口 72% 比例上限，已由 MIN_MAIN_CHAT_RESERVE 取代。
 */
export const MAX_RIGHT_PANEL_VIEWPORT_RATIO = 0.72

/** 双击吸附：工具窄栏档位（px） */
export const RIGHT_PANEL_NARROW_SNAP = 340

/**
 * @deprecated 宽档吸附已改为「会话最小完整宽」对应的右栏最大宽，见 getRightPanelWideSnap。
 */
export const RIGHT_PANEL_WIDE_SNAP_RATIO = 0.55

/**
 * 右栏占比超过此值时自动收起左 sidebar，给预览/控件腾地方。
 * 与 RESTORE 之间留回差，避免拖拽时来回抖。
 */
export const RIGHT_PANEL_AUTO_COLLAPSE_LEFT_RATIO = 0.3

/** 右栏占比回落到此值以下时，恢复由我们自动收起的左 sidebar */
export const RIGHT_PANEL_AUTO_RESTORE_LEFT_RATIO = 0.28

/**
 * 右栏 dock 占位超过此占比时，再收起左 FunctionalRail + 主区会话 Tab 栏。
 * 与 SHOW 之间留回差，避免拖拽时来回抖。
 */
export const RIGHT_PANEL_AUTO_HIDE_CHROME_RATIO = 0.5

/** 右栏占比回落到此值以下时，恢复由我们自动收起的 shell chrome（rail + tabs） */
export const RIGHT_PANEL_AUTO_SHOW_CHROME_RATIO = 0.45

/** 默认宽度（新用户 / 无 localStorage 时） */
export const DEFAULT_RIGHT_PANEL_WIDTH = 380

/** 右栏相对视口占比 */
export function getRightPanelViewportRatio(width: number, viewportWidth: number): number {
  return Math.max(0, width) / Math.max(1, viewportWidth)
}

/** 是否应自动收起左栏（超过 30%） */
export function shouldAutoCollapseLeftSidebar(width: number, viewportWidth: number): boolean {
  return getRightPanelViewportRatio(width, viewportWidth) > RIGHT_PANEL_AUTO_COLLAPSE_LEFT_RATIO
}

/** 是否应恢复左栏（低于 28%） */
export function shouldAutoRestoreLeftSidebar(width: number, viewportWidth: number): boolean {
  return getRightPanelViewportRatio(width, viewportWidth) < RIGHT_PANEL_AUTO_RESTORE_LEFT_RATIO
}

/** 是否应收起 shell chrome（rail + 会话 tabs，超过 50%） */
export function shouldAutoHideShellChrome(width: number, viewportWidth: number): boolean {
  return getRightPanelViewportRatio(width, viewportWidth) > RIGHT_PANEL_AUTO_HIDE_CHROME_RATIO
}

/** 是否应恢复 shell chrome（低于 45%，带回差） */
export function shouldAutoShowShellChrome(width: number, viewportWidth: number): boolean {
  return getRightPanelViewportRatio(width, viewportWidth) < RIGHT_PANEL_AUTO_SHOW_CHROME_RATIO
}

/**
 * 分界线上「隐藏会话 / 右栏全宽」按钮是否显示。
 * 仅右栏 >50% 时出现（窄栏时显眼且丑）；已独占则始终显示以便退出。
 */
export function shouldShowInspectorExclusiveControl(
  width: number,
  viewportWidth: number,
  exclusiveActive = false
): boolean {
  if (exclusiveActive) return true
  return shouldAutoHideShellChrome(width, viewportWidth)
}

/** 平分分屏目标占比（右栏 = 视口一半） */
export const RIGHT_PANEL_HALF_SPLIT_RATIO = 0.5

/** 进入 50% 吸力区的半宽（px） */
export const RIGHT_PANEL_HALF_SNAP_ENTER_PX = 28

/** 离开吸力区的半宽（略大，避免抖） */
export const RIGHT_PANEL_HALF_SNAP_EXIT_PX = 42

/** 平分目标宽度（再经 clamp，小屏可能略小于真 50%） */
export function getHalfSplitRightPanelWidth(viewportWidth: number): number {
  return clampRightPanelWidth(viewportWidth * RIGHT_PANEL_HALF_SPLIT_RATIO, viewportWidth)
}

/**
 * 拖宽时对 50% 平分点施加吸力。
 * `currentlySnapped` 用更大离开阈值，吸住后不易抖出。
 */
export function applyHalfSplitMagnet(
  width: number,
  viewportWidth: number,
  currentlySnapped: boolean
): { width: number; snapped: boolean } {
  const clamped = clampRightPanelWidth(width, viewportWidth)
  const half = getHalfSplitRightPanelWidth(viewportWidth)
  const threshold = currentlySnapped
    ? RIGHT_PANEL_HALF_SNAP_EXIT_PX
    : RIGHT_PANEL_HALF_SNAP_ENTER_PX
  if (Math.abs(clamped - half) <= threshold) {
    return { width: half, snapped: true }
  }
  return { width: clamped, snapped: false }
}

/** 给定视口宽度，计算右栏允许的最大像素宽度 */
export function getMaxRightPanelWidth(viewportWidth: number): number {
  const safeViewport = Math.max(1, viewportWidth)
  const maxFromReserve = safeViewport - MIN_MAIN_CHAT_RESERVE
  return Math.max(MIN_RIGHT_PANEL_WIDTH, Math.floor(maxFromReserve))
}

/** 将宽度钳制在 [min, max(viewport)] 区间内 */
export function clampRightPanelWidth(width: number, viewportWidth: number): number {
  const max = getMaxRightPanelWidth(viewportWidth)
  return Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(max, Math.round(width)))
}

/**
 * 独占模式下右栏可用宽度：视口减去左导航占位与右缘 gutter。
 * @param leftChromeWidth 左导航集群宽度（rail + sidebar，不含 rail 外距）
 */
export function getInspectorExclusiveWidth(viewportWidth: number, leftChromeWidth: number): number {
  const safeViewport = Math.max(1, viewportWidth)
  const leftReserve = Math.max(0, leftChromeWidth) + SPATIAL_RAIL_EDGE_LEFT + SPATIAL_GUTTER
  return Math.max(MIN_RIGHT_PANEL_WIDTH, Math.floor(safeViewport - leftReserve))
}

/** 预览宽栏吸附目标：会话最小完整宽对应的右栏最大宽 */
export function getRightPanelWideSnap(viewportWidth: number): number {
  return getMaxRightPanelWidth(viewportWidth)
}

/**
 * 双击手柄时在「工具窄栏 / 预览宽栏」两档间切换。
 * 当前更接近哪档，就切到另一档。
 */
export function toggleRightPanelSnap(width: number, viewportWidth: number): number {
  const current = clampRightPanelWidth(width, viewportWidth)
  const narrow = clampRightPanelWidth(RIGHT_PANEL_NARROW_SNAP, viewportWidth)
  const wide = getRightPanelWideSnap(viewportWidth)
  const distToNarrow = Math.abs(current - narrow)
  const distToWide = Math.abs(current - wide)
  return distToNarrow <= distToWide ? wide : narrow
}
