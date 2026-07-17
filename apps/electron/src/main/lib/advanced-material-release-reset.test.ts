import { describe, expect, test } from 'vitest'

import {
  applyAdvancedMaterialReleaseReset,
  hadAdvancedMaterialEnabled,
} from './advanced-material-release-reset'

import type { AppSettings } from '../../types'

function baseSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    themeMode: 'dark',
    themeStyle: 'ocean-dark',
    onboardingCompleted: true,
    ...overrides,
  }
}

describe('hadAdvancedMaterialEnabled', () => {
  test('detects enabled flag', () => {
    expect(hadAdvancedMaterialEnabled({ advancedMaterialEnabled: true })).toBe(true)
  })

  test('detects glass / soft mode', () => {
    expect(hadAdvancedMaterialEnabled({ advancedMaterialMode: 'glass' })).toBe(true)
    expect(hadAdvancedMaterialEnabled({ advancedMaterialMode: 'soft' })).toBe(true)
    expect(hadAdvancedMaterialEnabled({ advancedMaterialMode: 'frosted' })).toBe(false)
  })

  test('detects legacy neumorph theme styles', () => {
    expect(hadAdvancedMaterialEnabled({ themeStyle: 'neumorph-light' })).toBe(true)
    expect(hadAdvancedMaterialEnabled({ themeStyle: 'neumorph-dark' })).toBe(true)
  })
})

describe('applyAdvancedMaterialReleaseReset', () => {
  test('skips when not packaged', () => {
    const settings = baseSettings({ advancedMaterialEnabled: true })
    const result = applyAdvancedMaterialReleaseReset(settings, false)
    expect(result.changed).toBe(false)
    expect(result.settings).toBe(settings)
  })

  test('skips when flag already set', () => {
    const settings = baseSettings({
      advancedMaterialEnabled: true,
      advancedMaterialReleaseResetV1: true,
    })
    const result = applyAdvancedMaterialReleaseReset(settings, true)
    expect(result.changed).toBe(false)
    expect(result.settings.advancedMaterialEnabled).toBe(true)
  })

  test('resets advanced material users to frosted + light once', () => {
    const settings = baseSettings({
      advancedMaterialEnabled: true,
      advancedMaterialMode: 'glass',
      themeMode: 'special',
      themeStyle: 'forest-dark',
    })
    const result = applyAdvancedMaterialReleaseReset(settings, true)
    expect(result.changed).toBe(true)
    expect(result.resetApplied).toBe(true)
    expect(result.settings).toMatchObject({
      advancedMaterialReleaseResetV1: true,
      advancedMaterialEnabled: false,
      advancedMaterialMode: 'frosted',
      themeMode: 'light',
      themeStyle: 'default',
    })
  })

  test('only stamps flag when user already on default material', () => {
    const settings = baseSettings({
      advancedMaterialEnabled: false,
      advancedMaterialMode: 'frosted',
      themeMode: 'dark',
      themeStyle: 'ocean-dark',
    })
    const result = applyAdvancedMaterialReleaseReset(settings, true)
    expect(result.changed).toBe(true)
    expect(result.resetApplied).toBe(false)
    expect(result.settings.advancedMaterialReleaseResetV1).toBe(true)
    expect(result.settings.themeMode).toBe('dark')
    expect(result.settings.themeStyle).toBe('ocean-dark')
  })
})
