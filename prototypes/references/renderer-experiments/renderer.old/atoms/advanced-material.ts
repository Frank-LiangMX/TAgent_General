/**
 * 高级材质偏好
 *
 * - glass: 高透玻璃
 * - frosted: 低透磨砂玻璃
 * - neumorph: 轻拟态
 */

import { atom } from 'jotai'

import {
  DEFAULT_ADVANCED_MATERIAL_ENABLED,
  DEFAULT_ADVANCED_MATERIAL_MODE,
  type AdvancedMaterialMode,
  type AppSettings,
} from '../../types'

export const advancedMaterialModeAtom = atom<AdvancedMaterialMode>(DEFAULT_ADVANCED_MATERIAL_MODE)

function isAdvancedMaterialMode(value: unknown): value is AdvancedMaterialMode {
  return value === 'glass' || value === 'frosted' || value === 'neumorph'
}

function resolveAdvancedMaterialMode(settings: Partial<AppSettings>): AdvancedMaterialMode {
  if (isAdvancedMaterialMode(settings.advancedMaterialMode)) {
    return settings.advancedMaterialMode
  }

  if (settings.themeStyle === 'neumorph-light' || settings.themeStyle === 'neumorph-dark') {
    return 'neumorph'
  }

  if (typeof settings.advancedMaterialEnabled === 'boolean') {
    return settings.advancedMaterialEnabled ? 'glass' : 'frosted'
  }

  return DEFAULT_ADVANCED_MATERIAL_MODE
}

function syncNeumorphThemeClass(mode: AdvancedMaterialMode): void {
  const html = document.documentElement
  html.classList.remove('theme-neumorph-light', 'theme-neumorph-dark')

  if (mode !== 'neumorph') return

  html.classList.add(
    html.classList.contains('dark') ? 'theme-neumorph-dark' : 'theme-neumorph-light'
  )
}

export function applyAdvancedMaterialToDOM(mode: AdvancedMaterialMode): void {
  const html = document.documentElement

  html.classList.toggle('material-frosted', mode === 'frosted')
  html.classList.toggle('material-neumorph', mode === 'neumorph')
  syncNeumorphThemeClass(mode)
}

export async function initializeAdvancedMaterial(
  setMode: (mode: AdvancedMaterialMode) => void
): Promise<void> {
  try {
    const settings = await window.electronAPI.getSettings()
    const mode = resolveAdvancedMaterialMode(settings)
    setMode(mode)
    applyAdvancedMaterialToDOM(mode)
  } catch (error) {
    console.error('[高级材质] 初始化失败', error)
    applyAdvancedMaterialToDOM(DEFAULT_ADVANCED_MATERIAL_MODE)
  }
}

export async function updateAdvancedMaterialMode(mode: AdvancedMaterialMode): Promise<void> {
  applyAdvancedMaterialToDOM(mode)
  try {
    await window.electronAPI.updateSettings({
      advancedMaterialMode: mode,
      advancedMaterialEnabled: mode === 'glass',
    })
  } catch (error) {
    console.error('[高级材质] 持久化失败', error)
  }
}

export function getLegacyAdvancedMaterialDefault(): boolean {
  return DEFAULT_ADVANCED_MATERIAL_ENABLED
}
