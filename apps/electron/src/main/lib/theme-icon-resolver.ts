/**
 * 主题图标解析器
 *
 * 从当前主题设置（ThemeMode + ThemeStyle + 系统明暗）解析出图标 key，
 * 并定位到 resources/theme-icons/ 下的 PNG 文件。
 *
 * 逻辑与 titlebar-overlay.ts 的颜色解析保持一致，确保图标和标题栏颜色同步切换。
 */

import { join } from 'node:path'

import { app } from 'electron'

import type { ThemeMode, ThemeStyle } from '../../types'

/**
 * 主题图标 key（12 个变体）
 *
 * 对应 resources/theme-icons/tagent-{key}.png 文件。
 */
export type LogoKey =
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
 * 从主题设置解析图标 key
 *
 * 解析规则：
 * - special + 非 default 风格 → 直接用 themeStyle（如 'ocean-light'）
 * - special + default/undefined → 按系统明暗 fallback（与 system 模式一致）
 * - system → 跟随系统明暗
 * - dark → 'default-dark'
 * - light → 'default-light'
 */
export function resolveLogoKey(
  mode: ThemeMode,
  style: ThemeStyle | undefined,
  systemIsDark: boolean
): LogoKey {
  if (mode === 'special' && style && style !== 'default') {
    return style as LogoKey
  }
  // system / special+default / special+undefined → 按系统明暗
  if (mode === 'light') {
    return 'default-light'
  }
  if (mode === 'dark') {
    return 'default-dark'
  }
  return systemIsDark ? 'default-dark' : 'default-light'
}

/**
 * 获取主题图标文件路径
 *
 * dev: __dirname/resources/theme-icons/tagent-{key}.png
 * prod: process.resourcesPath/theme-icons/tagent-{key}.png
 */
export function getThemeIconPath(key: LogoKey): string {
  const resourcesDir = app.isPackaged ? process.resourcesPath : join(__dirname, 'resources')
  return join(resourcesDir, 'theme-icons', `tagent-${key}.png`)
}

/**
 * 解析应用主题对应的 nativeTheme.themeSource 值
 *
 * 用于让 Electron 原生菜单（托盘菜单、应用菜单、系统对话框）跟随应用主题明暗。
 * 未设置时原生菜单跟随系统主题，与应用主题不同步。
 *
 * - light → 'light'
 * - dark → 'dark'
 * - system → 'system'（跟随系统）
 * - special + 非 default 风格 → 按风格后缀（-light/-dark）
 * - special + default/undefined → 'system'（跟随系统）
 */
export function resolveNativeThemeSource(
  mode: ThemeMode,
  style: ThemeStyle | undefined
): 'light' | 'dark' | 'system' {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  if (mode === 'system') return 'system'
  // special + 非 default 风格 → 按后缀
  if (style && style !== 'default') {
    return style.endsWith('-light') ? 'light' : 'dark'
  }
  // special + default/undefined → 跟随系统
  return 'system'
}
