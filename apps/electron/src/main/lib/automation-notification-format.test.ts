import { describe, expect, test } from 'bun:test'

import type { Automation, AutomationRun } from '@tagent/shared'

import {
  buildAutomationFeishuCard,
  formatAutomationDuration,
  shouldNotifyForRun,
} from './automation-notification-format'

function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'auto-1',
    name: '每日整理',
    prompt: '整理',
    enabled: true,
    scheduleType: 'daily',
    intervalMinutes: 0,
    timeOfDay: '20:00',
    channelId: 'ch-1',
    workspaceId: 'ws-1',
    createdAt: 0,
    updatedAt: 0,
    nextRunAt: 0,
    runHistory: [],
    ...overrides,
  }
}

function makeRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    runAt: Date.now(),
    sessionId: 'sess-1',
    status: 'succeeded',
    durationMs: 12_000,
    ...overrides,
  }
}

describe('shouldNotifyForRun', () => {
  test('always 通知成功与失败', () => {
    expect(shouldNotifyForRun('always', 'succeeded')).toBe(true)
    expect(shouldNotifyForRun('always', 'failed')).toBe(true)
    expect(shouldNotifyForRun(undefined, 'succeeded')).toBe(true)
  })

  test('success 仅成功', () => {
    expect(shouldNotifyForRun('success', 'succeeded')).toBe(true)
    expect(shouldNotifyForRun('success', 'failed')).toBe(false)
  })

  test('error 仅失败', () => {
    expect(shouldNotifyForRun('error', 'failed')).toBe(true)
    expect(shouldNotifyForRun('error', 'succeeded')).toBe(false)
  })

  test('skipped 不通知', () => {
    expect(shouldNotifyForRun('always', 'skipped')).toBe(false)
  })
})

describe('formatAutomationDuration', () => {
  test('秒与分钟格式化', () => {
    expect(formatAutomationDuration(1500)).toBe('1.5 秒')
    expect(formatAutomationDuration(90_000)).toBe('2 分钟')
  })
})

describe('buildAutomationFeishuCard', () => {
  test('成功卡片包含任务名与摘要', () => {
    const card = buildAutomationFeishuCard({
      automation: makeAutomation(),
      run: makeRun(),
      summary: '整理完成',
    })
    const markdown = JSON.stringify(card)
    expect(markdown).toContain('每日整理')
    expect(markdown).toContain('整理完成')
  })
})
