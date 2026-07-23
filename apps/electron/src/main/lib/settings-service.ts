/**
 * 应用设置服务
 *
 * 管理应用设置（主题模式等）的读写。
 * 存储在 ~/.tagent/settings.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

import {
  DEFAULT_ADVANCED_MATERIAL_MODE,
  DEFAULT_ASSISTANT_PRESENCE_MOTION,
  DEFAULT_ASSISTANT_PRESENCE_STYLE,
  DEFAULT_THEME_MODE,
  normalizeAssistantPresenceMotion,
  normalizeAssistantPresenceStyle,
} from '../../types'

import type { AppSettings } from '../../types'
import { applyAdvancedMaterialReleaseReset } from './advanced-material-release-reset'
import { getSettingsPath } from './config-paths'

/** Resolve the streaming flag while keeping older settings files compatible. */
export function isAgentStreamingEnabled(settings: Pick<AppSettings, 'agentStreaming'>): boolean {
  return settings.agentStreaming ?? true
}

function resolveAdvancedMaterialMode(
  data: Partial<AppSettings>
): AppSettings['advancedMaterialMode'] {
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

function createDefaultSettings(): AppSettings {
  return {
    themeMode: DEFAULT_THEME_MODE,
    advancedMaterialMode: DEFAULT_ADVANCED_MATERIAL_MODE,
    assistantPresenceMotion: DEFAULT_ASSISTANT_PRESENCE_MOTION,
    assistantPresenceStyle: DEFAULT_ASSISTANT_PRESENCE_STYLE,
    onboardingCompleted: false,
    environmentCheckSkipped: false,
    notificationsEnabled: true,
    agentStreaming: true,
    feishuSessionMirror: { mode: 'off' },
    subagentEagerness: 'conservative',
    showTokenPlanWarning: true,
  }
}

function normalizeSettings(data: Partial<AppSettings>): AppSettings {
  return {
    ...data,
    themeMode: data.themeMode || DEFAULT_THEME_MODE,
    advancedMaterialMode: resolveAdvancedMaterialMode(data),
    assistantPresenceMotion: normalizeAssistantPresenceMotion(data.assistantPresenceMotion),
    assistantPresenceStyle: normalizeAssistantPresenceStyle(data.assistantPresenceStyle),
    onboardingCompleted: data.onboardingCompleted ?? false,
    environmentCheckSkipped: data.environmentCheckSkipped ?? false,
    notificationsEnabled: data.notificationsEnabled ?? true,
    agentStreaming: data.agentStreaming ?? true,
    feishuSessionMirror: data.feishuSessionMirror ?? { mode: 'off' },
    showTokenPlanWarning: data.showTokenPlanWarning ?? true,
  }
}

/** 当前是否为 Electron 打包正式版（测试 / 非 Electron 环境视为非打包） */
function isPackagedApp(): boolean {
  try {
    const { app } = require('electron') as { app: { isPackaged: boolean } }
    return Boolean(app.isPackaged)
  } catch {
    return false
  }
}

function writeSettingsFile(settings: AppSettings): void {
  const filePath = getSettingsPath()
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
}

/**
 * 从磁盘读取并规范化设置（不做一次性迁移，供内部读写复用）
 */
function readSettingsFromDisk(): AppSettings {
  const filePath = getSettingsPath()

  if (!existsSync(filePath)) {
    return createDefaultSettings()
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as Partial<AppSettings>
    return normalizeSettings(data)
  } catch (error) {
    console.error('[设置] 读取失败:', error)
    return createDefaultSettings()
  }
}

/**
 * 打包版一次性：高级材质用户回退默认材质 + 浅色主题
 */
function ensureAdvancedMaterialReleaseReset(settings: AppSettings): AppSettings {
  const result = applyAdvancedMaterialReleaseReset(settings, isPackagedApp())
  if (!result.changed) return settings

  try {
    writeSettingsFile(result.settings)
    if (result.resetApplied) {
      console.log('[设置] 打包版高级材质未完成：已回退到默认材质 + 浅色主题')
    } else {
      console.log('[设置] 打包版高级材质回退标记已写入（无需改主题）')
    }
  } catch (error) {
    console.error('[设置] 写入高级材质回退标记失败:', error)
    return settings
  }

  return result.settings
}

/**
 * 获取应用设置
 *
 * 如果文件不存在，返回默认设置。
 * 打包版会执行高级材质一次性回退迁移。
 */
export function getSettings(): AppSettings {
  return ensureAdvancedMaterialReleaseReset(readSettingsFromDisk())
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

  try {
    writeSettingsFile(updated)
    console.log('[设置] 已更新 keys:', Object.keys(updates).join(', '))
  } catch (error) {
    console.error('[设置] 写入失败:', error)
    throw new Error('写入应用设置失败')
  }

  return updated
}
