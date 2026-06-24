import type {
  ContextUsageApiUsage,
  ContextUsageSnapshot,
  ContextUsageErrorCode,
} from '@tagent/shared'
import { resolveContextUsageColor, resolveDisplayContextWindow } from '@tagent/shared'

export class ContextUsageFetchError extends Error {
  readonly code: ContextUsageErrorCode

  constructor(code: ContextUsageErrorCode, message: string) {
    super(message)
    this.name = 'ContextUsageFetchError'
    this.code = code
  }
}

type SdkContextUsageResponse =
  import('@anthropic-ai/claude-agent-sdk').SDKControlGetContextUsageResponse

export function mapSdkContextUsageResponse(sdk: SdkContextUsageResponse): ContextUsageSnapshot {
  const apiUsage: ContextUsageApiUsage | null = sdk.apiUsage
    ? {
        inputTokens: sdk.apiUsage.input_tokens,
        outputTokens: sdk.apiUsage.output_tokens,
        cacheReadTokens: sdk.apiUsage.cache_read_input_tokens,
        cacheCreationTokens: sdk.apiUsage.cache_creation_input_tokens,
      }
    : null

  const rawMaxTokens = sdk.rawMaxTokens ?? sdk.maxTokens
  const maxTokens = resolveDisplayContextWindow(sdk.model, sdk.maxTokens)
  const percentage = maxTokens > 0 ? (sdk.totalTokens / maxTokens) * 100 : sdk.percentage

  return {
    categories: sdk.categories.map((category) => ({
      name: category.name,
      tokens: category.tokens,
      color: resolveContextUsageColor(category.name, category.color),
      isDeferred: category.isDeferred,
    })),
    totalTokens: sdk.totalTokens,
    maxTokens,
    rawMaxTokens,
    percentage,
    model: sdk.model,
    isAutoCompactEnabled: sdk.isAutoCompactEnabled,
    autoCompactThreshold: sdk.autoCompactThreshold,
    memoryFiles: sdk.memoryFiles.map((file) => ({
      path: file.path,
      type: file.type,
      tokens: file.tokens,
    })),
    mcpTools: sdk.mcpTools.map((tool) => ({
      name: tool.name,
      serverName: tool.serverName,
      tokens: tool.tokens,
      isLoaded: tool.isLoaded,
    })),
    systemTools: sdk.systemTools?.map((tool) => ({
      name: tool.name,
      tokens: tool.tokens,
    })),
    systemPromptSections: sdk.systemPromptSections?.map((section) => ({
      name: section.name,
      tokens: section.tokens,
    })),
    agents: sdk.agents.map((agent) => ({
      agentType: agent.agentType,
      source: agent.source,
      tokens: agent.tokens,
    })),
    skills: sdk.skills
      ? {
          totalSkills: sdk.skills.totalSkills,
          includedSkills: sdk.skills.includedSkills,
          tokens: sdk.skills.tokens,
          skillFrontmatter: sdk.skills.skillFrontmatter.map((skill) => ({
            name: skill.name,
            source: skill.source,
            tokens: skill.tokens,
          })),
        }
      : undefined,
    messageBreakdown: sdk.messageBreakdown
      ? {
          toolCallTokens: sdk.messageBreakdown.toolCallTokens,
          toolResultTokens: sdk.messageBreakdown.toolResultTokens,
          attachmentTokens: sdk.messageBreakdown.attachmentTokens,
          assistantMessageTokens: sdk.messageBreakdown.assistantMessageTokens,
          userMessageTokens: sdk.messageBreakdown.userMessageTokens,
          redirectedContextTokens: sdk.messageBreakdown.redirectedContextTokens,
          unattributedTokens: sdk.messageBreakdown.unattributedTokens,
          toolCallsByType: sdk.messageBreakdown.toolCallsByType.map((item) => ({
            name: item.name,
            callTokens: item.callTokens,
            resultTokens: item.resultTokens,
          })),
          attachmentsByType: sdk.messageBreakdown.attachmentsByType?.map((item) => ({
            name: item.name,
            tokens: item.tokens,
          })),
        }
      : undefined,
    apiUsage,
    fetchedAt: Date.now(),
  }
}

export function toGetContextUsageError(error: unknown): {
  code: ContextUsageErrorCode
  message: string
} {
  if (error instanceof ContextUsageFetchError) {
    return { code: error.code, message: error.message }
  }
  if (error instanceof Error) {
    return { code: 'SDK_ERROR', message: error.message }
  }
  return { code: 'SDK_ERROR', message: '获取 Context 分项失败' }
}
