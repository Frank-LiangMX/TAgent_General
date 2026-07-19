/**
 * 颜色 Token 源
 *
 * 权威视觉源：`prototypes/spatial-theme-study/theme-tokens.css`（v4 Spatial Lens）。
 *
 * 设计原则：
 * 1. **约 65% 近中性空间 + A/B 矿物光**：scene-base / glass 近无色，身份只靠 scene A/B 光
 * 2. **accent 只给 CTA / focus / 关键进度**：映射为 Tailwind `primary`；active 中性玻璃不染 accent
 * 3. **ink 四级字色**：foreground ≈ ink-strong，正文/次要用低 chroma 冷暖字色，不整页染色
 * 4. **六主题冷暖**：default 矿物瓷光 / ocean 青瓷水光 / forest 茶烟橄榄 /
 *    slate 玄武暖灰 / orange 琥珀干光 / purple 鸢尾烟光（禁霓虹紫）
 * 5. **scene 与材质正交**：主题只定 hue / primary / ink / scene；材质只改 blur/opacity/rim
 *
 * 值格式：HSL 三元组字符串（如 "220 14% 96%"），不含 hsl()；
 * scene-*-rgb / glass-rgb 为 `r g b` 空格三元组。
 * 生成器把每个 key 产出 `--{key}` CSS 变量。
 */

/** 弥散渐变环境色三元组（由每个 ThemeName 定义） */
export interface SceneField {
  /** 弥散渐变基底色（窗口底色：浅色瓷白 / 深色深底） */
  base: string
  /** 主环境光斑色（左上光斑 + glass 色散右侧；中饱和，保证光斑与色散可见） */
  a: string
  /** 次环境光斑色（右下光斑；极淡。default-light 为极弱暖雾，不泛黄） */
  b: string
  c: string
  glass: string
  baseRgb: string
  aRgb: string
  aPos: string
  aSize: string
  aStrength: string
  bRgb: string
  bPos: string
  bSize: string
  bStrength: string
  cRgb: string
  cPos: string
  cSize: string
  cStrength: string
}

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
  /** 弥散渐变基底色（窗口底层 scene 背景） */
  'scene-base': string
  /** 主环境光斑色 */
  'scene-ambient-a': string
  /** 次环境光斑色 */
  'scene-ambient-b': string
  'scene-ambient-c': string
  'scene-base-rgb': string
  'scene-a-rgb': string
  'scene-a-pos': string
  'scene-a-size': string
  'scene-a-strength': string
  'scene-b-rgb': string
  'scene-b-pos': string
  'scene-b-size': string
  'scene-b-strength': string
  'scene-c-rgb': string
  'scene-c-pos': string
  'scene-c-size': string
  'scene-c-strength': string
  'glass-rgb': string
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
 * 每个主题的 scene 弥散环境色三元组。
 *
 * 设计约束：
 * - 浅色：base 高 lightness（94-96%）瓷白/近中性，a 中饱和中 lightness 做可见光斑，
 *   b 极淡做次要光斑（default-light 的 b 是极弱暖雾，sat ≤ 22% 不泛黄）。
 * - 深色：base 低 lightness（13-15%）深底，a/b 为低 lightness（19-26%）主题色光斑，
 *   深色背景需要更亮的主题光斑才能让弥散渐变可见。
 * - a 同时承担 glass 色散右侧色，故 lightness 不能过高（否则色散不可见）。
 */
function scene(
  base: string,
  a: string,
  b: string,
  c: string,
  glass: string,
  field: Omit<SceneField, 'base' | 'a' | 'b' | 'c' | 'glass'>
): SceneField {
  return { base, a, b, c, glass, ...field }
}

const SCENE: Record<ThemeName, SceneField> = {
  // Mist 瓷白雾面：冷雾蓝光斑 + 极弱暖雾
  'default-light': scene('60 7% 92%', '211 39% 71%', '34 36% 81%', '221 6% 69%', '252 252 250', {
    baseRgb: '236 236 233',
    aRgb: '148 180 214',
    aPos: '18% 10%',
    aSize: '46% 40%',
    aStrength: '0.46',
    bRgb: '228 208 184',
    bPos: '86% 86%',
    bSize: '34% 30%',
    bStrength: '0.28',
    cRgb: '172 176 182',
    cPos: '52% 100%',
    cSize: '78% 40%',
    cStrength: '0.13',
  }),
  'default-dark': scene('220 8% 15%', '211 28% 37%', '33 19% 26%', '220 6% 18%', '50 52 56', {
    baseRgb: '36 38 42',
    aRgb: '68 94 122',
    aPos: '18% 10%',
    aSize: '46% 40%',
    aStrength: '0.48',
    bRgb: '80 68 54',
    bPos: '86% 86%',
    bSize: '34% 30%',
    bStrength: '0.30',
    cRgb: '44 46 50',
    cPos: '52% 100%',
    cSize: '78% 40%',
    cStrength: '0.15',
  }),
  // Ocean 天青：青/teal 光斑
  'ocean-light': scene('195 21% 93%', '196 42% 62%', '35 40% 81%', '203 9% 67%', '250 252 252', {
    baseRgb: '232 238 240',
    aRgb: '120 176 196',
    aPos: '16% 12%',
    aSize: '46% 40%',
    aStrength: '0.45',
    bRgb: '226 210 188',
    bPos: '86% 84%',
    bSize: '34% 30%',
    bStrength: '0.28',
    cRgb: '164 174 180',
    cPos: '50% 100%',
    cSize: '76% 38%',
    cStrength: '0.13',
  }),
  'ocean-dark': scene('192 14% 15%', '191 41% 29%', '33 20% 25%', '195 9% 17%', '48 54 56', {
    baseRgb: '32 40 42',
    aRgb: '44 92 104',
    aPos: '16% 12%',
    aSize: '46% 40%',
    aStrength: '0.47',
    bRgb: '78 66 52',
    bPos: '86% 84%',
    bSize: '34% 30%',
    bStrength: '0.30',
    cRgb: '40 46 48',
    cPos: '50% 100%',
    cSize: '76% 38%',
    cStrength: '0.15',
  }),
  // Moss 青苔：绿光斑
  'forest-light': scene('75 17% 91%', '116 25% 64%', '36 36% 75%', '90 7% 66%', '250 250 246', {
    baseRgb: '234 236 228',
    aRgb: '148 184 142',
    aPos: '16% 12%',
    aSize: '44% 38%',
    aStrength: '0.44',
    bRgb: '218 196 162',
    bPos: '84% 16%',
    bSize: '34% 30%',
    bStrength: '0.28',
    cRgb: '168 174 162',
    cPos: '78% 96%',
    cSize: '42% 34%',
    cStrength: '0.14',
  }),
  'forest-dark': scene('100 8% 15%', '128 23% 29%', '35 25% 26%', '100 7% 18%', '52 54 50', {
    baseRgb: '36 40 34',
    aRgb: '58 92 64',
    aPos: '16% 12%',
    aSize: '44% 38%',
    aStrength: '0.46',
    bRgb: '84 70 50',
    bPos: '84% 16%',
    bSize: '34% 30%',
    bStrength: '0.30',
    cRgb: '44 48 42',
    cPos: '78% 96%',
    cSize: '42% 34%',
    cStrength: '0.16',
  }),
  // Dusk 暖砂
  'slate-light': scene('40 24% 90%', '37 35% 72%', '212 31% 72%', '40 7% 65%', '251 248 244', {
    baseRgb: '236 232 224',
    aRgb: '210 190 158',
    aPos: '22% 8%',
    aSize: '46% 38%',
    aStrength: '0.44',
    bRgb: '162 182 204',
    bPos: '88% 86%',
    bSize: '36% 32%',
    bStrength: '0.30',
    cRgb: '172 168 160',
    cPos: '12% 92%',
    cSize: '38% 36%',
    cStrength: '0.14',
  }),
  'slate-dark': scene('40 9% 14%', '35 27% 30%', '214 19% 28%', '40 7% 17%', '54 51 48', {
    baseRgb: '38 36 32',
    aRgb: '98 80 56',
    aPos: '22% 8%',
    aSize: '46% 38%',
    aStrength: '0.46',
    bRgb: '58 70 86',
    bPos: '88% 86%',
    bSize: '36% 32%',
    bStrength: '0.32',
    cRgb: '46 44 40',
    cPos: '12% 92%',
    cSize: '38% 36%',
    cStrength: '0.16',
  }),
  // 琥珀
  'orange-light': scene('43 29% 91%', '36 55% 65%', '214 29% 74%', '39 11% 65%', '252 249 244', {
    baseRgb: '238 234 224',
    aRgb: '216 176 118',
    aPos: '18% 10%',
    aSize: '44% 38%',
    aStrength: '0.42',
    bRgb: '168 186 210',
    bPos: '86% 82%',
    bSize: '34% 30%',
    bStrength: '0.30',
    cRgb: '176 170 156',
    cPos: '55% 100%',
    cSize: '74% 38%',
    cStrength: '0.13',
  }),
  'orange-dark': scene('36 14% 14%', '36 44% 29%', '215 21% 28%', '45 10% 16%', '54 52 48', {
    baseRgb: '40 36 30',
    aRgb: '108 80 42',
    aPos: '18% 10%',
    aSize: '44% 38%',
    aStrength: '0.44',
    bRgb: '56 68 86',
    bPos: '86% 82%',
    bSize: '34% 30%',
    bStrength: '0.32',
    cRgb: '46 44 38',
    cPos: '55% 100%',
    cSize: '74% 38%',
    cStrength: '0.15',
  }),
  // 紫藤
  'purple-light': scene('252 12% 92%', '249 28% 71%', '38 34% 78%', '240 6% 69%', '251 250 253', {
    baseRgb: '234 233 238',
    aRgb: '168 160 204',
    aPos: '16% 12%',
    aSize: '44% 38%',
    aStrength: '0.42',
    bRgb: '218 204 180',
    bPos: '88% 28%',
    bSize: '34% 32%',
    bStrength: '0.26',
    cRgb: '172 172 182',
    cPos: '50% 100%',
    cSize: '76% 38%',
    cStrength: '0.13',
  }),
  'purple-dark': scene('255 11% 15%', '253 22% 33%', '35 19% 25%', '240 6% 18%', '52 51 56', {
    baseRgb: '36 34 42',
    aRgb: '74 66 104',
    aPos: '16% 12%',
    aSize: '44% 38%',
    aStrength: '0.44',
    bRgb: '76 66 52',
    bPos: '88% 28%',
    bSize: '34% 32%',
    bStrength: '0.28',
    cRgb: '44 44 50',
    cPos: '50% 100%',
    cSize: '76% 38%',
    cStrength: '0.15',
  }),
}

/**
 * Ink + Accent 语义色（对齐 spatial-theme-study theme-tokens.css v4）。
 * RGB 源见原型注释；此处为 HSL 三元组供 shadcn / Tailwind 消费。
 */
interface ThemeInkAccent {
  /** 表面族 hue（极低 sat，不承载主题身份） */
  hue: number
  /** CTA / focus / ring —— 原型 --accent-rgb */
  primary: string
  'primary-foreground': string
  /** 正文主色 —— 原型 --ink-strong-rgb */
  foreground: string
  /** 次要说明 —— 原型 --ink-muted-rgb */
  'muted-foreground': string
  /** 正文次级 / card 字色 —— 原型 --ink-rgb */
  ink: string
  /** 弱标签 —— 原型 --ink-faint-rgb */
  faint: string
}

/**
 * 六主题 × 明暗 ink/accent，直接由原型 RGB 换算：
 * default #48566C / ocean #306068 / forest #44644E /
 * slate #946044 / orange #A07038 / purple #5C5476
 */
const INK_ACCENT: Record<ThemeName, ThemeInkAccent> = {
  'default-light': {
    hue: 60,
    primary: '217 20% 35%',
    'primary-foreground': '0 0% 100%',
    foreground: '216 11% 18%',
    // 原型 ink-muted L≈47% 在浅底上 < AA；压到 L42% 保次要文字对比
    'muted-foreground': '218 8% 42%',
    ink: '220 8% 30%',
    faint: '220 6% 63%',
  },
  'default-dark': {
    hue: 220,
    primary: '218 19% 62%',
    'primary-foreground': '216 17% 11%',
    foreground: '220 14% 91%',
    'muted-foreground': '220 8% 58%',
    ink: '216 11% 82%',
    faint: '220 9% 41%',
  },
  'ocean-light': {
    hue: 195,
    primary: '189 37% 30%',
    'primary-foreground': '0 0% 100%',
    foreground: '195 17% 18%',
    'muted-foreground': '192 10% 40%',
    ink: '192 14% 28%',
    faint: '190 6% 60%',
  },
  'ocean-dark': {
    hue: 192,
    primary: '186 24% 52%',
    'primary-foreground': '180 15% 10%',
    foreground: '180 16% 90%',
    'muted-foreground': '171 6% 55%',
    ink: '170 12% 81%',
    faint: '171 7% 38%',
  },
  'forest-light': {
    hue: 90,
    primary: '139 19% 33%',
    'primary-foreground': '0 0% 100%',
    foreground: '105 8% 19%',
    'muted-foreground': '110 6% 40%',
    ink: '100 8% 29%',
    faint: '100 6% 60%',
  },
  'forest-dark': {
    hue: 100,
    primary: '131 14% 55%',
    'primary-foreground': '120 15% 10%',
    foreground: '100 12% 90%',
    'muted-foreground': '103 6% 54%',
    ink: '108 10% 80%',
    faint: '105 9% 37%',
  },
  'slate-light': {
    hue: 40,
    primary: '21 37% 42%',
    'primary-foreground': '0 0% 100%',
    foreground: '40 7% 18%',
    'muted-foreground': '40 6% 40%',
    ink: '36 7% 28%',
    faint: '40 6% 60%',
  },
  'slate-dark': {
    hue: 40,
    primary: '26 39% 57%',
    'primary-foreground': '26 30% 9%',
    foreground: '40 11% 89%',
    'muted-foreground': '40 5% 53%',
    ink: '36 9% 79%',
    faint: '40 7% 35%',
  },
  'orange-light': {
    hue: 40,
    primary: '32 48% 42%',
    'primary-foreground': '0 0% 100%',
    foreground: '34 15% 18%',
    'muted-foreground': '37 14% 40%',
    ink: '36 14% 28%',
    faint: '37 13% 59%',
  },
  'orange-dark': {
    hue: 36,
    primary: '32 49% 58%',
    'primary-foreground': '27 36% 10%',
    foreground: '40 21% 89%',
    'muted-foreground': '38 9% 53%',
    ink: '37 15% 78%',
    faint: '38 12% 35%',
  },
  'purple-light': {
    hue: 255,
    primary: '254 17% 40%',
    'primary-foreground': '0 0% 100%',
    foreground: '252 10% 20%',
    'muted-foreground': '255 8% 42%',
    ink: '257 9% 30%',
    faint: '257 7% 62%',
  },
  'purple-dark': {
    hue: 255,
    primary: '255 17% 63%',
    'primary-foreground': '255 14% 11%',
    foreground: '260 12% 90%',
    'muted-foreground': '249 6% 55%',
    ink: '252 10% 81%',
    faint: '250 6% 38%',
  },
}

function sceneTokens(
  scene: SceneField
): Pick<
  ThemeColors,
  | 'scene-base'
  | 'scene-ambient-a'
  | 'scene-ambient-b'
  | 'scene-ambient-c'
  | 'scene-base-rgb'
  | 'scene-a-rgb'
  | 'scene-a-pos'
  | 'scene-a-size'
  | 'scene-a-strength'
  | 'scene-b-rgb'
  | 'scene-b-pos'
  | 'scene-b-size'
  | 'scene-b-strength'
  | 'scene-c-rgb'
  | 'scene-c-pos'
  | 'scene-c-size'
  | 'scene-c-strength'
  | 'glass-rgb'
> {
  return {
    'scene-base': scene.base,
    'scene-ambient-a': scene.a,
    'scene-ambient-b': scene.b,
    'scene-ambient-c': scene.c,
    'scene-base-rgb': scene.baseRgb,
    'scene-a-rgb': scene.aRgb,
    'scene-a-pos': scene.aPos,
    'scene-a-size': scene.aSize,
    'scene-a-strength': scene.aStrength,
    'scene-b-rgb': scene.bRgb,
    'scene-b-pos': scene.bPos,
    'scene-b-size': scene.bSize,
    'scene-b-strength': scene.bStrength,
    'scene-c-rgb': scene.cRgb,
    'scene-c-pos': scene.cPos,
    'scene-c-size': scene.cSize,
    'scene-c-strength': scene.cStrength,
    'glass-rgb': scene.glass,
  }
}

/**
 * 浅色近中性表面。
 * 表面 chroma 极低（6–10%），不整页染色；primary/ink 来自原型。
 * Tailwind `accent` 仍是 hover 浅底（非 solid CTA）—— 与原型「active 中性」一致。
 */
function lightPalette(ink: ThemeInkAccent, scene: SceneField): ThemeColors {
  const h = String(ink.hue)
  return {
    // 贴近 scene-base 的极淡底，避免盖住弥散场
    background: `${h} 8% 93%`,
    foreground: ink.foreground,
    muted: `${h} 6% 90%`,
    'muted-foreground': ink['muted-foreground'],
    border: `${h} 6% 86%`,
    input: `${h} 6% 86%`,
    ring: ink.primary,
    primary: ink.primary,
    'primary-foreground': ink['primary-foreground'],
    secondary: `${h} 6% 92%`,
    'secondary-foreground': ink.ink,
    // hover/选中浅底，禁止绑 solid primary（ghost 会整块染色）
    accent: `${h} 8% 90%`,
    'accent-foreground': ink.ink,
    destructive: '0 50% 52%',
    'destructive-foreground': '0 0% 98%',
    // 近无色瓷面，对齐原型 glass-rgb
    card: `${h} 10% 97%`,
    'card-foreground': ink.foreground,
    popover: `${h} 10% 97%`,
    'popover-foreground': ink.foreground,
    dialog: `${h} 12% 98%`,
    'dialog-foreground': ink.foreground,
    tooltip: `${h} 12% 98%`,
    'tooltip-foreground': ink.foreground,
    'tooltip-muted': ink.faint,
    'content-area': `${h} 7% 94%`,
    ...sceneTokens(scene),
  }
}

/** 暗色近中性表面（对齐原型深底 ink + 提亮 accent） */
function darkPalette(ink: ThemeInkAccent, scene: SceneField): ThemeColors {
  const h = String(ink.hue)
  return {
    background: `${h} 10% 15%`,
    foreground: ink.foreground,
    muted: `${h} 8% 19%`,
    'muted-foreground': ink['muted-foreground'],
    border: `${h} 8% 22%`,
    input: `${h} 8% 22%`,
    ring: ink.primary,
    primary: ink.primary,
    'primary-foreground': ink['primary-foreground'],
    secondary: `${h} 8% 18%`,
    'secondary-foreground': ink.ink,
    accent: `${h} 8% 22%`,
    'accent-foreground': ink.ink,
    destructive: '0 50% 58%',
    'destructive-foreground': ink['primary-foreground'],
    card: `${h} 10% 16%`,
    'card-foreground': ink.foreground,
    popover: `${h} 10% 16%`,
    'popover-foreground': ink.foreground,
    dialog: `${h} 10% 18%`,
    'dialog-foreground': ink.foreground,
    tooltip: `${h} 10% 20%`,
    'tooltip-foreground': ink.foreground,
    'tooltip-muted': ink.faint,
    'content-area': `${h} 10% 14%`,
    ...sceneTokens(scene),
  }
}

/**
 * Spatial Lens 色表（对齐 prototypes/spatial-theme-study）
 *
 * primary = 原型 accent（低 chroma 矿物色，非亮矿蓝/霓虹紫）：
 * - default 石墨蓝灰 #48566C
 * - ocean 深青瓷 #306068
 * - forest 深茶绿 #44644E
 * - slate 铜锈棕 #946044
 * - orange 金褐 #A07038
 * - purple 深鸢尾灰 #5C5476（chroma≤0.08）
 */
export const colors: Record<ThemeName, ThemeColors> = {
  'default-light': lightPalette(INK_ACCENT['default-light'], SCENE['default-light']),
  'default-dark': darkPalette(INK_ACCENT['default-dark'], SCENE['default-dark']),

  'ocean-light': lightPalette(INK_ACCENT['ocean-light'], SCENE['ocean-light']),
  'ocean-dark': darkPalette(INK_ACCENT['ocean-dark'], SCENE['ocean-dark']),

  'forest-light': lightPalette(INK_ACCENT['forest-light'], SCENE['forest-light']),
  'forest-dark': darkPalette(INK_ACCENT['forest-dark'], SCENE['forest-dark']),

  'slate-light': lightPalette(INK_ACCENT['slate-light'], SCENE['slate-light']),
  'slate-dark': darkPalette(INK_ACCENT['slate-dark'], SCENE['slate-dark']),

  'orange-light': lightPalette(INK_ACCENT['orange-light'], SCENE['orange-light']),
  'orange-dark': darkPalette(INK_ACCENT['orange-dark'], SCENE['orange-dark']),

  'purple-light': lightPalette(INK_ACCENT['purple-light'], SCENE['purple-light']),
  'purple-dark': darkPalette(INK_ACCENT['purple-dark'], SCENE['purple-dark']),
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
