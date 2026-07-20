/**
 * 右栏 float 模式：点击 inspector 外是否应收起。
 * dock（占位）模式不走此逻辑，常驻直到用户主动关闭。
 */

/** 点击落在这些 portaled 浮层内时，不视为 outside（Select / Menu / Dialog 等） */
const INSPECTOR_OUTSIDE_IGNORE_SELECTOR = [
  '[data-radix-popper-content-wrapper]',
  '[data-radix-menu-content]',
  '[data-radix-select-content]',
  '[data-radix-dropdown-menu-content]',
  '[data-radix-popover-content]',
  '[data-radix-tooltip-content]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[data-sonner-toaster]',
  /* morph 代理层在 stack 外，过渡中点击不误关 */
  '.right-inspector-morph-layer',
  '.right-inspector-morph-surface',
].join(', ')

/** 测试与运行时共用的最小节点形状（避免单测依赖 jsdom） */
export interface InspectorDismissTarget {
  closest: (selectors: string) => unknown
}

export interface InspectorDismissRoot {
  contains: (node: InspectorDismissTarget) => boolean
}

function isDismissTarget(value: unknown): value is InspectorDismissTarget {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as InspectorDismissTarget).closest === 'function'
  )
}

function isDismissRoot(value: unknown): value is InspectorDismissRoot {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as InspectorDismissRoot).contains === 'function'
  )
}

/**
 * @returns true = 应收起 float inspector
 */
export function shouldDismissFloatInspector(
  target: EventTarget | InspectorDismissTarget | null,
  inspectorRoot: Element | InspectorDismissRoot | null
): boolean {
  if (!isDismissTarget(target)) return false
  if (!isDismissRoot(inspectorRoot)) return false
  if (inspectorRoot.contains(target)) return false
  if (target.closest(INSPECTOR_OUTSIDE_IGNORE_SELECTOR)) return false
  return true
}
