import { describe, expect, test } from 'bun:test'

import { validateContextUsageSnapshot } from './context-usage-cache'

describe('validateContextUsageSnapshot', () => {
  test('accepts minimal valid snapshot', () => {
    expect(
      validateContextUsageSnapshot({
        categories: [{ name: 'System prompt', tokens: 100, color: '#9CA3AF' }],
        totalTokens: 100,
        maxTokens: 200_000,
        rawMaxTokens: 200_000,
        percentage: 0.05,
        model: 'claude-sonnet-4',
        memoryFiles: [],
        mcpTools: [],
        agents: [],
        isAutoCompactEnabled: false,
        apiUsage: null,
        fetchedAt: Date.now(),
      })
    ).toBe(true)
  })

  test('rejects invalid payload', () => {
    expect(validateContextUsageSnapshot(null)).toBe(false)
    expect(validateContextUsageSnapshot({ categories: [] })).toBe(false)
  })
})
