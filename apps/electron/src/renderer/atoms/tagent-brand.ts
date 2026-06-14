/**
 * TAgent 品牌色状态原子
 *
 * 5 种品牌色（青/紫/橙/森/晶）对应一组 CSS 变量
 * （--tagent-brand / --tagent-brand-soft / --tagent-brand-glow /
 *  --tagent-brand-foreground），仅影响品牌签名、风格卡片、装饰高亮，
 * 不动主题 token（--primary 等）。
 *
 * 持久化到 ~/.tagent/settings.json。
 */

import { atom } from 'jotai'

import { DEFAULT_TAGENT_BRAND, type TAgentBrand } from '../../types'

/** 品牌色到 CSS HSL 值的映射 */
const BRAND_HSL: Record<
  TAgentBrand,
  { base: string; soft: string; glow: string; foreground: string }
> = {
  cyan: {
    base: 'hsl(195 90% 55%)',
    soft: 'hsl(195 90% 55% / 0.15)',
    glow: 'hsl(195 90% 55% / 0.45)',
    foreground: 'hsl(195 30% 95%)',
  },
  violet: {
    base: 'hsl(265 85% 65%)',
    soft: 'hsl(265 85% 65% / 0.15)',
    glow: 'hsl(265 85% 65% / 0.45)',
    foreground: 'hsl(265 30% 95%)',
  },
  amber: {
    base: 'hsl(28 95% 55%)',
    soft: 'hsl(28 95% 55% / 0.15)',
    glow: 'hsl(28 95% 55% / 0.45)',
    foreground: 'hsl(28 35% 12%)',
  },
  forest: {
    base: 'hsl(150 60% 45%)',
    soft: 'hsl(150 60% 45% / 0.15)',
    glow: 'hsl(150 60% 45% / 0.45)',
    foreground: 'hsl(150 25% 10%)',
  },
  slate: {
    base: 'hsl(220 15% 55%)',
    soft: 'hsl(220 15% 55% / 0.15)',
    glow: 'hsl(220 15% 55% / 0.45)',
    foreground: 'hsl(220 15% 12%)',
  },
}

/** 当前 TAgent 品牌色 */
export const tagentBrandAtom = atom<TAgentBrand>(DEFAULT_TAGENT_BRAND)

/** 将品牌色应用到 :root CSS 变量 */
export function applyTAgentBrandToDOM(brand: TAgentBrand): void {
  const root = document.documentElement
  const tokens = BRAND_HSL[brand]
  root.style.setProperty('--tagent-brand', tokens.base)
  root.style.setProperty('--tagent-brand-soft', tokens.soft)
  root.style.setProperty('--tagent-brand-glow', tokens.glow)
  root.style.setProperty('--tagent-brand-foreground', tokens.foreground)
}

/** 从主进程加载并应用 */
export async function initializeTAgentBrand(
  setBrand: (brand: TAgentBrand) => void,
): Promise<void> {
  try {
    const settings = await window.electronAPI.getSettings()
    const brand = settings.tagentBrand ?? DEFAULT_TAGENT_BRAND
    setBrand(brand)
    applyTAgentBrandToDOM(brand)
  } catch (error) {
    console.error('[TAgent品牌色] 初始化失败:', error)
    applyTAgentBrandToDOM(DEFAULT_TAGENT_BRAND)
  }
}

/** 更新并持久化 */
export async function updateTAgentBrand(brand: TAgentBrand): Promise<void> {
  applyTAgentBrandToDOM(brand)
  try {
    await window.electronAPI.updateSettings({ tagentBrand: brand })
  } catch (error) {
    console.error('[TAgent品牌色] 持久化失败:', error)
  }
}
