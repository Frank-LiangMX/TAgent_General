/**
 * 窗口任务栏图标管理
 *
 * 根据当前主题动态切换 BrowserWindow 的图标（Windows 任务栏 / macOS 标题栏 / Linux）。
 * 与 tray.ts 的托盘图标配合，实现「任务栏图标跟随主题变化」。
 */

import { BrowserWindow, nativeImage } from 'electron'

import type { ThemeMode, ThemeStyle } from '../../types'

import { getThemeIconCandidatePaths, getThemeIconPath, resolveLogoKey } from './theme-icon-resolver'

export function updateWindowIcon(
  win: BrowserWindow,
  mode: ThemeMode,
  style: ThemeStyle | undefined,
  systemIsDark: boolean
): void {
  if (win.isDestroyed()) return

  const key = resolveLogoKey(mode, style, systemIsDark)
  const iconPath = getThemeIconPath(key)
  if (!iconPath) {
    console.warn('[图标] 主题窗口图标缺失，已检查路径:', getThemeIconCandidatePaths(key))
    return
  }

  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    console.warn('[图标] 主题窗口图标加载失败:', iconPath)
    return
  }

  win.setIcon(image)
}
