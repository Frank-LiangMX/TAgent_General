/**
 * 列表滑动选中态 — 侧栏会话列表 / 设置页左侧 Tab 共用
 */

export const LIST_SLIDE_TRANSITION =
  'top 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1), left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)'

export const LIST_SLIDE_ACCENT_TRANSITION =
  'top 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1), left 0.35s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.35s cubic-bezier(0.4, 0, 0.2, 1)'

/** 滑动指示器容器 */
export const LIST_SLIDE_HOST_CLASS = 'list-slide-host'

/** 玻璃滑动底板 */
export const LIST_SLIDE_INDICATOR_CLASS = 'list-slide-indicator session-glass session-glass-sidebar'

/** 跨组淡出层叠在按钮之上 */
export const LIST_SLIDE_INDICATOR_EXIT_CLASS = 'list-slide-indicator--exit'

/** 当前行选中（配合 ghost 露出背后滑动玻璃） */
export const LIST_SLIDE_ITEM_SELECTED_CLASS = 'list-slide-item--selected'

/** 行内背景透明，由父级滑动层绘制选中态 */
export const LIST_SLIDE_ITEM_GHOST_CLASS = 'list-slide-item--ghost'

export function listSlideItemGhostClasses(active: boolean, useSlideIndicator: boolean): string | false {
  return active && useSlideIndicator
    ? `${LIST_SLIDE_ITEM_SELECTED_CLASS} ${LIST_SLIDE_ITEM_GHOST_CLASS}`
    : false
}
