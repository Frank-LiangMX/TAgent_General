/**
 * 动效 Token 源
 *
 * 从 glass-studio 设计原型提取的动效 token。
 * 命名约定：`{duration|easing}-{modifier}`
 */

export const motion = {
  // 缓动函数
  'ease-island': 'cubic-bezier(0.16, 1, 0.3, 1)',

  // 过渡时长
  'duration-fast': '160ms',
  'duration-normal': '240ms',
  'duration-slow': '420ms',
} as const

export type MotionToken = keyof typeof motion
