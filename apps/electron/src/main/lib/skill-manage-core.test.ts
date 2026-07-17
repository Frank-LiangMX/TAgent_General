import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

import {
  archiveSkill,
  createSkill,
  deleteSkill,
  getSkillDir,
  listSkillSlugs,
  patchSkill,
  SKILL_SLUG_PATTERN,
  suggestSlugFromTitle,
} from './skill-manage-core'

// 测试使用真实 config 目录下的临时 slug，跑完删除
const TEST_SLUG = 'zz-test-skill-curator-unit'

function cleanup(): void {
  try {
    if (existsSync(getSkillDir(TEST_SLUG, 'global'))) {
      deleteSkill(TEST_SLUG, 'global')
    }
  } catch {
    // ignore
  }
  // 归档残留
  try {
    const archived = join(
      homedir(),
      process.env.TAGENT_DEV === '1' ? '.tagent-dev' : '.tagent',
      'global-skills-plugin',
      'skills-archived',
      TEST_SLUG
    )
    if (existsSync(archived)) rmSync(archived, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

describe('skill-manage-core', () => {
  afterEach(() => {
    cleanup()
  })

  it('slug 校验', () => {
    expect(SKILL_SLUG_PATTERN.test('weekly-speed-test')).toBe(true)
    expect(SKILL_SLUG_PATTERN.test('Bad_Slug')).toBe(false)
    expect(suggestSlugFromTitle('Fix Bug Weekly')).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  it('create → patch → archive 闭环', () => {
    process.env.TAGENT_DEV = '1'
    cleanup()

    const created = createSkill({
      slug: TEST_SLUG,
      name: 'Test Skill',
      description: 'A test skill for unit tests. Use when testing skill curator.',
      scope: 'global',
      provenance: 'background',
      createdBy: 'agent',
      status: 'draft',
    })
    expect(created.ok).toBe(true)
    expect(existsSync(created.path)).toBe(true)
    expect(listSkillSlugs('global')).toContain(TEST_SLUG)

    const patched = patchSkill({
      slug: TEST_SLUG,
      scope: 'global',
      status: 'active',
      description: 'Updated description for the test skill with enough length.',
    })
    expect(patched.ok).toBe(true)

    const archived = archiveSkill(TEST_SLUG, 'global')
    expect(archived.ok).toBe(true)
    expect(listSkillSlugs('global')).not.toContain(TEST_SLUG)
  })
})
