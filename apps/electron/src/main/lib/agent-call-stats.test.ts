import { describe, expect, test } from 'vitest'

import { countAgentModelCalls, createAgentCallStats } from './agent-call-stats'

describe('Agent call statistics', () => {
  test('starts each run with zero counters', () => {
    expect(createAgentCallStats()).toEqual({
      modelCalls: 0,
      subagentCalls: 0,
      queryAttempts: 0,
      contextUsageRequests: 0,
      titleRequests: 0,
      retryAttempts: 0,
    })
  })

  test('counts main and SubAgent model responses as billable calls', () => {
    expect(
      countAgentModelCalls({
        ...createAgentCallStats(),
        modelCalls: 2,
        subagentCalls: 3,
      })
    ).toBe(5)
  })
})
