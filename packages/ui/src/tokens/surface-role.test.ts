import { describe, expect, test } from 'vitest'

import { isSurfaceRole, surfaceRoles, surfaceRoleZIndex } from './surface-role'

describe('surface roles', () => {
  test('keeps every role unique and assigned to a z-index', () => {
    expect(new Set(surfaceRoles).size).toBe(surfaceRoles.length)
    expect(Object.keys(surfaceRoleZIndex).sort()).toEqual([...surfaceRoles].sort())
  })

  test.each(surfaceRoles)('recognizes %s', (role) => {
    expect(isSurfaceRole(role)).toBe(true)
  })

  test.each([undefined, null, '', 'sidebar', 'tooltip', 10])('rejects %j', (value) => {
    expect(isSurfaceRole(value)).toBe(false)
  })

  test('keeps overlays above interactive surfaces and modals above overlays', () => {
    expect(surfaceRoleZIndex.overlay).toBeGreaterThan(surfaceRoleZIndex['interactive-elevated'])
    expect(surfaceRoleZIndex.modal).toBeGreaterThan(surfaceRoleZIndex.overlay)
  })
})
