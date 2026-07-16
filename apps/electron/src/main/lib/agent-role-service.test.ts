/**
 * 角色库服务：内置角色补齐（版本升级新增 generalist 等）
 */

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let rolesPath = ''

vi.mock('./config-paths', () => ({
  getAgentRolesPath: () => rolesPath,
}))

const { loadRoles, resetDefaultRoles } = await import('./agent-role-service')
const { DEFAULT_ROLES } = await import('@tagent/shared')

describe('agent-role-service 内置角色补齐', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'tagent-role-test-'))
    rolesPath = join(tmpDir, 'agent-roles.json')
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('首次 loadRoles 写入全部内置角色（含非编程 4 个）', () => {
    const roles = loadRoles()
    const ids = roles.map((r) => r.id)
    expect(ids).toContain('generalist')
    expect(ids).toContain('data-analyst')
    expect(ids).toContain('chat')
    expect(ids).toContain('doc-writer')
    expect(ids).toContain('coder')
    expect(roles.length).toBeGreaterThanOrEqual(8)
    expect(existsSync(rolesPath)).toBe(true)
  })

  test('旧文件仅含编程 4 角色时，loadRoles 补齐非编程角色', () => {
    const oldFour = DEFAULT_ROLES.filter((r) =>
      ['analyst', 'coder', 'reviewer', 'writer'].includes(r.id)
    )
    writeFileSync(rolesPath, JSON.stringify(oldFour, null, 2), 'utf-8')

    const roles = loadRoles()
    const ids = new Set(roles.map((r) => r.id))
    expect(ids.has('generalist')).toBe(true)
    expect(ids.has('data-analyst')).toBe(true)
    expect(ids.has('chat')).toBe(true)
    expect(ids.has('doc-writer')).toBe(true)
    expect(ids.has('coder')).toBe(true)
    expect(ids.has('writer')).toBe(true)

    const saved = JSON.parse(readFileSync(rolesPath, 'utf-8')) as Array<{ id: string }>
    expect(saved.map((r) => r.id)).toEqual(
      expect.arrayContaining(['generalist', 'data-analyst', 'chat', 'doc-writer'])
    )
  })

  test('resetDefaultRoles 恢复全部内置角色', () => {
    const roles = resetDefaultRoles()
    expect(roles.map((r) => r.id)).toEqual(DEFAULT_ROLES.map((r) => r.id))
  })
})
