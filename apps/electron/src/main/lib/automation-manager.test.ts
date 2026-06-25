import { describe, expect, test } from 'bun:test'

import { computeNextRunAt, isSameLocalDay } from '@tagent/shared'

describe('computeNextRunAt', () => {
  test('interval 基于上次运行时间推进', () => {
    const lastRunAt = Date.parse('2026-06-25T10:00:00')
    const next = computeNextRunAt(
      {
        scheduleType: 'interval',
        intervalMinutes: 30,
        enabled: true,
        lastRunAt,
        runCount: 1,
      },
      lastRunAt
    )
    expect(next).toBe(lastRunAt + 30 * 60_000)
  })

  test('daily 在同日已过后推到明天', () => {
    const now = Date.parse('2026-06-25T20:00:00')
    const next = computeNextRunAt(
      {
        scheduleType: 'daily',
        intervalMinutes: 0,
        timeOfDay: '09:00',
        enabled: true,
        runCount: 0,
      },
      now
    )
    const nextDate = new Date(next)
    expect(nextDate.getDate()).toBe(26)
    expect(nextDate.getHours()).toBe(9)
    expect(nextDate.getMinutes()).toBe(0)
  })

  test('monthly 短月落到月末', () => {
    const now = Date.parse('2026-01-31T12:00:00')
    const next = computeNextRunAt(
      {
        scheduleType: 'monthly',
        intervalMinutes: 0,
        dayOfMonth: 31,
        timeOfDay: '08:00',
        enabled: true,
        runCount: 0,
      },
      now
    )
    const nextDate = new Date(next)
    expect(nextDate.getMonth()).toBe(1) // February
    expect(nextDate.getDate()).toBe(28) // 2026 非闰年
  })

  test('达到 maxRuns 后返回 0', () => {
    const next = computeNextRunAt(
      {
        scheduleType: 'interval',
        intervalMinutes: 10,
        enabled: true,
        runCount: 5,
        maxRuns: 5,
      },
      Date.now()
    )
    expect(next).toBe(0)
  })
})

describe('isSameLocalDay', () => {
  test('同一天返回 true', () => {
    const a = Date.parse('2026-06-25T08:00:00')
    const b = Date.parse('2026-06-25T22:00:00')
    expect(isSameLocalDay(a, b)).toBe(true)
  })

  test('跨日返回 false', () => {
    const a = Date.parse('2026-06-25T23:59:00')
    const b = Date.parse('2026-06-26T00:01:00')
    expect(isSameLocalDay(a, b)).toBe(false)
  })
})
