import type { ProviderType } from '@tagent/shared'

export const DEEPSEEK_SUBAGENT_MODEL_ID = 'deepseek-v4-flash'
export interface AgentModelRoutingInput {
  modelId?: string
  provider?: ProviderType
}

export interface AgentModelRoutingPolicy {
  /** 是否命中 DeepSeek 系列主模型 */
  deepSeekFamily: boolean
  /** 是否命中 kscc 内网渠道模型 */
  ksccFamily?: boolean
  /** 命中时写入 CLAUDE_CODE_SUBAGENT_MODEL；未命中时删除该环境变量以保留 SDK 默认解析 */
  subagentModel?: string
}

/**
 * 解析 Agent 辅助模型路由策略。
 *
 * DeepSeek 系列主模型使用 deepseek-v4-flash 承担 SubAgent，避免复杂主模型
 * 被高频探索 / 审查子任务消耗；其它模型不写该变量，交回 SDK 按
 * per-invocation model、subagent frontmatter、主模型的顺序解析。
 */
export function resolveAgentModelRouting(input: AgentModelRoutingInput): AgentModelRoutingPolicy {
  const model = input.modelId?.trim().toLowerCase() ?? ''
  const deepSeekFamily =
    input.provider === 'deepseek' || model.startsWith('deepseek-') || model.includes('/deepseek-')
  const ksccFamily = input.provider === 'kscc-internal'

  let subagentModel: string | undefined
  if (ksccFamily) {
    // kscc 内网渠道：子 Agent 使用最轻量的模型
    if (model.includes('mimo-v2.5-pro')) subagentModel = 'mimo-v2.5'
    else if (model.includes('mimo-v2.5')) subagentModel = 'mimo-v2.5'
    else subagentModel = 'glm-5.1' // 默认用 GLM-5.1 作为 subagent
  } else if (deepSeekFamily) {
    subagentModel = DEEPSEEK_SUBAGENT_MODEL_ID
  }

  return {
    deepSeekFamily,
    ksccFamily,
    ...(subagentModel && { subagentModel }),
  }
}

export function applyAgentModelRoutingToEnv(
  env: Record<string, string | undefined>,
  policy: AgentModelRoutingPolicy
): void {
  if (policy.subagentModel) {
    env.CLAUDE_CODE_SUBAGENT_MODEL = policy.subagentModel
  } else {
    delete env.CLAUDE_CODE_SUBAGENT_MODEL
  }
}
