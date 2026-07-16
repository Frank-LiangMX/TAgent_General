/**
 * 高级材质偏好
 *
 * - glass: 高透玻璃
 * - frosted: 磨砂玻璃（默认，开关关闭时）
 * - soft: 轻拟态
 *
 * 开关逻辑：
 * - 关闭时：强制 frosted
 * - 打开时：可选 glass 或 soft
 */

import { atom } from 'jotai'

import {
  DEFAULT_ADVANCED_MATERIAL_ENABLED,
  DEFAULT_ADVANCED_MATERIAL_ON_MODE,
  type AdvancedMaterialMode,
  type AdvancedMaterialOnMode,
  type AppSettings,
} from '../../types'

/** 高级材质开关状态（false = 磨砂玻璃，true = 可选 glass/soft） */
export const advancedMaterialEnabledAtom = atom<boolean>(DEFAULT_ADVANCED_MATERIAL_ENABLED)

/** 高级材质开关打开时的材质选择（glass 或 soft） */
export const advancedMaterialOnModeAtom = atom<AdvancedMaterialOnMode>(
  DEFAULT_ADVANCED_MATERIAL_ON_MODE
)

/**
 * 派生 atom：当前实际生效的材质模式
 * - enabled = false → frosted（磨砂玻璃）
 * - enabled = true → onMode 的值（glass 或 soft）
 */
export const advancedMaterialModeAtom = atom<AdvancedMaterialMode>((get) => {
  const enabled = get(advancedMaterialEnabledAtom)
  if (!enabled) return 'frosted'
  return get(advancedMaterialOnModeAtom)
})

function isAdvancedMaterialMode(value: unknown): value is AdvancedMaterialMode {
  return value === 'glass' || value === 'frosted' || value === 'soft'
}

function isAdvancedMaterialOnMode(value: unknown): value is AdvancedMaterialOnMode {
  return value === 'glass' || value === 'soft'
}

/**
 * 从设置解析材质状态
 * - 开关关闭 → 强制 frosted
 * - 开关打开 → 使用用户选择的模式（glass 或 soft）
 */
function resolveAdvancedMaterialState(settings: Partial<AppSettings>): {
  enabled: boolean
  onMode: AdvancedMaterialOnMode
  mode: AdvancedMaterialMode
} {
  const enabled =
    typeof settings.advancedMaterialEnabled === 'boolean'
      ? settings.advancedMaterialEnabled
      : DEFAULT_ADVANCED_MATERIAL_ENABLED

  // 开关关闭时，强制磨砂玻璃
  if (!enabled) {
    return { enabled: false, onMode: 'glass', mode: 'frosted' }
  }

  // 开关打开时，解析用户选择的模式
  let onMode: AdvancedMaterialOnMode = 'glass'

  // 优先使用新的 advancedMaterialOnMode 字段
  if (isAdvancedMaterialOnMode(settings.advancedMaterialOnMode)) {
    onMode = settings.advancedMaterialOnMode
  }
  // 兼容旧的 advancedMaterialMode 字段
  else if (isAdvancedMaterialMode(settings.advancedMaterialMode)) {
    if (settings.advancedMaterialMode !== 'frosted') {
      onMode = settings.advancedMaterialMode
    }
  }
  // 兼容旧版主题风格
  else if (settings.themeStyle === 'neumorph-light' || settings.themeStyle === 'neumorph-dark') {
    onMode = 'soft'
  }

  return { enabled: true, onMode, mode: onMode }
}

const MATERIAL_CACHE_KEY = 'tagent-material-mode'

/**
 * 应用材质到 DOM
 * - 设置 data-material 属性（唯一权威，见 ADR-0005）
 * - material-frosted class 仅兼容 globals 旧选择器；新样式勿依赖
 * - localStorage 缓存供 index.html 首屏防闪
 */
export function applyAdvancedMaterialToDOM(mode: AdvancedMaterialMode): void {
  const html = document.documentElement

  html.setAttribute('data-material', mode)
  html.classList.toggle('material-frosted', mode === 'frosted')

  try {
    localStorage.setItem(MATERIAL_CACHE_KEY, mode)
  } catch {
    // 忽略缓存失败
  }
}

/**
 * 初始化材质状态
 * mode 由 enabled + onMode 派生，无需单独 setMode
 */
export async function initializeAdvancedMaterial(
  setEnabled: (enabled: boolean) => void,
  setOnMode: (onMode: AdvancedMaterialOnMode) => void
): Promise<void> {
  try {
    const settings = await window.electronAPI.getSettings()
    const { enabled, onMode, mode } = resolveAdvancedMaterialState(settings)
    setEnabled(enabled)
    setOnMode(onMode)
    applyAdvancedMaterialToDOM(mode)
  } catch (error) {
    console.error('[高级材质] 初始化失败', error)
    applyAdvancedMaterialToDOM('frosted')
  }
}

/**
 * 更新材质开关状态
 * @param enabled 是否开启高级材质
 * @param onMode 开启时使用的模式（默认 glass）；关闭时强制 frosted
 */
export async function updateAdvancedMaterialEnabled(
  enabled: boolean,
  onMode: AdvancedMaterialOnMode = 'glass'
): Promise<void> {
  const mode: AdvancedMaterialMode = enabled ? onMode : 'frosted'
  applyAdvancedMaterialToDOM(mode)
  try {
    await window.electronAPI.updateSettings({
      advancedMaterialEnabled: enabled,
    })
  } catch (error) {
    console.error('[高级材质] 持久化开关状态失败', error)
  }
}

/**
 * 更新材质模式（仅开关开启时调用）
 */
export async function updateAdvancedMaterialOnMode(onMode: AdvancedMaterialOnMode): Promise<void> {
  applyAdvancedMaterialToDOM(onMode)
  try {
    await window.electronAPI.updateSettings({
      advancedMaterialOnMode: onMode,
      advancedMaterialEnabled: true,
    })
  } catch (error) {
    console.error('[高级材质] 持久化失败', error)
  }
}
