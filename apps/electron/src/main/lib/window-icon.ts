/**
 * 窗口任务栏图标管理
 *
 * 根据当前主题动态切换 BrowserWindow 的图标（Windows 任务栏 / macOS 标题栏 / Linux）。
 * 与 tray.ts 的托盘图标配合，实现「任务栏图标跟随主题变化」。
 */

import { existsSync } from 'node:fs'

import { BrowserWindow, nativeImage } from 'electron'

import type { ThemeMode, ThemeStyle } from '../../types'

import { getThemeIconPath, resolveLogoKey } from './theme-icon-resolver'

/**
 * 更新窗口任务栏图标以匹配当前主题
 *
 * 所有平台（含 macOS 窗口标题栏图标）都切换为对应主题的彩色图标。
 * 图标文件缺失或加载失败时静默 fallback（保留 BrowserWindow 创建时的默认 icon）。
 */
export function updateWindowIcon(
  win: BrowserWindow,
  mode: ThemeMode,
  style: ThemeStyle | undefined,
  systemIsDark: boolean
): void {
  if (win.isDestroyed()) return

  const key = resolveLogoKey(mode, style, systemIsDark)
  const iconPath = getThemeIconPath(key)
  if (!existsSync(iconPath)) {
    console.warn('[图标] 主题图标文件缺失:', iconPath)
    return
  }

  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    console.warn('[图标] 主题图标加载失败:', iconPath)
    return
  }

  win.setIcon(image)
}
