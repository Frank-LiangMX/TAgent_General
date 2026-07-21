export interface InspectorMotionRect {
  left: number
  top: number
  width: number
  height: number
}

export type InspectorMotionDirection = 'opening' | 'closing'

/**
 * 克制的标准减速，避免 (0.22, 1, …) 那种末端长时间爬行的「阻尼感」。
 * 外层 animation.easing 也用同一条，关键帧内不再叠复杂 ease。
 */
export const INSPECTOR_MOTION_EASE = 'cubic-bezier(0.33, 0, 0.2, 1)'

/** 与 app-shell.css 折叠胶囊 / 展开面板圆角 token 对齐 */
export const INSPECTOR_CAPSULE_RADIUS_PX = 16
export const INSPECTOR_PANEL_RADIUS_PX = 22

function clampSize(value: number): number {
  return Math.max(1, value)
}

function clampScale(value: number): number {
  return Math.max(0.0001, value)
}

function format(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function transform(dx: number, dy: number, scaleX: number, scaleY: number): string {
  return `translate3d(${format(dx)}px, ${format(dy)}px, 0) scale(${format(scaleX)}, ${format(scaleY)})`
}

/**
 * scale 会把 border-radius 一起压扁。
 * 要在视觉上保持 R，CSS 半径需写成 R / scale（x/y 可不同）。
 */
function radiusForVisual(visualRadius: number, scaleX: number, scaleY: number): string {
  return `${format(visualRadius / clampScale(scaleX))}px / ${format(visualRadius / clampScale(scaleY))}px`
}

/**
 * 右上角锚点 FLIP。
 *
 * - transform：几何 morph
 * - borderRadius：按 scale 反补偿，避免收到胶囊时变成直角矩形
 *   （代理始终是「满面板盒子 + scale 缩小」，圆角不补偿就会被 scale 吃掉）
 */
export function createInspectorMotionKeyframes(
  capsule: InspectorMotionRect,
  panel: InspectorMotionRect,
  direction: InspectorMotionDirection
): Keyframe[] {
  const panelWidth = clampSize(panel.width)
  const panelHeight = clampSize(panel.height)
  const capsuleWidth = clampSize(capsule.width)
  const capsuleHeight = clampSize(capsule.height)
  const startScaleX = Math.min(1, capsuleWidth / panelWidth)
  const startScaleY = Math.min(1, capsuleHeight / panelHeight)
  // 右上对齐：胶囊右缘 = 面板右缘
  const startDx = capsule.left + capsuleWidth - (panel.left + panelWidth)
  const startDy = capsule.top - panel.top

  const capsulePose = transform(startDx, startDy, startScaleX, startScaleY)
  const panelPose = transform(0, 0, 1, 1)
  // 胶囊态：视觉 16px；面板态：视觉 22px
  const capsuleRadius = radiusForVisual(INSPECTOR_CAPSULE_RADIUS_PX, startScaleX, startScaleY)
  const panelRadius = `${INSPECTOR_PANEL_RADIUS_PX}px`

  if (direction === 'opening') {
    return [
      {
        offset: 0,
        transform: capsulePose,
        opacity: 1,
        borderRadius: capsuleRadius,
      },
      {
        offset: 1,
        transform: panelPose,
        opacity: 1,
        borderRadius: panelRadius,
      },
    ]
  }

  return [
    {
      offset: 0,
      transform: panelPose,
      opacity: 1,
      borderRadius: panelRadius,
    },
    {
      offset: 1,
      transform: capsulePose,
      opacity: 1,
      borderRadius: capsuleRadius,
    },
  ]
}

export function getInspectorProxyStyle(panel: InspectorMotionRect): Partial<CSSStyleDeclaration> {
  return {
    left: `${panel.left}px`,
    top: `${panel.top}px`,
    width: `${clampSize(panel.width)}px`,
    height: `${clampSize(panel.height)}px`,
    transformOrigin: 'top right',
    borderRadius: `${INSPECTOR_PANEL_RADIUS_PX}px`,
  }
}
