import { describe, expect, it } from 'bun:test'

import { extractSkillSlug, extractSkillSlugFromToolUse } from './skill-invocation-tracker'

describe('skill-invocation-tracker', () => {
  it('extractSkillSlug 解析 qualified / 路径', () => {
    expect(extractSkillSlug('tagent-workspace-default:weekly-speed-test')).toBe('weekly-speed-test')
    expect(extractSkillSlug('skills/brandkit/SKILL.md')).toBe('brandkit')
    expect(extractSkillSlug('Bad_Slug')).toBeNull()
  })

  it('extractSkillSlugFromToolUse 识别 Skill 工具', () => {
    expect(extractSkillSlugFromToolUse('Skill', { skill: 'brainstorming' })).toBe('brainstorming')
    expect(
      extractSkillSlugFromToolUse('mcp__x__skill_manage', { action: 'create', slug: 'my-flow' })
    ).toBe('my-flow')
    expect(extractSkillSlugFromToolUse('Bash', { command: 'ls' })).toBeNull()
  })
})
