import type { AgentCallStats } from '@tagent/shared'

/** Create an empty per-run call statistics record. */
export function createAgentCallStats(): AgentCallStats {
  return {
    modelCalls: 0,
    subagentCalls: 0,
    queryAttempts: 0,
    contextUsageRequests: 0,
    titleRequests: 0,
    retryAttempts: 0,
  }
}

/** Number of model responses that can consume a call-based plan. */
export function countAgentModelCalls(stats: AgentCallStats): number {
  return stats.modelCalls + stats.subagentCalls
}
