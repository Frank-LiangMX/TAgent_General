/**
 * 颜色 Token 源
 *
 * 定义所有 14 个主题的颜色值。
 * 生成器会产出 .theme-xxx { ... } 块到 tokens.css，
 * globals.css 改为 @import tokens.css。
 *
 * 主题命名约定：`{name}-{light|dark}`，对应 .theme-{name}-{light|dark} class
 * 现有 6 主题：ocean / forest / slate / orange / purple（每个有 light/dark 两个变体）
 * 加上默认 light / dark，共 14 个主题对象。
 *
 * 值格式：HSL 三元组字符串（如 "220 14% 96%"），不含 hsl()。
 */

export interface ThemeColors {
  /** 背景色 */
  background: string
  foreground: string
  muted: string
  'muted-foreground': string
  border: string
  input: string
  ring: string
  primary: string
  'primary-foreground': string
  secondary: string
  'secondary-foreground': string
  accent: string
  'accent-foreground': string
  destructive: string
  'destructive-foreground': string
  card: string
  'card-foreground': string
  popover: string
  'popover-foreground': string
  dialog: string
  'dialog-foreground': string
  tooltip: string
  'tooltip-foreground': string
  'tooltip-muted': string
  'content-area': string
}

export type ThemeName =
  | 'default-light'
  | 'default-dark'
  | 'ocean-light'
  | 'ocean-dark'
  | 'forest-light'
  | 'forest-dark'
  | 'slate-light'
  | 'slate-dark'
  | 'orange-light'
  | 'orange-dark'
  | 'purple-light'
  | 'purple-dark'

/**
 * 颜色主题表
 *
 * 从 globals.css 的 :root 和 .theme-* 块提取。
 * 生成器会产出 .theme-xxx { --xxx: value; } 块到 tokens.css。
 */
export const colors: Record<ThemeName, ThemeColors> = {
  // ===== 默认主题 =====
  'default-light': {
    background: '220 14% 96%',
    foreground: '213 18% 27%',
    muted: '220 12% 93%',
    'muted-foreground': '213 12% 45%',
    border: '220 10% 88%',
    input: '220 10% 88%',
    ring: '223 53% 59%',
    primary: '223 53% 59%',
    'primary-foreground': '0 0% 100%',
    secondary: '220 10% 94%',
    'secondary-foreground': '213 18% 27%',
    accent: '223 53% 59%',
    'accent-foreground': '0 0% 100%',
    destructive: '0 55% 55%',
    'destructive-foreground': '0 0% 98%',
    card: '220 14% 97%',
    'card-foreground': '213 18% 27%',
    popover: '220 14% 97%',
    'popover-foreground': '213 18% 27%',
    dialog: '220 20% 99%',
    'dialog-foreground': '213 18% 27%',
    tooltip: '213 18% 22%',
    'tooltip-foreground': '0 0% 98%',
    'tooltip-muted': '213 10% 65%',
    'content-area': '220 14% 96%',
  },

  'default-dark': {
    background: '220 18% 15%',
    foreground: '220 12% 93%',
    muted: '220 14% 19%',
    'muted-foreground': '220 10% 65%',
    border: '220 12% 22%',
    input: '220 12% 22%',
    ring: '223 53% 65%',
    primary: '223 53% 65%',
    'primary-foreground': '220 18% 10%',
    secondary: '220 12% 20%',
    'secondary-foreground': '220 12% 93%',
    accent: '223 53% 65%',
    'accent-foreground': '220 18% 10%',
    destructive: '0 55% 60%',
    'destructive-foreground': '220 18% 10%',
    card: '220 18% 16%',
    'card-foreground': '220 12% 93%',
    popover: '220 18% 16%',
    'popover-foreground': '220 12% 93%',
    dialog: '220 16% 20%',
    'dialog-foreground': '220 12% 93%',
    tooltip: '220 14% 28%',
    'tooltip-foreground': '220 12% 93%',
    'tooltip-muted': '220 10% 60%',
    'content-area': '220 18% 14%',
  },

  // ===== 海洋主题 =====
  'ocean-light': {
    background: '205 20% 94%',
    foreground: '210 18% 25%',
    muted: '205 18% 90%',
    'muted-foreground': '210 12% 43%',
    border: '205 16% 85%',
    input: '205 16% 85%',
    ring: '205 45% 55%',
    primary: '205 45% 55%',
    'primary-foreground': '0 0% 100%',
    secondary: '205 18% 92%',
    'secondary-foreground': '210 18% 25%',
    accent: '205 45% 55%',
    'accent-foreground': '0 0% 100%',
    destructive: '0 55% 55%',
    'destructive-foreground': '0 0% 98%',
    card: '205 20% 97%',
    'card-foreground': '210 18% 25%',
    popover: '205 20% 97%',
    'popover-foreground': '210 18% 25%',
    dialog: '205 30% 99%',
    'dialog-foreground': '210 18% 25%',
    tooltip: '210 25% 20%',
    'tooltip-foreground': '0 0% 98%',
    'tooltip-muted': '210 12% 62%',
    'content-area': '205 20% 96%',
  },

  'ocean-dark': {
    background: '210 18% 15%',
    foreground: '210 12% 93%',
    muted: '210 14% 19%',
    'muted-foreground': '210 12% 58%',
    border: '210 16% 22%',
    input: '210 16% 22%',
    ring: '205 45% 60%',
    primary: '205 45% 60%',
    'primary-foreground': '220 18% 10%',
    secondary: '210 14% 18%',
    'secondary-foreground': '210 12% 93%',
    accent: '205 45% 60%',
    'accent-foreground': '220 18% 10%',
    destructive: '0 55% 60%',
    'destructive-foreground': '220 18% 10%',
    card: '210 18% 15%',
    'card-foreground': '210 12% 93%',
    popover: '210 18% 15%',
    'popover-foreground': '210 12% 93%',
    dialog: '210 16% 18%',
    'dialog-foreground': '210 12% 93%',
    tooltip: '210 20% 22%',
    'tooltip-foreground': '210 12% 93%',
    'tooltip-muted': '210 12% 58%',
    'content-area': '210 18% 14%',
  },

  // ===== 森系主题 =====
  'forest-light': {
    background: '140 12% 95%',
    foreground: '150 16% 22%',
    muted: '140 10% 91%',
    'muted-foreground': '150 8% 43%',
    border: '140 10% 85%',
    input: '140 10% 85%',
    ring: '140 30% 50%',
    primary: '140 30% 50%',
    'primary-foreground': '0 0% 100%',
    secondary: '140 10% 92%',
    'secondary-foreground': '150 16% 22%',
    accent: '140 30% 50%',
    'accent-foreground': '0 0% 100%',
    destructive: '0 55% 55%',
    'destructive-foreground': '0 0% 98%',
    card: '140 12% 97%',
    'card-foreground': '150 16% 22%',
    popover: '140 12% 97%',
    'popover-foreground': '150 16% 22%',
    dialog: '140 22% 99%',
    'dialog-foreground': '150 16% 22%',
    tooltip: '150 16% 22%',
    'tooltip-foreground': '0 0% 98%',
    'tooltip-muted': '150 10% 55%',
    'content-area': '140 12% 96%',
  },

  'forest-dark': {
    background: '150 14% 15%',
    foreground: '150 12% 93%',
    muted: '150 12% 19%',
    'muted-foreground': '150 10% 55%',
    border: '150 12% 22%',
    input: '150 12% 22%',
    ring: '140 35% 55%',
    primary: '140 35% 55%',
    'primary-foreground': '220 18% 10%',
    secondary: '150 10% 18%',
    'secondary-foreground': '150 12% 93%',
    accent: '140 35% 55%',
    'accent-foreground': '220 18% 10%',
    destructive: '0 55% 60%',
    'destructive-foreground': '220 18% 10%',
    card: '150 14% 16%',
    'card-foreground': '150 12% 93%',
    popover: '150 14% 16%',
    'popover-foreground': '150 12% 93%',
    dialog: '150 12% 18%',
    'dialog-foreground': '150 12% 93%',
    tooltip: '150 14% 22%',
    'tooltip-foreground': '150 12% 93%',
    'tooltip-muted': '150 10% 55%',
    'content-area': '150 14% 14%',
  },

  // ===== 莫兰迪/云朵主题 =====
  'slate-light': {
    background: '40 8% 94%',
    foreground: '40 12% 24%',
    muted: '40 8% 91%',
    'muted-foreground': '40 8% 43%',
    border: '40 8% 85%',
    input: '40 8% 85%',
    ring: '25 30% 52%',
    primary: '25 30% 52%',
    'primary-foreground': '0 0% 100%',
    secondary: '40 8% 92%',
    'secondary-foreground': '40 12% 24%',
    accent: '25 30% 52%',
    'accent-foreground': '0 0% 100%',
    destructive: '0 55% 55%',
    'destructive-foreground': '0 0% 98%',
    card: '40 8% 97%',
    'card-foreground': '40 12% 24%',
    popover: '40 8% 97%',
    'popover-foreground': '40 12% 24%',
    dialog: '40 18% 99%',
    'dialog-foreground': '40 12% 24%',
    tooltip: '40 12% 22%',
    'tooltip-foreground': '0 0% 98%',
    'tooltip-muted': '40 8% 55%',
    'content-area': '40 8% 96%',
  },

  'slate-dark': {
    background: '40 10% 15%',
    foreground: '40 12% 93%',
    muted: '40 8% 19%',
    'muted-foreground': '40 8% 55%',
    border: '40 10% 22%',
    input: '40 10% 22%',
    ring: '25 35% 55%',
    primary: '25 35% 55%',
    'primary-foreground': '220 18% 10%',
    secondary: '40 8% 18%',
    'secondary-foreground': '40 12% 93%',
    accent: '25 35% 55%',
    'accent-foreground': '220 18% 10%',
    destructive: '0 55% 60%',
    'destructive-foreground': '220 18% 10%',
    card: '40 10% 16%',
    'card-foreground': '40 12% 93%',
    popover: '40 10% 16%',
    'popover-foreground': '40 12% 93%',
    dialog: '40 10% 18%',
    'dialog-foreground': '40 12% 93%',
    tooltip: '40 10% 22%',
    'tooltip-foreground': '40 12% 93%',
    'tooltip-muted': '40 8% 55%',
    'content-area': '40 10% 14%',
  },

  // ===== 橙陶主题 =====
  'orange-light': {
    background: '30 20% 95%',
    foreground: '25 20% 22%',
    muted: '30 15% 91%',
    'muted-foreground': '25 12% 43%',
    border: '30 15% 85%',
    input: '30 15% 85%',
    ring: '20 60% 52%',
    primary: '20 60% 52%',
    'primary-foreground': '0 0% 100%',
    secondary: '30 15% 92%',
    'secondary-foreground': '25 20% 22%',
    accent: '20 60% 52%',
    'accent-foreground': '0 0% 100%',
    destructive: '0 55% 55%',
    'destructive-foreground': '0 0% 98%',
    card: '30 20% 97%',
    'card-foreground': '25 20% 22%',
    popover: '30 20% 97%',
    'popover-foreground': '25 20% 22%',
    dialog: '30 28% 99%',
    'dialog-foreground': '25 20% 22%',
    tooltip: '25 16% 22%',
    'tooltip-foreground': '0 0% 98%',
    'tooltip-muted': '25 10% 55%',
    'content-area': '30 20% 96%',
  },

  'orange-dark': {
    background: '20 16% 15%',
    foreground: '25 16% 93%',
    muted: '20 12% 19%',
    'muted-foreground': '20 10% 55%',
    border: '20 14% 22%',
    input: '20 14% 22%',
    ring: '20 65% 55%',
    primary: '20 65% 55%',
    'primary-foreground': '220 18% 10%',
    secondary: '20 10% 18%',
    'secondary-foreground': '25 16% 93%',
    accent: '20 65% 55%',
    'accent-foreground': '220 18% 10%',
    destructive: '0 55% 60%',
    'destructive-foreground': '220 18% 10%',
    card: '20 16% 16%',
    'card-foreground': '25 16% 93%',
    popover: '20 16% 16%',
    'popover-foreground': '25 16% 93%',
    dialog: '20 14% 18%',
    'dialog-foreground': '25 16% 93%',
    tooltip: '20 14% 22%',
    'tooltip-foreground': '25 16% 93%',
    'tooltip-muted': '20 10% 55%',
    'content-area': '20 16% 14%',
  },

  // ===== 紫藤主题 =====
  'purple-light': {
    background: '280 14% 95%',
    foreground: '280 16% 22%',
    muted: '280 12% 91%',
    'muted-foreground': '280 8% 43%',
    border: '280 12% 85%',
    input: '280 12% 85%',
    ring: '280 45% 58%',
    primary: '280 45% 58%',
    'primary-foreground': '0 0% 100%',
    secondary: '280 12% 92%',
    'secondary-foreground': '280 16% 22%',
    accent: '280 45% 58%',
    'accent-foreground': '0 0% 100%',
    destructive: '0 55% 55%',
    'destructive-foreground': '0 0% 98%',
    card: '280 14% 97%',
    'card-foreground': '280 16% 22%',
    popover: '280 14% 97%',
    'popover-foreground': '280 16% 22%',
    dialog: '280 20% 99%',
    'dialog-foreground': '280 16% 22%',
    tooltip: '280 16% 22%',
    'tooltip-foreground': '0 0% 98%',
    'tooltip-muted': '280 10% 55%',
    'content-area': '280 14% 96%',
  },

  'purple-dark': {
    background: '280 14% 15%',
    foreground: '280 12% 93%',
    muted: '280 12% 19%',
    'muted-foreground': '280 10% 55%',
    border: '280 12% 22%',
    input: '280 12% 22%',
    ring: '280 50% 62%',
    primary: '280 50% 62%',
    'primary-foreground': '220 18% 10%',
    secondary: '280 10% 18%',
    'secondary-foreground': '280 12% 93%',
    accent: '280 50% 62%',
    'accent-foreground': '220 18% 10%',
    destructive: '0 55% 60%',
    'destructive-foreground': '220 18% 10%',
    card: '280 14% 16%',
    'card-foreground': '280 12% 93%',
    popover: '280 14% 16%',
    'popover-foreground': '280 12% 93%',
    dialog: '280 12% 18%',
    'dialog-foreground': '280 12% 93%',
    tooltip: '280 14% 22%',
    'tooltip-foreground': '280 12% 93%',
    'tooltip-muted': '280 10% 55%',
    'content-area': '280 14% 14%',
  },
}

/**
 * Tailwind 颜色 token 映射
 *
 * 把 CSS 变量桥接到 Tailwind colors 配置，让组件用 `bg-background` / `text-foreground` 等类。
 * 这里集中定义，避免散落在 tailwind.config.js。
 */
export const tailwindColorTokens = {
  border: 'hsl(var(--border) / <alpha-value>)',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  background: 'hsl(var(--background) / <alpha-value>)',
  foreground: 'hsl(var(--foreground) / <alpha-value>)',
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },
  accent: {
    DEFAULT: 'hsl(var(--accent))',
    foreground: 'hsl(var(--accent-foreground))',
  },
  destructive: {
    DEFAULT: 'hsl(var(--destructive))',
    foreground: 'hsl(var(--destructive-foreground))',
  },
  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))',
  },
  popover: {
    DEFAULT: 'hsl(var(--popover))',
    foreground: 'hsl(var(--popover-foreground))',
  },
  dialog: {
    DEFAULT: 'hsl(var(--dialog))',
    foreground: 'hsl(var(--dialog-foreground))',
  },
  tooltip: {
    DEFAULT: 'hsl(var(--tooltip) / <alpha-value>)',
    foreground: 'hsl(var(--tooltip-foreground) / <alpha-value>)',
    muted: 'hsl(var(--tooltip-muted) / <alpha-value>)',
  },
  'content-area': 'hsl(var(--content-area) / <alpha-value>)',
} as const
