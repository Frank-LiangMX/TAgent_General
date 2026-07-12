/**
 * 应用设置服务
 *
 * 管理应用设置（主题模式等）的读写。
 * 存储在 ~/.tagent/settings.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

import { DEFAULT_THEME_MODE, DEFAULT_ADVANCED_MATERIAL_MODE } from '../../types'

import type { AppSettings } from '../../types'
import { getSettingsPath } from './config-paths'

function resolveAdvancedMaterialMode(data: Partial<AppSettings>): AppSettings['advancedMaterialMode'] {
  if (
    data.advancedMaterialMode === 'glass' ||
    data.advancedMaterialMode === 'frosted' ||
    data.advancedMaterialMode === 'soft'
  ) {
    return data.advancedMaterialMode
  }

  if (data.themeStyle === 'neumorph-light' || data.themeStyle === 'neumorph-dark') {
    return 'soft'
  }

  if (typeof data.advancedMaterialEnabled === 'boolean') {
    return data.advancedMaterialEnabled ? 'glass' : 'frosted'
  }

  return DEFAULT_ADVANCED_MATERIAL_MODE
}

/**
 * 获取应用设置
 *
 * 如果文件不存在，返回默认设置。
 */
export function getSettings(): AppSettings {
  const filePath = getSettingsPath()

  if (!existsSync(filePath)) {
    return {
      themeMode: DEFAULT_THEME_MODE,
      advancedMaterialMode: DEFAULT_ADVANCED_MATERIAL_MODE,
      onboardingCompleted: false,
      environmentCheckSkipped: false,
      notificationsEnabled: true,
      feishuSessionMirror: { mode: 'off' },
      subagentEagerness: 'conservative',
      showTokenPlanWarning: true,
    }
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...data,
      themeMode: data.themeMode || DEFAULT_THEME_MODE,
      advancedMaterialMode: resolveAdvancedMaterialMode(data),
      onboardingCompleted: data.onboardingCompleted ?? false,
      environmentCheckSkipped: data.environmentCheckSkipped ?? false,
      notificationsEnabled: data.notificationsEnabled ?? true,
      feishuSessionMirror: data.feishuSessionMirror ?? { mode: 'off' },
      showTokenPlanWarning: data.showTokenPlanWarning ?? true,
    }
  } catch (error) {
    console.error('[设置] 读取失败:', error)
    return {
      themeMode: DEFAULT_THEME_MODE,
      advancedMaterialMode: DEFAULT_ADVANCED_MATERIAL_MODE,
      onboardingCompleted: false,
      environmentCheckSkipped: false,
      notificationsEnabled: true,
      feishuSessionMirror: { mode: 'off' },
      subagentEagerness: 'conservative',
      showTokenPlanWarning: true,
    }
  }
}

/**
 * 更新应用设置
 *
 * 合并更新字段并写入文件。
 */
export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated: AppSettings = {
    ...current,
    ...updates,
  }

  const filePath = getSettingsPath()

  try {
    writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8')
    console.log('[设置] 已更新 keys:', Object.keys(updates).join(', '))
  } catch (error) {
    console.error('[设置] 写入失败:', error)
    throw new Error('写入应用设置失败')
  }

  return updated
}
