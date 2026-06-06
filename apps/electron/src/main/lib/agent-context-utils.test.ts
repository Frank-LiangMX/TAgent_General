import { describe, expect, test, beforeEach } from 'bun:test'
import {
  computeMaxContextMessages,
  summarizeToolResult,
  setSessionContextWindow,
  getSessionContextWindow,
  clearSessionContextWindow,
  clearAllSessionContextWindows,
  MAX_TOOL_SUMMARY_LENGTH,
  CHARS_PER_TOKEN,
  AVG_TOKENS_PER_MESSAGE,
} from './agent-context-utils'

describe('computeMaxContextMessages (P0-1)', () => {
  test('Given Sonnet 4 200K window When 算 max messages Then 返回 ~376', () => {
    const n = computeMaxContextMessages(200_000)
    // 预算 = 200000 - 4000 - 8000 = 188000, / 500 = 376
    expect(n).toBe(376)
  })

  test('Given 1M beta window When 算 max messages Then 返回 ~1976', () => {
    const n = computeMaxContextMessages(1_000_000)
    expect(n).toBe(1976)
  })

  test('Given 128K 端点 window When 算 max messages Then 返回 ~232', () => {
    const n = computeMaxContextMessages(128_000)
    expect(n).toBe(232)
  })

  test('Given 20K 极小 window (预算可能不够) When 算 max messages Then 至少返回 5', () => {
    // 20000 - 4000 - 8000 = 8000, / 500 = 16
    expect(computeMaxContextMessages(20_000)).toBe(16)
  })

  test('Given 10K 极小 window (预算 < 0) When 算 max messages Then 返回保命 5', () => {
    // 10000 - 4000 - 8000 = -2000
    expect(computeMaxContextMessages(10_000)).toBe(5)
  })

  test('Given 0 window When 算 max messages Then 返回保命 5', () => {
    expect(computeMaxContextMessages(0)).toBe(5)
  })

  test('Given 自定义 reserved tokens When 算 max messages Then 按预算计算', () => {
    // 100K - 8000 - 10000 = 82000, / 500 = 164
    expect(computeMaxContextMessages(100_000, 8_000, 10_000)).toBe(164)
  })

  test('Given 所有模型 Then 返回值永远 >= 5 (保底)', () => {
    for (const w of [1, 100, 1000, 12_000, 50_000, 200_000, 1_000_000]) {
      const n = computeMaxContextMessages(w)
      expect(n).toBeGreaterThanOrEqual(5)
    }
  })

  test('Given 公式 Then n = floor((window - 4000 - 8000) / 500), 至少 5', () => {
    for (const w of [13_000, 14_000, 15_000]) {
      const n = computeMaxContextMessages(w)
      const expectedBudget = w - 4000 - 8000
      const expectedRaw = Math.max(5, Math.floor(expectedBudget / AVG_TOKENS_PER_MESSAGE))
      expect(n).toBe(expectedRaw)
    }
  })
})

describe('summarizeToolResult (P1-1)', () => {
  test('Given 短内容 (< budget) When summarize Then 原样返回', () => {
    const short = 'a'.repeat(100)  // ~25 tokens, 默认 budget 500
    const out = summarizeToolResult(short, 500)
    expect(out).toBe(short)
    expect(out).not.toContain('[truncated]')
  })

  test('Given 长内容 (> budget) When summarize Then 头尾保留 + 中间 truncated 标记', () => {
    const long = 'A'.repeat(2000) + 'B'.repeat(2000)  // 4000 chars ~= 1000 tokens, budget 500
    const out = summarizeToolResult(long, 500)
    expect(out).toContain('A')   // 头部保留
    expect(out).toContain('B')   // 尾部保留
    expect(out).toContain('[truncated]')  // 中间标记
    expect(out.length).toBeLessThan(long.length)  // 总长小于原文
  })

  test('Given budget=100, 长内容 When summarize Then 头 40% + 尾 60% 保留', () => {
    const head = 'H'.repeat(160)  // 40 chars * 4 = 160 chars head budget
    const tail = 'T'.repeat(240)
    const mid = 'M'.repeat(1000)  // 中间填充
    const content = head + mid + tail
    const out = summarizeToolResult(content, 100)  // budget 100 tokens = 400 chars
    expect(out).toContain('H')   // 头 40%
    expect(out).toContain('T')   // 尾 60%
    expect(out).toContain('[truncated]')
  })

  test('Given 极小 budget (1 token) When summarize Then 头+截断+尾, 总长 < 30', () => {
    const content = 'X'.repeat(1000)
    const out = summarizeToolResult(content, 1)  // 1 char head + 2 char tail + truncated marker
    expect(out).toContain('X')
    expect(out).toContain('[truncated]')
    // head=1 + tail=2 + 21 截断标记 = 24
    expect(out.length).toBeLessThan(30)
    expect(out.length).toBeLessThan(content.length)
  })

  test('Given 默认 budget (500 tokens) When summarize Then 适用默认', () => {
    const long = 'C'.repeat(3000)  // ~750 tokens, > 500 default
    const out = summarizeToolResult(long)
    expect(out).toContain('[truncated]')
  })

  test('Given 精确等于 budget 的内容 When summarize Then 不截断', () => {
    const content = 'D'.repeat(MAX_TOOL_SUMMARY_LENGTH)  // 200 chars
    const out = summarizeToolResult(content, Math.ceil(MAX_TOOL_SUMMARY_LENGTH / CHARS_PER_TOKEN))  // budget 50 tokens = 200 chars
    expect(out).toBe(content)
  })
})

describe('sessionContextWindowCache', () => {
  beforeEach(() => {
    clearAllSessionContextWindows()
  })

  test('Given 缓存空 When getSessionContextWindow Then 返回 undefined', () => {
    expect(getSessionContextWindow('session-1')).toBeUndefined()
  })

  test('Given 设置 contextWindow=200000 When get Then 返回 200000', () => {
    setSessionContextWindow('session-1', 200_000)
    expect(getSessionContextWindow('session-1')).toBe(200_000)
  })

  test('Given 设置 contextWindow=0 When get Then 不写入 (无效值忽略)', () => {
    setSessionContextWindow('session-1', 0)
    expect(getSessionContextWindow('session-1')).toBeUndefined()
  })

  test('Given 设置 contextWindow=-100 When get Then 不写入', () => {
    setSessionContextWindow('session-1', -100)
    expect(getSessionContextWindow('session-1')).toBeUndefined()
  })

  test('Given 多个 session When 各设各的值 Then 互不干扰', () => {
    setSessionContextWindow('a', 100_000)
    setSessionContextWindow('b', 200_000)
    expect(getSessionContextWindow('a')).toBe(100_000)
    expect(getSessionContextWindow('b')).toBe(200_000)
  })

  test('Given clearSessionContextWindow When 调 Then 那个 session 被清, 其他保留', () => {
    setSessionContextWindow('a', 100_000)
    setSessionContextWindow('b', 200_000)
    clearSessionContextWindow('a')
    expect(getSessionContextWindow('a')).toBeUndefined()
    expect(getSessionContextWindow('b')).toBe(200_000)
  })

  test('Given clearAllSessionContextWindows When 调 Then 全部清空', () => {
    setSessionContextWindow('a', 100_000)
    setSessionContextWindow('b', 200_000)
    clearAllSessionContextWindows()
    expect(getSessionContextWindow('a')).toBeUndefined()
    expect(getSessionContextWindow('b')).toBeUndefined()
  })
})
