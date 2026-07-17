import { describe, expect, it } from 'bun:test'

import { __testing } from './skill-curator-service'

const { decideNext, parseLiteFrontmatter, DRAFT_TO_ACTIVE_USES, ACTIVE_TO_STALE_MS } = __testing

describe('skill-curator-service', () => {
  it('parseLiteFrontmatter 解析 provenance/status/pinned', () => {
    const md = `---
name: demo
provenance: background
status: draft
pinned: true
created_by: agent
---
body
`
    const lite = parseLiteFrontmatter(md)
    expect(lite.provenance).toBe('background')
    expect(lite.status).toBe('draft')
    expect(lite.pinned).toBe(true)
  })

  it('draft 使用达门槛 → active', () => {
    const now = Date.now()
    const d = decideNext('draft', DRAFT_TO_ACTIVE_USES, now, now)
    expect(d?.next).toBe('active')
  })

  it('无 lastUsedAt 不做闲置降级', () => {
    expect(decideNext('active', 10, 0, Date.now())).toBeNull()
  })

  it('active 闲置 30 天 → stale', () => {
    const now = Date.now()
    const last = now - ACTIVE_TO_STALE_MS - 1000
    const d = decideNext('active', 10, last, now)
    expect(d?.next).toBe('stale')
  })

  it('draft 使用不足保持 draft', () => {
    expect(decideNext('draft', DRAFT_TO_ACTIVE_USES - 1, Date.now(), Date.now())).toBeNull()
  })
})
