import { atom } from 'jotai'

import type { ThemeMode, ThemeStyle } from '../../types'

const THEME_CACHE_KEY = 'tagent-theme-mode'
const THEME_STYLE_CACHE_KEY = 'tagent-theme-style'

function getCachedThemeMode(): ThemeMode {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY)
    if (cached === 'light' || cached === 'dark' || cached === 'system' || cached === 'special') {
      return cached
    }
  } catch {
    // Ignore cache failures.
  }

  return 'light'
}

function getCachedThemeStyle(): ThemeStyle {
  try {
    const cached = localStorage.getItem(THEME_STYLE_CACHE_KEY)
    if (
      cached === 'default' ||
      cached === 'ocean-light' ||
      cached === 'ocean-dark' ||
      cached === 'forest-light' ||
      cached === 'forest-dark' ||
      cached === 'slate-light' ||
      cached === 'slate-dark' ||
      cached === 'orange-light' ||
      cached === 'orange-dark' ||
      cached === 'purple-light' ||
      cached === 'purple-dark'
    ) {
      return cached
    }
  } catch {
    // Ignore cache failures.
  }

  return 'default'
}

function cacheThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_CACHE_KEY, mode)
  } catch {
    // Ignore cache failures.
  }
}

function cacheThemeStyle(style: ThemeStyle): void {
  try {
    localStorage.setItem(THEME_STYLE_CACHE_KEY, style)
  } catch {
    // Ignore cache failures.
  }
}

export const themeModeAtom = atom<ThemeMode>(getCachedThemeMode())
export const themeStyleAtom = atom<ThemeStyle>(getCachedThemeStyle())
export const systemIsDarkAtom = atom<boolean>(true)

export const resolvedThemeAtom = atom<'light' | 'dark'>((get) => {
  const mode = get(themeModeAtom)
  if (mode === 'system') {
    return get(systemIsDarkAtom) ? 'dark' : 'light'
  }
  if (mode === 'special') {
    return get(themeStyleAtom).endsWith('-light') ? 'light' : 'dark'
  }
  return mode
})

export const themeLogoKeyAtom = atom<string>((get) => {
  const mode = get(themeModeAtom)
  if (mode === 'special') {
    return get(themeStyleAtom)
  }
  return get(resolvedThemeAtom) === 'dark' ? 'default-dark' : 'default-light'
})

const ALL_THEME_STYLE_CLASSES = [
  'theme-ocean-light',
  'theme-ocean-dark',
  'theme-forest-light',
  'theme-forest-dark',
  'theme-slate-light',
  'theme-slate-dark',
  'theme-orange-light',
  'theme-orange-dark',
  'theme-purple-light',
  'theme-purple-dark',
] as const

function normalizeLegacyNeumorphTheme(
  themeMode: ThemeMode,
  themeStyle: ThemeStyle | undefined
): {
  mode: ThemeMode
  style: ThemeStyle
  migrated: boolean
} {
  if (themeStyle !== 'neumorph-light' && themeStyle !== 'neumorph-dark') {
    return {
      mode: themeMode,
      style: themeStyle ?? 'default',
      migrated: false,
    }
  }

  return {
    mode: themeMode === 'special' ? (themeStyle === 'neumorph-dark' ? 'dark' : 'light') : themeMode,
    style: 'default',
    migrated: true,
  }
}

export function applyThemeToDOM(
  themeMode: ThemeMode,
  themeStyle: ThemeStyle = 'default',
  systemIsDark: boolean = true
): void {
  const html = document.documentElement

  let targetStyleClass: string | null = null
  let targetIsDark: boolean

  if (themeMode === 'special' && themeStyle !== 'default') {
    targetStyleClass = `theme-${themeStyle}`
    targetIsDark = themeStyle.endsWith('-dark')
  } else if (themeMode === 'system') {
    targetIsDark = systemIsDark
  } else {
    targetIsDark = themeMode === 'dark'
  }

  const currentIsDark = html.classList.contains('dark')
  const currentStyleClass = ALL_THEME_STYLE_CLASSES.find((c) => html.classList.contains(c)) ?? null

  if (currentIsDark === targetIsDark && currentStyleClass === targetStyleClass) {
    return
  }

  if (currentStyleClass !== targetStyleClass) {
    if (currentStyleClass) {
      html.classList.remove(currentStyleClass)
    }
    if (targetStyleClass) {
      html.classList.add(targetStyleClass)
    }
  }

  if (currentIsDark !== targetIsDark) {
    html.classList.toggle('dark', targetIsDark)
  }
}

export async function initializeTheme(
  setThemeMode: (mode: ThemeMode) => void,
  setSystemIsDark: (isDark: boolean) => void,
  setThemeStyle?: (style: ThemeStyle) => void
): Promise<() => void> {
  const settings = await window.electronAPI.getSettings()
  const normalized = normalizeLegacyNeumorphTheme(settings.themeMode, settings.themeStyle)

  setThemeMode(normalized.mode)
  cacheThemeMode(normalized.mode)

  if (setThemeStyle) {
    setThemeStyle(normalized.style)
    cacheThemeStyle(normalized.style)
  }

  if (normalized.migrated) {
    void window.electronAPI.updateSettings({
      themeMode: normalized.mode,
      themeStyle: 'default',
      advancedMaterialMode: 'soft',
      advancedMaterialEnabled: false,
    })
  }

  const isDark = await window.electronAPI.getSystemTheme()
  setSystemIsDark(isDark)

  const cleanupSystem = window.electronAPI.onSystemThemeChanged((newIsDark) => {
    setSystemIsDark(newIsDark)
  })

  const cleanupThemeSettings = window.electronAPI.onThemeSettingsChanged((payload) => {
    const normalizedPayload = normalizeLegacyNeumorphTheme(
      payload.themeMode as ThemeMode,
      (payload.themeStyle || 'default') as ThemeStyle
    )

    setThemeMode(normalizedPayload.mode)
    cacheThemeMode(normalizedPayload.mode)

    if (setThemeStyle) {
      setThemeStyle(normalizedPayload.style)
      cacheThemeStyle(normalizedPayload.style)
    }
  })

  return () => {
    cleanupSystem()
    cleanupThemeSettings()
  }
}

export async function updateThemeMode(mode: ThemeMode): Promise<void> {
  cacheThemeMode(mode)
  await window.electronAPI.updateSettings({ themeMode: mode })
}

export async function updateThemeStyle(style: ThemeStyle): Promise<void> {
  cacheThemeStyle(style)
  await window.electronAPI.updateSettings({ themeStyle: style })
}
