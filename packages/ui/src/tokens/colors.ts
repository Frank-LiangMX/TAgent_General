/**
 * 颜色 Token 源
 *
 * 设计原则（对齐 glass-studio Soft Glass / chat 原型，并修正双蓝过近）：
 * 1. **表面近中性**：background / card / well 不整页重染色，避免「颜色太重」
 * 2. **accent 承载身份**：primary 克制、chroma 同级，只用于选中 / 开关 / 流光
 * 3. **族可辨认**：Mist(默认冷蓝) vs Ocean(**青/teal**，与 Mist 明显拉开)
 *    Moss(雾绿) / Dusk 云絮陶(暖砂) / 琥珀(略暖 dusk) / 紫藤(软紫)
 *
 * 映射：
 * - default ≈ Mist 云絮蓝
 * - ocean   ≈ Ocean 天青（hue ~191，非 205 贴蓝）
 * - forest  ≈ Moss 青苔
 * - slate   ≈ Dusk 暖砂
 * - orange  ≈ 暖砂偏琥珀（sat 低于旧 60%）
 * - purple  ≈ 软紫 + 中性底
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

/** 亮色近中性表面（轻微 hue 倾向，不整页染色） */
function lightNeutral(hue: number, primary: string): ThemeColors {
  const h = String(hue)
  return {
    background: `${h} 12% 93%`,
    foreground: `${h} 14% 28%`,
    muted: `${h} 10% 90%`,
    'muted-foreground': `${h} 10% 44%`,
    border: `${h} 10% 86%`,
    input: `${h} 10% 86%`,
    ring: primary,
    primary,
    'primary-foreground': '0 0% 100%',
    secondary: `${h} 10% 92%`,
    'secondary-foreground': `${h} 14% 28%`,
    // accent = 轻量交互底（hover/选中），禁止绑 solid primary（ghost 按钮会整块染色）
    accent: `${h} 12% 90%`,
    'accent-foreground': `${h} 14% 28%`,
    destructive: '0 50% 52%',
    'destructive-foreground': '0 0% 98%',
    card: `${h} 14% 96%`,
    'card-foreground': `${h} 14% 28%`,
    popover: `${h} 14% 96%`,
    'popover-foreground': `${h} 14% 28%`,
    dialog: `${h} 16% 98%`,
    'dialog-foreground': `${h} 14% 28%`,
    // 浅色主题 tooltip 跟 surface 一致：亮底深字，不用反相深色气泡
    tooltip: `${h} 16% 98%`,
    'tooltip-foreground': `${h} 14% 28%`,
    'tooltip-muted': `${h} 10% 48%`,
    'content-area': `${h} 12% 94%`,
  }
}

/** 暗色近中性表面 */
function darkNeutral(hue: number, primary: string): ThemeColors {
  const h = String(hue)
  return {
    background: `${h} 14% 15%`,
    foreground: `${h} 12% 93%`,
    muted: `${h} 12% 19%`,
    'muted-foreground': `${h} 10% 60%`,
    border: `${h} 12% 22%`,
    input: `${h} 12% 22%`,
    ring: primary,
    primary,
    'primary-foreground': `${h} 18% 10%`,
    secondary: `${h} 12% 18%`,
    'secondary-foreground': `${h} 12% 93%`,
    // accent = 轻量交互底（hover/选中），禁止绑 solid primary
    accent: `${h} 12% 22%`,
    'accent-foreground': `${h} 12% 93%`,
    destructive: '0 50% 58%',
    'destructive-foreground': `${h} 18% 10%`,
    card: `${h} 14% 16%`,
    'card-foreground': `${h} 12% 93%`,
    popover: `${h} 14% 16%`,
    'popover-foreground': `${h} 12% 93%`,
    dialog: `${h} 14% 18%`,
    'dialog-foreground': `${h} 12% 93%`,
    // 深色：略抬于背景的 surface 气泡
    tooltip: `${h} 14% 20%`,
    'tooltip-foreground': `${h} 12% 93%`,
    'tooltip-muted': `${h} 10% 62%`,
    'content-area': `${h} 14% 14%`,
  }
}

/**
 * Soft Glass 风格色表
 *
 * primary 参考 glass-studio themes.css：
 * - Mist #5b7fd4 → 221 52% 56%
 * - Ocean 拉开为 teal（原型双蓝过近）→ 191 46% 48% / dark 191 48% 64%
 * - Moss #5a8f72 → 148 28% 46%
 * - Dusk #a07a5e → 25 28% 50%
 */
export const colors: Record<ThemeName, ThemeColors> = {
  // ===== Mist 云絮 · 默认冷蓝 =====
  'default-light': lightNeutral(220, '221 48% 56%'),
  'default-dark': darkNeutral(220, '221 50% 68%'),

  // ===== Ocean 天青 · 明显 teal，与 Mist 可辨 =====
  'ocean-light': lightNeutral(200, '191 46% 48%'),
  'ocean-dark': darkNeutral(200, '191 48% 64%'),

  // ===== Moss 青苔 · forest =====
  'forest-light': lightNeutral(150, '148 28% 46%'),
  'forest-dark': darkNeutral(150, '148 30% 60%'),

  // ===== Dusk 暖砂 · slate 云絮陶 =====
  'slate-light': lightNeutral(35, '25 28% 50%'),
  'slate-dark': darkNeutral(30, '27 36% 62%'),

  // ===== 琥珀 · 略暖于 Dusk，仍克制（非旧 60% sat）=====
  'orange-light': lightNeutral(28, '22 40% 52%'),
  'orange-dark': darkNeutral(22, '24 42% 58%'),

  // ===== 紫藤 · 软紫 + 中性底 =====
  'purple-light': lightNeutral(270, '275 36% 54%'),
  'purple-dark': darkNeutral(270, '275 38% 66%'),
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
