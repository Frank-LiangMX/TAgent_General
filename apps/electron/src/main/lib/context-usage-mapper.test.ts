import { describe, expect, test } from 'vitest'

import {
  ContextUsageFetchError,
  mapSdkContextUsageResponse,
  toGetContextUsageError,
} from './context-usage-mapper'

describe('mapSdkContextUsageResponse', () => {
  test('maps full SDK response to shared snapshot', () => {
    const snapshot = mapSdkContextUsageResponse({
      categories: [{ name: 'System prompt', tokens: 503, color: '#ff0000' }],
      totalTokens: 60_100,
      maxTokens: 200_000,
      rawMaxTokens: 200_000,
      percentage: 30,
      gridRows: [],
      model: 'claude-sonnet-4-20250514',
      memoryFiles: [{ path: 'L0_user.md', type: 'memory', tokens: 120 }],
      mcpTools: [{ name: 'read_file', serverName: 'tagent', tokens: 900, isLoaded: true }],
      agents: [],
      isAutoCompactEnabled: true,
      autoCompactThreshold: 0.775,
      apiUsage: {
        input_tokens: 1000,
        output_tokens: 200,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 300,
      },
    })

    expect(snapshot.categories[0]?.name).toBe('System prompt')
    expect(snapshot.totalTokens).toBe(60_100)
    expect(snapshot.apiUsage?.inputTokens).toBe(1000)
    expect(snapshot.memoryFiles[0]?.path).toBe('L0_user.md')
    expect(snapshot.fetchedAt).toBeGreaterThan(0)
  })

  test('handles missing optional fields', () => {
    const snapshot = mapSdkContextUsageResponse({
      categories: [],
      totalTokens: 0,
      maxTokens: 200_000,
      rawMaxTokens: 200_000,
      percentage: 0,
      gridRows: [],
      model: 'claude-sonnet-4-20250514',
      memoryFiles: [],
      mcpTools: [],
      agents: [],
      isAutoCompactEnabled: false,
      apiUsage: null,
    })

    expect(snapshot.categories).toEqual([])
    expect(snapshot.messageBreakdown).toBeUndefined()
    expect(snapshot.apiUsage).toBeNull()
  })
})

describe('toGetContextUsageError', () => {
  test('maps ContextUsageFetchError code', () => {
    const mapped = toGetContextUsageError(
      new ContextUsageFetchError('NO_ACTIVE_QUERY', '无活跃 Query')
    )
    expect(mapped.code).toBe('NO_ACTIVE_QUERY')
    expect(mapped.message).toBe('无活跃 Query')
  })
})
