import { describe, expect, test, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false },
}))

const { resolveLogoKey, resolveNativeThemeSource } = await import('./theme-icon-resolver')

import type { ThemeMode, ThemeStyle } from '../../types'

describe('resolveLogoKey', () => {
  test('returns default icons for base modes', () => {
    expect(resolveLogoKey('light', undefined, true)).toBe('default-light')
    expect(resolveLogoKey('dark', undefined, false)).toBe('default-dark')
    expect(resolveLogoKey('system', undefined, true)).toBe('default-dark')
    expect(resolveLogoKey('system', undefined, false)).toBe('default-light')
  })

  test('returns special style icons for shipped themed icons', () => {
    const iconBackedStyles: ThemeStyle[] = [
      'ocean-light',
      'ocean-dark',
      'forest-light',
      'forest-dark',
      'slate-light',
      'slate-dark',
      'orange-light',
      'orange-dark',
      'purple-light',
      'purple-dark',
    ]

    for (const style of iconBackedStyles) {
      expect(resolveLogoKey('special', style, true)).toBe(style)
      expect(resolveLogoKey('special', style, false)).toBe(style)
    }
  })

  test('falls back to default icons for neumorph experiment themes', () => {
    expect(resolveLogoKey('special', 'neumorph-light', true)).toBe('default-light')
    expect(resolveLogoKey('special', 'neumorph-light', false)).toBe('default-light')
    expect(resolveLogoKey('special', 'neumorph-dark', true)).toBe('default-dark')
    expect(resolveLogoKey('special', 'neumorph-dark', false)).toBe('default-dark')
  })

  test('falls back to system default icons for special/default', () => {
    expect(resolveLogoKey('special', 'default', true)).toBe('default-dark')
    expect(resolveLogoKey('special', 'default', false)).toBe('default-light')
    expect(resolveLogoKey('special', undefined, true)).toBe('default-dark')
    expect(resolveLogoKey('special', undefined, false)).toBe('default-light')
  })

  test('matches key cases used by titlebar integration', () => {
    const cases: Array<{
      mode: ThemeMode
      style: ThemeStyle | undefined
      sysDark: boolean
      expected: string
    }> = [
      { mode: 'light', style: undefined, sysDark: true, expected: 'default-light' },
      { mode: 'dark', style: 'forest-light', sysDark: false, expected: 'default-dark' },
      { mode: 'system', style: undefined, sysDark: true, expected: 'default-dark' },
      { mode: 'special', style: 'ocean-light', sysDark: false, expected: 'ocean-light' },
      { mode: 'special', style: 'neumorph-light', sysDark: true, expected: 'default-light' },
      { mode: 'special', style: 'neumorph-dark', sysDark: false, expected: 'default-dark' },
    ]

    for (const { mode, style, sysDark, expected } of cases) {
      expect(resolveLogoKey(mode, style, sysDark)).toBe(expected)
    }
  })
})

describe('resolveNativeThemeSource', () => {
  test('returns direct sources for base modes', () => {
    expect(resolveNativeThemeSource('light', undefined)).toBe('light')
    expect(resolveNativeThemeSource('dark', undefined)).toBe('dark')
    expect(resolveNativeThemeSource('system', undefined)).toBe('system')
  })

  test('maps special themes by light/dark suffix', () => {
    const lightStyles: ThemeStyle[] = [
      'ocean-light',
      'forest-light',
      'slate-light',
      'orange-light',
      'purple-light',
      'neumorph-light',
    ]
    const darkStyles: ThemeStyle[] = [
      'ocean-dark',
      'forest-dark',
      'slate-dark',
      'orange-dark',
      'purple-dark',
      'neumorph-dark',
    ]

    for (const style of lightStyles) {
      expect(resolveNativeThemeSource('special', style)).toBe('light')
    }
    for (const style of darkStyles) {
      expect(resolveNativeThemeSource('special', style)).toBe('dark')
    }
  })

  test('falls back to system for special/default', () => {
    expect(resolveNativeThemeSource('special', 'default')).toBe('system')
    expect(resolveNativeThemeSource('special', undefined)).toBe('system')
  })
})
