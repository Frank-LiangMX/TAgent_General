import type { ProviderType } from '@tagent/shared'

/** 需要清理的 Provider 环境变量（认证 + 配置 + 非必要流量开关） */
const KEYS_TO_CLEAR: readonly string[] = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_CUSTOM_HEADERS',
  'API_TIMEOUT_MS',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
]

/**
 * 从 env 中删除所有 provider 认证 / 配置变量。
 *
 * 确定性变换；仅修改传入对象，不自行读取 process.env。
 */
export function clearAgentProviderEnv(env: Record<string, string | undefined>): void {
  for (const key of KEYS_TO_CLEAR) {
    delete env[key]
  }
}

/**
 * 根据 provider 类型向 env 注入对应的认证 / 配置变量。
 *
 * 确定性变换；仅修改传入对象，不自行读取 process.env。
 */
export function applyAgentProviderEnv(
  env: Record<string, string | undefined>,
  provider: ProviderType,
  apiKey: string,
  userAgent: string
): void {
  if (provider === 'kscc-internal') {
    return
  }

  if (
    provider === 'kimi-coding' ||
    provider === 'zhipu-coding' ||
    provider === 'xiaomi-token-plan'
  ) {
    env.ANTHROPIC_AUTH_TOKEN = apiKey
    env.ANTHROPIC_CUSTOM_HEADERS = `User-Agent: ${userAgent}`
    if (provider === 'zhipu-coding') {
      env.API_TIMEOUT_MS = '3000000'
      env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
    }
    return
  }

  if (provider === 'minimax') {
    env.ANTHROPIC_AUTH_TOKEN = apiKey
    env.API_TIMEOUT_MS = '3000000'
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
    return
  }

  env.ANTHROPIC_API_KEY = apiKey
}
