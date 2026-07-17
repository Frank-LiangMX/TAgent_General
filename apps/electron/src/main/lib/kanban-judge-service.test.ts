import { describe, expect, it } from 'bun:test'

import {
  buildAcceptanceText,
  parseJudgeVerdict,
  taskNeedsJudge,
} from './kanban-judge-service'

describe('kanban-judge-service', () => {
  it('taskNeedsJudge 仅 goalMode=true', () => {
    expect(taskNeedsJudge({ goalMode: true })).toBe(true)
    expect(taskNeedsJudge({ goalMode: false })).toBe(false)
    expect(taskNeedsJudge({})).toBe(false)
  })

  it('buildAcceptanceText 优先显式 criteria', () => {
    expect(
      buildAcceptanceText({
        title: 'T',
        body: 'B',
        acceptanceCriteria: '  必须有测试  ',
      })
    ).toBe('必须有测试')
    expect(buildAcceptanceText({ title: 'Fix login', body: 'detail' })).toBe(
      'Fix login\n\ndetail'
    )
  })

  it('parseJudgeVerdict 解析 JSON', () => {
    const r = parseJudgeVerdict('{"verdict":"done","reason":"tests pass"}')
    expect(r.verdict).toBe('done')
    expect(r.reason).toBe('tests pass')
    expect(r.parseFailed).toBe(false)
  })

  it('parseJudgeVerdict 解析包裹 JSON', () => {
    const r = parseJudgeVerdict('Here:\n{"verdict":"continue","reason":"no tests"}\n')
    expect(r.verdict).toBe('continue')
    expect(r.parseFailed).toBe(false)
  })

  it('parseJudgeVerdict 空输出 parseFailed', () => {
    const r = parseJudgeVerdict('   ')
    expect(r.parseFailed).toBe(true)
    expect(r.verdict).toBe('continue')
  })
})
