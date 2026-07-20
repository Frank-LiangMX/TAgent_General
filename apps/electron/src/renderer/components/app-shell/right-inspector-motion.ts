export interface InspectorMotionRect {
  left: number
  top: number
  width: number
  height: number
}

export type InspectorMotionDirection = 'opening' | 'closing'

const OPEN_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const CLOSE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

function clampSize(value: number): number {
  return Math.max(1, value)
}

function clampScale(value: number): number {
  return Math.max(0.0001, value)
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function format(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function transform(dx: number, dy: number, scaleX: number, scaleY: number): string {
  return `translate3d(${format(dx)}px, ${format(dy)}px, 0) scale(${format(scaleX)}, ${format(scaleY)})`
}

function radiusForScale(radius: number, scaleX: number, scaleY: number): string {
  return `${format(radius / clampScale(scaleX))}px / ${format(radius / clampScale(scaleY))}px`
}

/**
 * Builds a right-edge anchored FLIP animation.
 *
 * The proxy is laid out once at the final panel rect. Every keyframe changes only
 * compositor-friendly transform/opacity (plus the inexpensive proxy radius), so
 * the real glass panel never has to resize or blur on every frame.
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
  const startDx = capsule.left + capsuleWidth - (panel.left + panelWidth)
  const startDy = capsule.top - panel.top

  const at = (
    progressX: number,
    progressY: number,
    offset: number,
    opacity: number,
    radius: number,
    nudgeX = 0,
    nudgeY = 0,
    easing?: string
  ): Keyframe => {
    const scaleX = lerp(startScaleX, 1, progressX)
    const scaleY = lerp(startScaleY, 1, progressY)
    const frame: Keyframe = {
      offset,
      transform: transform(
        lerp(startDx, 0, progressX) + nudgeX,
        lerp(startDy, 0, progressY) + nudgeY,
        scaleX,
        scaleY
      ),
      opacity,
      borderRadius: radiusForScale(radius, scaleX, scaleY),
    }
    if (easing) frame.easing = easing
    return frame
  }

  const opening = [
    at(0, 0, 0, 0.96, 16, 0, 0, OPEN_EASE),
    at(0.24, 0.1, 0.2, 0.98, 18, -2, 4, OPEN_EASE),
    at(0.56, 0.4, 0.48, 1, 20, -3, 3, OPEN_EASE),
    at(0.84, 0.76, 0.74, 1, 22, -1, 1, OPEN_EASE),
    at(1, 1, 1, 1, 22),
  ]

  if (direction === 'opening') return opening

  return opening
    .map((frame, index) => ({
      ...frame,
      offset: 1 - Number(frame.offset),
      opacity: index === 0 ? 0.96 : 1,
      easing: index === opening.length - 1 ? CLOSE_EASE : frame.easing,
    }))
    .reverse()
}

export function getInspectorProxyStyle(panel: InspectorMotionRect): Partial<CSSStyleDeclaration> {
  return {
    left: `${panel.left}px`,
    top: `${panel.top}px`,
    width: `${clampSize(panel.width)}px`,
    height: `${clampSize(panel.height)}px`,
    transformOrigin: 'top right',
  }
}
