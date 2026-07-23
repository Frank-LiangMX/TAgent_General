import { describe, expect, it } from 'vitest'

import { formatRunElapsed, transitionRunTimerState, type RunTimerState } from './run-timer'

const IDLE: RunTimerState = { isRunning: false, startedAt: null, sessionId: null }

describe('formatRunElapsed', () => {
  it('formats 0ms as 00:00', () => {
    expect(formatRunElapsed(0)).toBe('00:00')
  })

  it('formats sub-second (< 1000ms) as 00:00', () => {
    expect(formatRunElapsed(999)).toBe('00:00')
  })

  it('formats exactly 1 second as 00:01', () => {
    expect(formatRunElapsed(1000)).toBe('00:01')
  })

  it('formats 59 seconds as 00:59', () => {
    expect(formatRunElapsed(59_000)).toBe('00:59')
  })

  it('formats exactly 60 seconds as 01:00', () => {
    expect(formatRunElapsed(60_000)).toBe('01:00')
  })

  it('formats 61 seconds as 01:01', () => {
    expect(formatRunElapsed(61_000)).toBe('01:01')
  })

  it('formats 3599 seconds (59:59) correctly', () => {
    expect(formatRunElapsed(3_599_000)).toBe('59:59')
  })

  it('formats 3600 seconds (60:00) correctly', () => {
    expect(formatRunElapsed(3_600_000)).toBe('60:00')
  })

  it('clamps negative input to 00:00', () => {
    expect(formatRunElapsed(-500)).toBe('00:00')
  })

  it('floors fractional milliseconds', () => {
    // 2999ms → floor(2999/1000) = 2 seconds → 00:02
    expect(formatRunElapsed(2999)).toBe('00:02')
    // 3000ms → 3 seconds → 00:03
    expect(formatRunElapsed(3000)).toBe('00:03')
  })

  it('handles large durations without overflow (>=100 minutes)', () => {
    // 100 minutes = 6000 seconds = 6,000,000ms → 100:00
    expect(formatRunElapsed(6_000_000)).toBe('100:00')
  })

  it('always outputs mm:ss format with two-digit minutes and seconds', () => {
    // 验证分钟和秒数始终两位数
    const cases = [
      { ms: 0, expected: '00:00' },
      { ms: 1000, expected: '00:01' },
      { ms: 9000, expected: '00:09' },
      { ms: 10_000, expected: '00:10' },
      { ms: 59_000, expected: '00:59' },
      { ms: 60_000, expected: '01:00' },
      { ms: 600_000, expected: '10:00' },
      { ms: 3_599_000, expected: '59:59' },
    ]
    for (const { ms, expected } of cases) {
      expect(formatRunElapsed(ms)).toBe(expected)
    }
  })
})

describe('transitionRunTimerState', () => {
  const NOW = 1_000_000

  it('从 idle 进入 running：使用 streamStartedAt', () => {
    const result = transitionRunTimerState(IDLE, {
      sessionId: 's1',
      isRunning: true,
      streamStartedAt: 999_000,
      now: NOW,
    })
    expect(result).toEqual({ isRunning: true, startedAt: 999_000, sessionId: 's1' })
  })

  it('从 idle 进入 running：无 streamStartedAt 时使用 now', () => {
    const result = transitionRunTimerState(IDLE, {
      sessionId: 's1',
      isRunning: true,
      now: NOW,
    })
    expect(result).toEqual({ isRunning: true, startedAt: NOW, sessionId: 's1' })
  })

  it('同 session running 持续（thinking↔acting）：不重置 startedAt', () => {
    const running: RunTimerState = { isRunning: true, startedAt: 900_000, sessionId: 's1' }
    const result = transitionRunTimerState(running, {
      sessionId: 's1',
      isRunning: true,
      streamStartedAt: 950_000, // 即使传入新的 startedAt，也不覆盖
      now: NOW,
    })
    expect(result).toEqual({ isRunning: true, startedAt: 900_000, sessionId: 's1' })
  })

  it('同 session running 持续：startedAt=0（Unix epoch）视为有效', () => {
    const running: RunTimerState = { isRunning: true, startedAt: 0, sessionId: 's1' }
    const result = transitionRunTimerState(running, {
      sessionId: 's1',
      isRunning: true,
      streamStartedAt: 950_000,
      now: NOW,
    })
    // startedAt=0 是有效值，不应被重置
    expect(result).toEqual({ isRunning: true, startedAt: 0, sessionId: 's1' })
  })

  it('停止运行：清空 startedAt', () => {
    const running: RunTimerState = { isRunning: true, startedAt: 900_000, sessionId: 's1' }
    const result = transitionRunTimerState(running, {
      sessionId: 's1',
      isRunning: false,
      now: NOW,
    })
    expect(result).toEqual({ isRunning: false, startedAt: null, sessionId: 's1' })
  })

  it('停止后再次运行：重置 startedAt（使用 streamStartedAt）', () => {
    const stopped: RunTimerState = { isRunning: false, startedAt: null, sessionId: 's1' }
    const result = transitionRunTimerState(stopped, {
      sessionId: 's1',
      isRunning: true,
      streamStartedAt: 990_000,
      now: NOW,
    })
    expect(result).toEqual({ isRunning: true, startedAt: 990_000, sessionId: 's1' })
  })

  it('停止后再次运行：无 streamStartedAt 时使用 now', () => {
    const stopped: RunTimerState = { isRunning: false, startedAt: null, sessionId: 's1' }
    const result = transitionRunTimerState(stopped, {
      sessionId: 's1',
      isRunning: true,
      now: NOW,
    })
    expect(result).toEqual({ isRunning: true, startedAt: NOW, sessionId: 's1' })
  })

  it('切换 session：完全隔离，重置状态', () => {
    const running: RunTimerState = { isRunning: true, startedAt: 900_000, sessionId: 's1' }
    const result = transitionRunTimerState(running, {
      sessionId: 's2',
      isRunning: true,
      streamStartedAt: 995_000,
      now: NOW,
    })
    expect(result).toEqual({ isRunning: true, startedAt: 995_000, sessionId: 's2' })
  })

  it('切换 session 到 idle：清空', () => {
    const running: RunTimerState = { isRunning: true, startedAt: 900_000, sessionId: 's1' }
    const result = transitionRunTimerState(running, {
      sessionId: 's2',
      isRunning: false,
      now: NOW,
    })
    expect(result).toEqual({ isRunning: false, startedAt: null, sessionId: 's2' })
  })

  it('idle→idle 保持不变', () => {
    const result = transitionRunTimerState(IDLE, {
      sessionId: 's1',
      isRunning: false,
      now: NOW,
    })
    expect(result).toEqual({ isRunning: false, startedAt: null, sessionId: 's1' })
  })

  it('streamStartedAt 优先于 now', () => {
    const result = transitionRunTimerState(IDLE, {
      sessionId: 's1',
      isRunning: true,
      streamStartedAt: 800_000,
      now: NOW,
    })
    expect(result.startedAt).toBe(800_000)
  })

  it('streamStartedAt 为 undefined 时回退到 now', () => {
    const result = transitionRunTimerState(IDLE, {
      sessionId: 's1',
      isRunning: true,
      streamStartedAt: undefined,
      now: NOW,
    })
    expect(result.startedAt).toBe(NOW)
  })
})
