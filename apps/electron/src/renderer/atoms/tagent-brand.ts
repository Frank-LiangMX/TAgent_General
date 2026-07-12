/**
 * TAgent 强调色（兼容旧 --tagent-brand 变量名）
 *
 * 产品决策：取消独立「签名色」，一律跟随当前主题 --primary。
 * 本模块保留 atom/API 以免调用方炸掉，但 DOM 只清掉内联覆盖，
 * 让 CSS 中的 `hsl(var(--primary))` 生效。
 */

import { atom } from 'jotai'

import { DEFAULT_TAGENT_BRAND, type TAgentBrand } from '../../types'

/** @deprecated 已废弃独立品牌色，保留类型兼容 */
export const tagentBrandAtom = atom<TAgentBrand>(DEFAULT_TAGENT_BRAND)

/**
 * 清除可能写在 html 上的旧签名色内联变量，强制走主题 primary。
 */
export function applyTAgentBrandToDOM(_brand?: TAgentBrand): void {
  const root = document.documentElement
  root.style.removeProperty('--tagent-brand')
  root.style.removeProperty('--tagent-brand-soft')
  root.style.removeProperty('--tagent-brand-glow')
  root.style.removeProperty('--tagent-brand-foreground')
}

/** 初始化：清掉旧内联签名色 */
export async function initializeTAgentBrand(setBrand: (brand: TAgentBrand) => void): Promise<void> {
  try {
    const settings = await window.electronAPI.getSettings()
    const brand = settings.tagentBrand ?? DEFAULT_TAGENT_BRAND
    setBrand(brand)
  } catch (error) {
    console.error('[TAgent强调色] 初始化失败:', error)
  }
  applyTAgentBrandToDOM()
}

/**
 * 兼容旧调用：不再持久化独立签名色，仅确保 DOM 走 primary。
 */
export async function updateTAgentBrand(brand: TAgentBrand): Promise<void> {
  applyTAgentBrandToDOM(brand)
}
