/**
 * 颜色 Token 源
 *
 * 当前阶段（阶段 1）只定义结构，值留空。
 * 现有 34 个颜色 CSS 变量仍在 globals.css 的 :root 和 .theme-* 块里。
 *
 * 阶段 5（可选优化）：把 globals.css 的颜色变量迁入此处，
 * 生成器开始产出完整 CSS 变量文件，globals.css 改为 @import。
 *
 * 主题命名约定：`{name}-{light|dark}`，对应 .theme-{name}-{light|dark} class
 * 现有 6 主题：ocean / forest / slate / orange / purple（每个有 light/dark 两个变体）
 * 加上默认 light / dark，共 14 个主题对象。
 */

export interface ThemeColors {
  /** 背景色（HSL 三元组，如 "210 40% 98%"，不含 hsl()） */
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
 * 阶段 1：留空对象，生成器跳过颜色 CSS 变量产出，只产出 tailwind-theme.js 的 colors 映射
 * （指向现有 hsl(var(--xxx))，让 Tailwind 配置集中）
 *
 * 阶段 5：填入所有主题颜色值，生成器产出完整 CSS 变量文件
 */
export const colors: Partial<Record<ThemeName, Partial<ThemeColors>>> = {}

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
