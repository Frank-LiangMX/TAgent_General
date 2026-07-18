import { describe, expect, test } from 'vitest'

import { resolveAdvancedMaterialState } from './advanced-material'

describe('resolveAdvancedMaterialState', () => {
  test('uses frosted defaults for a new settings file', () => {
    expect(resolveAdvancedMaterialState({})).toEqual({
      enabled: false,
      onMode: 'glass',
      mode: 'frosted',
    })
  })

  test('preserves the selected on-mode while the explicit switch is off', () => {
    expect(
      resolveAdvancedMaterialState({
        advancedMaterialEnabled: false,
        advancedMaterialOnMode: 'soft',
      })
    ).toEqual({ enabled: false, onMode: 'soft', mode: 'frosted' })
  })

  test.each(['glass', 'soft'] as const)('uses the new on-mode %s when enabled', (onMode) => {
    expect(
      resolveAdvancedMaterialState({
        advancedMaterialEnabled: true,
        advancedMaterialOnMode: onMode,
      })
    ).toEqual({ enabled: true, onMode, mode: onMode })
  })

  test.each(['glass', 'soft'] as const)(
    'migrates legacy advancedMaterialMode=%s to an enabled material',
    (advancedMaterialMode) => {
      expect(resolveAdvancedMaterialState({ advancedMaterialMode })).toEqual({
        enabled: true,
        onMode: advancedMaterialMode,
        mode: advancedMaterialMode,
      })
    }
  )

  test('migrates legacy frosted mode to a disabled advanced-material switch', () => {
    expect(resolveAdvancedMaterialState({ advancedMaterialMode: 'frosted' })).toEqual({
      enabled: false,
      onMode: 'glass',
      mode: 'frosted',
    })
  })

  test.each(['neumorph-light', 'neumorph-dark'] as const)(
    'migrates legacy %s theme to soft material',
    (themeStyle) => {
      expect(resolveAdvancedMaterialState({ themeStyle })).toEqual({
        enabled: true,
        onMode: 'soft',
        mode: 'soft',
      })
    }
  )

  test('lets the explicit disabled switch override a legacy enabled mode', () => {
    expect(
      resolveAdvancedMaterialState({
        advancedMaterialEnabled: false,
        advancedMaterialMode: 'glass',
      })
    ).toEqual({ enabled: false, onMode: 'glass', mode: 'frosted' })
  })

  test('prefers the new on-mode over a conflicting legacy mode', () => {
    expect(
      resolveAdvancedMaterialState({
        advancedMaterialEnabled: true,
        advancedMaterialOnMode: 'soft',
        advancedMaterialMode: 'glass',
      })
    ).toEqual({ enabled: true, onMode: 'soft', mode: 'soft' })
  })
})
