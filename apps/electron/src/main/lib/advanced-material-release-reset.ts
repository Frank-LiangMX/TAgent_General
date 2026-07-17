/**
 * 打包版高级材质一次性回退
 *
 * 高级材质尚未完成时：升级用户首次打开若仍开着 glass/soft，
 * 统一回到默认材质 + 浅色主题；写 flag 后不再干预。
 */

import type { AppSettings } from '../../types'

export interface AdvancedMaterialReleaseResetResult {
  /** 是否需要写入 settings.json */
  changed: boolean
  /** 迁移后的完整设置 */
  settings: AppSettings
  /** 是否实际回退了高级材质 / 主题 */
  resetApplied: boolean
}

/** 判断设置是否处于「高级材质开启」态（含旧 neumorph 风格） */
export function hadAdvancedMaterialEnabled(settings: Partial<AppSettings>): boolean {
  if (settings.advancedMaterialEnabled === true) return true
  if (settings.advancedMaterialMode === 'glass' || settings.advancedMaterialMode === 'soft') {
    return true
  }
  if (settings.themeStyle === 'neumorph-light' || settings.themeStyle === 'neumorph-dark') {
    return true
  }
  return false
}

/**
 * 纯函数：打包版一次性迁移。
 * - 非打包 / 已打过标记 → 原样返回
 * - 曾开高级材质 → frosted + light + default style，并打标记
 * - 未开高级材质 → 仅打标记，不改主题
 */
export function applyAdvancedMaterialReleaseReset(
  settings: AppSettings,
  isPackaged: boolean
): AdvancedMaterialReleaseResetResult {
  if (!isPackaged || settings.advancedMaterialReleaseResetV1) {
    return { changed: false, settings, resetApplied: false }
  }

  const shouldReset = hadAdvancedMaterialEnabled(settings)
  const next: AppSettings = {
    ...settings,
    advancedMaterialReleaseResetV1: true,
  }

  if (shouldReset) {
    next.advancedMaterialEnabled = false
    next.advancedMaterialMode = 'frosted'
    next.themeMode = 'light'
    next.themeStyle = 'default'
  }

  return {
    changed: true,
    settings: next,
    resetApplied: shouldReset,
  }
}
