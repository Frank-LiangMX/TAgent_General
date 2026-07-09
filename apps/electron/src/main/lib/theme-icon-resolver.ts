/**
 * 主题图标解析器
 *
 * 从当前主题设置（ThemeMode + ThemeStyle + 系统明暗）解析出图标 key，
 * 并定位到 resources/theme-icons/ 下的 PNG 文件。
 *
 * 逻辑与 titlebar-overlay.ts 的颜色解析保持一致，确保图标和标题栏颜色同步切换。
 * 生产包里若 extraResources 落位发生差异，会按候选路径回退，避免静默退回旧 exe 图标。
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { app } from 'electron'

import type { ThemeMode, ThemeStyle } from '../../types'

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

export function resolveLogoKey(
  mode: ThemeMode,
  style: ThemeStyle | undefined,
  systemIsDark: boolean
): LogoKey {
  if (mode === 'special' && style && style !== 'default') {
    // Neumorph is currently a settings-page material experiment; reuse default light/dark icons.
    if (style === 'neumorph-light') {
      return 'default-light'
    }
    if (style === 'neumorph-dark') {
      return 'default-dark'
    }
    return style as LogoKey
  }
  if (mode === 'light') {
    return 'default-light'
  }
  if (mode === 'dark') {
    return 'default-dark'
  }
  return systemIsDark ? 'default-dark' : 'default-light'
}

export function getThemeIconCandidatePaths(
  key: LogoKey
): Array<{ path: string; exists: boolean }> {
  const relativePath = join('theme-icons', `tagent-${key}.png`)
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, relativePath),
        join(process.resourcesPath, 'resources', relativePath),
        join(app.getAppPath(), 'dist', 'resources', relativePath),
        join(app.getAppPath(), 'resources', relativePath),
      ]
    : [join(__dirname, 'resources', relativePath)]

  return candidates.map((path) => ({ path, exists: existsSync(path) }))
}

export function getThemeIconPath(key: LogoKey): string {
  return getThemeIconCandidatePaths(key).find((candidate) => candidate.exists)?.path ?? ''
}

export function resolveNativeThemeSource(
  mode: ThemeMode,
  style: ThemeStyle | undefined
): 'light' | 'dark' | 'system' {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  if (mode === 'system') return 'system'
  if (style && style !== 'default') {
    return style.endsWith('-light') ? 'light' : 'dark'
  }
  return 'system'
}
