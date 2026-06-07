/**
 * validateChannelModel (P0-2) 单测
 *
 * 通过 mock globalThis.fetch 覆盖三种 provider × 五种 HTTP 状态分支。
 * 全部用 proxyUrl='' 走全局 fetch 路径（让 mock 生效）。
 *
 * 详见 docs/plans/2026-06-05-tagent-fusion-design.md §8.4 P0-2
 */

import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'

// channel-manager.ts 在模块顶部 import { safeStorage } from 'electron'，
// electron 在测试运行时（非 Electron 主进程）加载不出来，所以先 mock 掉。
mock.module('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
  app: { getPath: () => '/tmp' },
}))

const { validateChannelModel } = await import('./channel-manager')

/** 构建一个 mock Response */
function mockResponse(status: number, body: string = ''): Response {
  return new Response(body, { status })
}

/** 记录调用 fetch 的 URL + headers + body 供测试断言 */
interface FetchCall {
  url: string
  init: RequestInit
}

let fetchCalls: FetchCall[] = []
let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  fetchCalls = []
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

/** 装一个会按 status 序列返回响应的 mock fetch */
function installMockFetch(responses: Array<{ status: number; body?: string }>) {
  let idx = 0
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    fetchCalls.push({ url, init: init ?? {} })
    const r = responses[Math.min(idx, responses.length - 1)]!
    idx++
    return mockResponse(r.status, r.body ?? '')
  }) as unknown as typeof globalThis.fetch
}

/** 装一个抛错的 mock fetch (网络层失败) */
function installMockFetchThrow(message: string) {
  globalThis.fetch = mock(async () => {
    throw new Error(message)
  }) as unknown as typeof globalThis.fetch
}

const ANTHROPIC_INPUT = {
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'sk-test-key',
  model: 'claude-sonnet-4-20250514',
  provider: 'anthropic' as const,
  proxyUrl: '',
}

const OPENAI_INPUT = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test-key',
  model: 'gpt-4',
  provider: 'openai' as const,
  proxyUrl: '',
}

const GOOGLE_INPUT = {
  baseUrl: 'https://generativelanguage.googleapis.com',
  apiKey: 'google-test-key',
  model: 'gemini-1.5-pro',
  provider: 'google' as const,
  proxyUrl: '',
}

// ============================================
// 输入校验
// ============================================

describe('validateChannelModel - 输入校验', () => {
  test('Given 空 model 名 When validate Then 返回失败 + "model 名称为空"', async () => {
    installMockFetch([])
    const r = await validateChannelModel({ ...ANTHROPIC_INPUT, model: '' })
    expect(r.success).toBe(false)
    expect(r.message).toBe('model 名称为空')
  })

  test('Given 纯空格 model 名 When validate Then 返回失败', async () => {
    installMockFetch([])
    const r = await validateChannelModel({ ...ANTHROPIC_INPUT, model: '   ' })
    expect(r.success).toBe(false)
    expect(r.message).toBe('model 名称为空')
  })
})

// ============================================
// Anthropic / DeepSeek / Kimi / 国产 系 (9 个 provider)
// ============================================

describe('validateChannelModel - anthropic family (200 OK)', () => {
  test('Given HTTP 200 When validate Then success + 验证通过', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    expect(r.success).toBe(true)
    expect(r.message).toContain('验证通过')
  })

  test('Given HTTP 200 When validate Then 请求 URL 拼 /messages + model 出现在 body', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    await validateChannelModel(ANTHROPIC_INPUT)
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]!.url).toMatch(/\/messages$/)
    const body = JSON.parse(fetchCalls[0]!.init.body as string)
    expect(body.model).toBe('claude-sonnet-4-20250514')
    expect(body.max_tokens).toBe(1)
    expect(body.messages).toEqual([{ role: 'user', content: 'ping' }])
  })

  test('Given anthropic provider When validate Then headers 含 x-api-key + anthropic-version', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    await validateChannelModel(ANTHROPIC_INPUT)
    const headers = fetchCalls[0]!.init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-test-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })
})

describe('validateChannelModel - anthropic family (4xx/5xx)', () => {
  test('Given HTTP 401 When validate Then "API Key 无效" + 错误体前 200 字', async () => {
    installMockFetch([{ status: 401, body: '{"error":"invalid x-api-key"}' }])
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^API Key 无效/)
    expect(r.message).toContain('invalid x-api-key')
  })

  test('Given HTTP 400 + body 含 "model" When validate Then "model 不被该供应商接受"', async () => {
    installMockFetch([{ status: 400, body: '{"error":"model not found"}' }])
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toContain('不被该供应商接受')
    expect(r.message).toContain('baseUrl')
  })

  test('Given HTTP 404 + body 含 "not.found" When validate Then "model 不被该供应商接受"', async () => {
    installMockFetch([{ status: 404, body: 'model not.found in registry' }])
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toContain('不被该供应商接受')
  })

  test('Given HTTP 400 + body 不含 model/invalid/not.found 关键字 When validate Then "请求被拒绝" + body', async () => {
    installMockFetch([{ status: 400, body: '{"error":"messages: field too long"}' }])
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^请求被拒绝/)
    expect(r.message).toContain('field too long')
  })

  test('Given HTTP 500 When validate Then "HTTP 500" + body 前 200 字', async () => {
    installMockFetch([{ status: 500, body: 'internal error stack trace' }])
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^HTTP 500/)
  })

  test('Given error body > 200 chars When validate Then 截断到 200 字', async () => {
    const long = 'X'.repeat(500)
    installMockFetch([{ status: 500, body: long }])
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    // 消息头是 "HTTP 500: "，加上截断的 body 200 字
    expect(r.message.length).toBeLessThanOrEqual('HTTP 500: '.length + 200)
  })
})

// ============================================
// Anthropic 系变体 (kimi-coding / zhipu-coding / xiaomi-token-plan) 走 Bearer + UA
// ============================================

describe('validateChannelModel - anthropic family header 变体', () => {
  test('Given kimi-coding provider When validate Then headers 用 Bearer + User-Agent, 不发 x-api-key', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    await validateChannelModel({ ...ANTHROPIC_INPUT, provider: 'kimi-coding', baseUrl: 'https://api.kimi.com/coding' })
    const headers = fetchCalls[0]!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test-key')
    expect(headers['User-Agent']).toMatch(/^TAgent\//)
    expect(headers['x-api-key']).toBeUndefined()
  })

  test('Given minimax provider When validate Then headers 用 Bearer, 不发 x-api-key', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    await validateChannelModel({ ...ANTHROPIC_INPUT, provider: 'minimax', baseUrl: 'https://api.minimax.com' })
    const headers = fetchCalls[0]!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test-key')
    expect(headers['x-api-key']).toBeUndefined()
  })
})

// ============================================
// OpenAI 系 (openai / zhipu / doubao / qwen / custom)
// ============================================

describe('validateChannelModel - openai family (200 OK)', () => {
  test('Given HTTP 200 When validate Then success + 请求 URL 拼 /chat/completions', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    const r = await validateChannelModel(OPENAI_INPUT)
    expect(r.success).toBe(true)
    expect(fetchCalls[0]!.url).toMatch(/\/chat\/completions$/)
  })

  test('Given openai provider When validate Then headers 用 Authorization Bearer', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    await validateChannelModel(OPENAI_INPUT)
    const headers = fetchCalls[0]!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test-key')
  })
})

describe('validateChannelModel - openai family (errors)', () => {
  test('Given HTTP 401 When validate Then "API Key 无效"', async () => {
    installMockFetch([{ status: 401, body: 'unauthorized' }])
    const r = await validateChannelModel(OPENAI_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^API Key 无效/)
  })

  test('Given HTTP 400 + body 含 "model" When validate Then "不被该供应商接受" (无 baseUrl 提示)', async () => {
    installMockFetch([{ status: 400, body: '{"error":"The model `gpt-99` does not exist"}' }])
    const r = await validateChannelModel(OPENAI_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toContain('不被该供应商接受')
    // openai 分支没有 baseUrl 提示（与 anthropic 分支不同）
    expect(r.message).not.toContain('baseUrl')
  })

  test('Given HTTP 500 When validate Then "HTTP 500"', async () => {
    installMockFetch([{ status: 500, body: 'oops' }])
    const r = await validateChannelModel(OPENAI_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^HTTP 500/)
  })
})

// ============================================
// Google Gemini
// ============================================

describe('validateChannelModel - google (200 OK)', () => {
  test('Given HTTP 200 When validate Then success + URL 含 model + key 查询参数', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    const r = await validateChannelModel(GOOGLE_INPUT)
    expect(r.success).toBe(true)
    expect(fetchCalls[0]!.url).toContain('gemini-1.5-pro')
    expect(fetchCalls[0]!.url).toContain('key=google-test-key')
    expect(fetchCalls[0]!.url).toContain(':generateContent')
  })

  test('Given model 名含特殊字符 When validate Then URL encode model 名', async () => {
    installMockFetch([{ status: 200, body: '{}' }])
    await validateChannelModel({ ...GOOGLE_INPUT, model: 'models/gemini-1.5-pro' })
    expect(fetchCalls[0]!.url).toContain('models%2Fgemini-1.5-pro')
  })
})

describe('validateChannelModel - google (errors)', () => {
  test('Given HTTP 400 + body 含 "model" When validate Then "不被该供应商接受"', async () => {
    installMockFetch([{ status: 400, body: '{"error":"Model not found"}' }])
    const r = await validateChannelModel(GOOGLE_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toContain('不被该供应商接受')
  })

  test('Given HTTP 401 When validate Then "API Key 无效"', async () => {
    installMockFetch([{ status: 401, body: 'API key not valid' }])
    const r = await validateChannelModel(GOOGLE_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^API Key 无效/)
  })

  test('Given HTTP 403 When validate Then "API Key 无效" (Google 用 403 表鉴权)', async () => {
    installMockFetch([{ status: 403, body: 'permission denied' }])
    const r = await validateChannelModel(GOOGLE_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^API Key 无效/)
  })

  test('Given HTTP 500 When validate Then "HTTP 500"', async () => {
    installMockFetch([{ status: 500, body: 'gemini died' }])
    const r = await validateChannelModel(GOOGLE_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^HTTP 500/)
  })
})

// ============================================
// 异常处理
// ============================================

describe('validateChannelModel - 网络层异常', () => {
  test('Given fetch 抛错 When validate Then 返回失败 + "验证失败: ..." (不外抛)', async () => {
    installMockFetchThrow('ECONNREFUSED')
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^验证失败:/)
    expect(r.message).toContain('ECONNREFUSED')
  })

  test('Given fetch 抛非 Error 对象 When validate Then 返回失败 + "未知错误"', async () => {
    globalThis.fetch = mock(async () => {
      throw 'string-not-error'  // eslint-disable-line @typescript-eslint/no-throw-literal
    }) as unknown as typeof globalThis.fetch
    const r = await validateChannelModel(ANTHROPIC_INPUT)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/^验证失败:/)
    expect(r.message).toContain('未知错误')
  })
})
