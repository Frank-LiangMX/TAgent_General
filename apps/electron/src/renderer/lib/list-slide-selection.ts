/**
 * 列表滑动选中态 — 设置页左侧 Tab / 插件侧栏导航共用
 */

/** 与主内容区底板一致的 ease-out-expo 感，比 Material 默认曲线更柔和 */
const LIST_SLIDE_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const LIST_SLIDE_DURATION = '280ms'

export const LIST_SLIDE_TRANSITION = `top ${LIST_SLIDE_DURATION} ${LIST_SLIDE_EASE}, height ${LIST_SLIDE_DURATION} ${LIST_SLIDE_EASE}, left ${LIST_SLIDE_DURATION} ${LIST_SLIDE_EASE}, width ${LIST_SLIDE_DURATION} ${LIST_SLIDE_EASE}`

export const LIST_SLIDE_ACCENT_TRANSITION = `top ${LIST_SLIDE_DURATION} ${LIST_SLIDE_EASE}, height ${LIST_SLIDE_DURATION} ${LIST_SLIDE_EASE}, left ${LIST_SLIDE_DURATION} ${LIST_SLIDE_EASE}, background-color ${LIST_SLIDE_DURATION} ${LIST_SLIDE_EASE}`

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

export function listSlideItemGhostClasses(
  active: boolean,
  useSlideIndicator: boolean
): string | false {
  return active && useSlideIndicator
    ? `${LIST_SLIDE_ITEM_SELECTED_CLASS} ${LIST_SLIDE_ITEM_GHOST_CLASS}`
    : false
}
