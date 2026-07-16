import { describe, expect, test } from 'vitest'

import { clearAgentProviderEnv, applyAgentProviderEnv } from './agent-provider-env'

describe('clearAgentProviderEnv', () => {
  test('Given 有残留 ANTHROPIC_* 变量 When clear Then 全部删除', () => {
    const env: Record<string, string | undefined> = {
      ANTHROPIC_API_KEY: 'old-key',
      ANTHROPIC_AUTH_TOKEN: 'old-token',
      ANTHROPIC_BASE_URL: 'https://old.url',
      ANTHROPIC_CUSTOM_HEADERS: 'X-Old: header',
      API_TIMEOUT_MS: '3000000',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      PATH: '/usr/bin',
    }

    clearAgentProviderEnv(env)

    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined()
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBeUndefined()
    expect(env.API_TIMEOUT_MS).toBeUndefined()
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBeUndefined()
    expect(env.PATH).toBe('/usr/bin')
  })
})

describe('applyAgentProviderEnv', () => {
  test('Given zhipu-coding When apply Then Bearer + UA + timeout + nonessential', () => {
    const env: Record<string, string | undefined> = {}

    applyAgentProviderEnv(env, 'zhipu-coding', 'zhipu-key-123', 'TestAgent/1.0')

    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('zhipu-key-123')
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBe('User-Agent: TestAgent/1.0')
    expect(env.API_TIMEOUT_MS).toBe('3000000')
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
  })

  test('Given kscc-internal When apply Then 无凭证注入', () => {
    const env: Record<string, string | undefined> = {}

    applyAgentProviderEnv(env, 'kscc-internal', 'kscc-key', 'TestAgent/1.0')

    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBeUndefined()
    expect(env.API_TIMEOUT_MS).toBeUndefined()
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBeUndefined()
  })

  test('Given minimax When apply Then Bearer + timeout + nonessential (无 UA)', () => {
    const env: Record<string, string | undefined> = {}

    applyAgentProviderEnv(env, 'minimax', 'minimax-key-456', 'TestAgent/1.0')

    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('minimax-key-456')
    expect(env.API_TIMEOUT_MS).toBe('3000000')
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBeUndefined()
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
  })

  test('Given anthropic (default) When apply Then 仅 API_KEY', () => {
    const env: Record<string, string | undefined> = {}

    applyAgentProviderEnv(env, 'anthropic', 'sk-ant-789', 'TestAgent/1.0')

    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-789')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBeUndefined()
    expect(env.API_TIMEOUT_MS).toBeUndefined()
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBeUndefined()
  })
})

describe('clearAgentProviderEnv + applyAgentProviderEnv 组合', () => {
  test('Given zhipu → clear → anthropic When 组合调用 Then 仅剩 API_KEY 且无旧 flags/Auth/Header', () => {
    const env: Record<string, string | undefined> = {}

    // 先注入 zhipu 凭证
    applyAgentProviderEnv(env, 'zhipu-coding', 'zhipu-key', 'TestAgent/1.0')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('zhipu-key')
    expect(env.API_TIMEOUT_MS).toBe('3000000')
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')

    // 清理
    clearAgentProviderEnv(env)
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.API_TIMEOUT_MS).toBeUndefined()
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBeUndefined()

    // 再注入 anthropic
    applyAgentProviderEnv(env, 'anthropic', 'sk-ant-key', 'TestAgent/1.0')
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-key')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBeUndefined()
    expect(env.API_TIMEOUT_MS).toBeUndefined()
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBeUndefined()
  })
})
