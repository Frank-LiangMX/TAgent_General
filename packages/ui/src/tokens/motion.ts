/**
 * 动效 Token 源
 *
 * 当前阶段留空，动画 keyframes 定义在 tailwind.config.js 里。
 * 后续如需统一动效 token，在此添加 duration / easing / keyframe 引用。
 */

export const motion = {} as const

export type MotionToken = keyof typeof motion
