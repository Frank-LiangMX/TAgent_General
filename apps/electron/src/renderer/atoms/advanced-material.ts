/**
 * 高级材质（玻璃质感）偏好
 *
 * 开启：高透玻璃（backdrop-filter + 环境高光伪元素）
 * 关闭：普通材质（html.material-frosted，适度 blur + 半透明，无伪元素折射）
 */

import { atom } from 'jotai'

import { DEFAULT_ADVANCED_MATERIAL_ENABLED } from '../../types'

/** 是否启用高级材质（高透玻璃） */
export const advancedMaterialEnabledAtom = atom<boolean>(DEFAULT_ADVANCED_MATERIAL_ENABLED)

/** 将材质偏好应用到 DOM */
export function applyAdvancedMaterialToDOM(enabled: boolean): void {
  document.documentElement.classList.toggle('material-frosted', !enabled)
}

/** 从主进程加载并应用 */
export async function initializeAdvancedMaterial(
  setEnabled: (enabled: boolean) => void
): Promise<void> {
  try {
    const settings = await window.electronAPI.getSettings()
    const enabled = settings.advancedMaterialEnabled ?? DEFAULT_ADVANCED_MATERIAL_ENABLED
    setEnabled(enabled)
    applyAdvancedMaterialToDOM(enabled)
  } catch (error) {
    console.error('[高级材质] 初始化失败:', error)
    applyAdvancedMaterialToDOM(DEFAULT_ADVANCED_MATERIAL_ENABLED)
  }
}

/** 更新并持久化 */
export async function updateAdvancedMaterialEnabled(enabled: boolean): Promise<void> {
  applyAdvancedMaterialToDOM(enabled)
  try {
    await window.electronAPI.updateSettings({ advancedMaterialEnabled: enabled })
  } catch (error) {
    console.error('[高级材质] 持久化失败:', error)
  }
}
