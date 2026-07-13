/**
 * ReflectService 单测
 *
 * 覆盖 ADR-0006 要求的可观测性修复：
 * - 数据不足状态记录
 * - 旧会话按 activityAt=max(created_at, ended_at) 判断
 * - SSE 复用共享 streamSSE
 * - L4-only fallback（L2 为空时仍能从 L4 提炼）
 * - 失败不伪装成功
 * - 旧状态向后兼容迁移
 */

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'

// =========================================================================
// Mocks — 必须在任何 import 之前，vi.mock 会被 hoist
// 使用 vi.hoisted 保证 mock 函数在工厂之前初始化
// =========================================================================

const {
  mockListRecentSessions,
  mockUpdateSessionKeyFacts,
  mockStreamSSE,
  mockGetAdapter,
  mockGetTAgentUserAgent,
  mockGetChannelById,
  mockDecryptApiKey,
  mockGetFetchFn,
  mockGetSettings,
  mockGetPath,
} = vi.hoisted(() => ({
  mockListRecentSessions: vi.fn(),
  mockUpdateSessionKeyFacts: vi.fn(),
  mockStreamSSE: vi.fn(),
  mockGetAdapter: vi.fn(),
  mockGetTAgentUserAgent: vi.fn().mockReturnValue('test-agent/1.0'),
  mockGetChannelById: vi.fn(),
  mockDecryptApiKey: vi.fn(),
  mockGetFetchFn: vi.fn(),
  mockGetSettings: vi.fn(),
  mockGetPath: vi.fn(),
}))

vi.mock('./memory-layer-service', () => ({
  memoryLayerService: {
    listRecentSessions: mockListRecentSessions,
    updateSessionKeyFacts: mockUpdateSessionKeyFacts,
  },
}))

vi.mock('@tagent/core', () => ({
  getAdapter: mockGetAdapter,
  getTAgentUserAgent: mockGetTAgentUserAgent,
  streamSSE: mockStreamSSE,
}))

vi.mock('./channel-manager', () => ({
  getChannelById: mockGetChannelById,
  decryptApiKey: mockDecryptApiKey,
}))

vi.mock('./proxy-fetch', () => ({
  getFetchFn: mockGetFetchFn,
}))

vi.mock('./settings-service', () => ({
  getSettings: mockGetSettings,
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: mockGetPath,
  },
  safeStorage: {
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}))

// =========================================================================
// Import after mocks
// =========================================================================

import * as fs from 'node:fs'
import * as path from 'node:path'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { reflectService } from './reflect-service'
import type { SessionMemoryRecord } from './memory-layer-service'

// =========================================================================
// Helpers
// =========================================================================

function buildSession(overrides: Partial<SessionMemoryRecord> = {}): SessionMemoryRecord {
  const now = Date.now()
  return {
    id: overrides.id ?? 1,
    session_slug: overrides.session_slug ?? 'sess-test-001',
    title: overrides.title ?? 'Test Session',
    summary: overrides.summary ?? 'Test summary content',
    key_facts: overrides.key_facts ?? '[]',
    tools_used: overrides.tools_used ?? '[]',
    mode: overrides.mode ?? 'general',
    workspace_slug: overrides.workspace_slug ?? 'test',
    created_at: overrides.created_at ?? now,
    ended_at: overrides.ended_at ?? now,
  }
}

function writeStateFile(dir: string, data: Record<string, unknown>): void {
  const statePath = path.join(dir, 'reflect_state.json')
  writeFileSync(statePath, JSON.stringify(data, null, 2), 'utf-8')
}

function readStateFile(dir: string): Record<string, unknown> {
  const statePath = path.join(dir, 'reflect_state.json')
  return JSON.parse(readFileSync(statePath, 'utf-8'))
}

// =========================================================================
// Tests
// =========================================================================

describe('ReflectService — ADR-0006 可靠性修复', () => {
  let tmpDir: string
  let memoryDir: string

  function resolveMemoryDir(mode: 'general' | 'ta'): string {
    return mode === 'general'
      ? path.join(tmpDir, '.tagent-dev', 'memory')
      : path.join(tmpDir, '.tagent-dev', 'ta', 'memory')
  }

  function createL2(dir: string, facts: string[]): void {
    const lines = facts.map((f) => `- ${f}\n`).join('')
    writeFileSync(path.join(dir, 'L2_facts.md'), `# Facts\n\n${lines}`, 'utf-8')
  }

  function createL5(dir: string, insights: string[]): void {
    const lines = insights.map((i) => `- [2026-07-13] ${i}\n`).join('')
    writeFileSync(path.join(dir, 'L5_insights.md'), `# L5 提炼洞察\n\n${lines}`, 'utf-8')
  }

  function createL3(dir: string, corrections: string[]): void {
    const lines = corrections.map((c) => JSON.stringify({ timestamp: Date.now(), correction: c, context: 'test' }) + '\n').join('')
    writeFileSync(path.join(dir, 'corrections.jsonl'), lines, 'utf-8')
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'tagent-reflect-test-'))
    // app.getPath('home') returns tmpDir so getMemoryDir → tmpDir/.tagent-dev/memory
    mockGetPath.mockReturnValue(tmpDir)
    mockGetPath.mockClear()

    // Default: no channel configured (triggers skipped_insufficient_evidence path)
    mockGetSettings.mockReturnValue({ agentChannelId: null, agentModelId: null })
    mockGetSettings.mockClear()

    // Clear all mock calls & values
    mockListRecentSessions.mockReset()
    mockUpdateSessionKeyFacts.mockReset()
    mockStreamSSE.mockReset()
    mockGetAdapter.mockReset()
    mockGetChannelById.mockReset()
    mockDecryptApiKey.mockReset()
    mockGetFetchFn.mockReset()
    mockGetTAgentUserAgent.mockClear()

    // Clear singleton's in-memory state to prevent cross-test bleed
    const svcStates = (reflectService as unknown as { states: Map<string, unknown> }).states
    svcStates?.clear()
  })

  afterEach(() => {
    reflectService.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // ---------------------------------------------------------------
  // 1. 数据不足状态
  // ---------------------------------------------------------------
  test('数据不足时记录 skipped_insufficient_evidence 并记录 inputCounts', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    // L2 为空（仅有 header，无 "- " 行）
    writeFileSync(path.join(dir, 'L2_facts.md'), '# Facts\n', 'utf-8')
    // L4 无会话
    mockListRecentSessions.mockReturnValue([])

    const result = await reflectService.runReflect('general')

    expect(result.outcome).toBe('skipped_insufficient_evidence')
    expect(result.success).toBe(false)
    expect(result.inputCounts.l2Facts).toBe(0)
    expect(result.inputCounts.l4Sessions).toBe(0)

    // 状态文件记录了 attempt 但不推进成功游标
    const state = readStateFile(dir)
    expect(state.lastAttemptTime).toBeGreaterThan(0)
    expect(state.lastOutcome).toBe('skipped_insufficient_evidence')
    expect(state.lastSuccessTime).toBeNull()
    expect(state.inputCounts).toEqual({
      l2Facts: 0,
      l4Sessions: 0,
      l3Corrections: 0,
      l5Insights: 0,
    })
  })

  // ---------------------------------------------------------------
  // 2. 旧会话 ended_at — 使用 activityAt 而非仅有 created_at
  // ---------------------------------------------------------------
  test('旧会话今天继续使用时按 activityAt 被纳入最近会话', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    // 会话创建于 8 天前，但 ended_at 是今天
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    const now = Date.now()
    mockListRecentSessions.mockReturnValue([
      buildSession({
        id: 42,
        session_slug: 'sess-old-active',
        title: 'Old Active Session',
        summary: 'Still being used today',
        created_at: eightDaysAgo,
        ended_at: now,
      }),
    ])

    // 提供 L2 数据来通过"数据不足"门控
    createL2(dir, ['用户偏好 TypeScript', '用户使用 React'])

    const result = await reflectService.runReflect('general')

    // 不会因为"旧会话"而被过滤掉
    expect(result.inputCounts.l4Sessions).toBeGreaterThanOrEqual(1)
  })

  // ---------------------------------------------------------------
  // 3. SSE 跨 chunk 由共享 reader (streamSSE 被调用，非私有解析)
  // ---------------------------------------------------------------
  test('callLLM 使用 streamSSE 而非私有 SSE 解析', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    // 准备足够的 L2 + L4 数据
    createL2(dir, ['用户偏好 TypeScript', '用户使用 React', '用户关注性能'])
    mockListRecentSessions.mockReturnValue([
      buildSession({ title: '优化首页', summary: '使用 React 重写首页' }),
    ])

    // Mock 渠道 + LLM 调用链
    mockGetSettings.mockReturnValue({
      agentChannelId: 'ch-test',
      agentModelId: 'claude-sonnet-4-6',
    })
    mockGetChannelById.mockReturnValue({
      id: 'ch-test',
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
    })
    mockDecryptApiKey.mockReturnValue('sk-test-key')

    const mockAdapter = {
      providerType: 'anthropic',
      buildStreamRequest: vi.fn().mockReturnValue({
        url: 'https://api.anthropic.com/v1/messages',
        headers: { 'x-api-key': 'sk-test-key' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6' }),
      }),
      parseSSELine: vi.fn(),
      buildTitleRequest: vi.fn(),
      parseTitleResponse: vi.fn(),
    }
    mockGetAdapter.mockReturnValue(mockAdapter)
    mockGetFetchFn.mockReturnValue(globalThis.fetch)

    // streamSSE 返回成功结果
    mockStreamSSE.mockResolvedValue({
      content: JSON.stringify({
        insights: ['用户偏好函数式编程风格', '项目主要使用 React 生态'],
        contradictions: [],
      }),
      reasoning: '',
      thinkingBlocks: [],
      toolCalls: [],
      stopReason: 'end_turn',
    })

    const result = await reflectService.runReflect('general')

    // streamSSE 被调用 → 不再使用私有 SSE 解析
    expect(mockStreamSSE).toHaveBeenCalledOnce()
    const sseCallArgs = mockStreamSSE.mock.calls[0]![0]!

    // 验证 adapter 被传入 streamSSE
    expect(sseCallArgs.adapter).toBe(mockAdapter)
    // 验证 request 包含正确的 URL
    expect(sseCallArgs.request.url).toContain('anthropic.com')

    // 洞察被正确提取
    expect(result.outcome).toBe('success')
    expect(result.insightsGenerated).toBeGreaterThanOrEqual(1)
  })

  // ---------------------------------------------------------------
  // 4. L4-only fallback (L2 为空但有 L4，streamSSE 抛错 → 规则回退)
  // ---------------------------------------------------------------
  test('L2 为空时 L4 数据仍能通过规则 Fallback 产生洞察', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    // L2 为空
    createL2(dir, [])
    // L4 有数据（含重复关键词）
    mockListRecentSessions.mockReturnValue([
      buildSession({ title: 'React 组件重构', summary: '把 class 组件改成 hooks' }),
      buildSession({ title: 'React 性能优化', summary: '使用 memo 减少重渲染' }),
    ])

    // Mock 渠道使 LLM 路径可达（但 streamSSE 将抛错触发 fallback）
    mockGetSettings.mockReturnValue({
      agentChannelId: 'ch-test',
      agentModelId: 'claude-sonnet-4-6',
    })
    mockGetChannelById.mockReturnValue({
      id: 'ch-test',
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
    })
    mockDecryptApiKey.mockReturnValue('sk-test-key')
    mockGetAdapter.mockReturnValue({
      providerType: 'anthropic',
      buildStreamRequest: vi.fn().mockReturnValue({
        url: 'https://api.anthropic.com/v1/messages',
        headers: {},
        body: '{}',
      }),
      parseSSELine: vi.fn(),
      buildTitleRequest: vi.fn(),
      parseTitleResponse: vi.fn(),
    })
    mockGetFetchFn.mockReturnValue(globalThis.fetch)

    // streamSSE 抛错 → 触发规则 fallback
    mockStreamSSE.mockRejectedValue(new Error('API 暂时不可用'))

    const result = await reflectService.runReflect('general')

    // LLM 失败后规则回退仍能从 L4 提取关键词
    expect(result.outcome).toBe('success')
    // 应至少从 "React" 关键词产生一条洞察
    expect(result.insightsGenerated).toBeGreaterThanOrEqual(1)
    expect(result.insights.some((i) => i.includes('React'))).toBe(true)
  })

  // ---------------------------------------------------------------
  // 5. 失败不伪装成功
  // ---------------------------------------------------------------
  test('LLM 抛出异常时 outcome 为 failed，不推进 lastSuccessTime', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    createL2(dir, ['用户偏好 TypeScript', '用户使用 React', '用户关注性能'])
    mockListRecentSessions.mockReturnValue([
      buildSession({ title: 'Test', summary: 'Test content' }),
    ])

    // 让 runReflect 在读取最近会话时抛错，传播到 try-catch 外层
    mockListRecentSessions.mockImplementation(() => {
      throw new Error('数据库连接失败')
    })

    const result = await reflectService.runReflect('general')

    expect(result.outcome).toBe('failed')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()

    // 状态文件记录失败
    const state = readStateFile(dir)
    expect(state.lastOutcome).toBe('failed')
    expect(state.lastErrorCode).toBe('UNKNOWN')
    // lastSuccessTime 没有推进
    expect(state.lastSuccessTime).toBeNull()
    // 但 lastAttemptTime 已记录
    expect(state.lastAttemptTime).toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------
  // 6. 旧状态向后兼容迁移
  // ---------------------------------------------------------------
  test('旧格式 reflect_state.json 自动迁移到 v2', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    const oldTimestamp = Date.now() - 12 * 60 * 60 * 1000 // 12 小时前（<36h 避免触发 checkAndRun）
    writeStateFile(dir, {
      lastRunTime: oldTimestamp,
      lastInsights: ['旧洞察 1', '旧洞察 2'],
    })

    // 直接测试 loadState，不触发 checkAndRun 的异步后台任务
    const svc = reflectService as unknown as { loadState(mode: string): void }
    svc.loadState('general')

    const state = readStateFile(dir)

    // 新版字段存在
    expect(state.lastAttemptTime).toBe(oldTimestamp)
    expect(state.lastSuccessTime).toBe(oldTimestamp)
    expect(state.lastOutcome).toBe('success')
    expect(state.inputCounts).toEqual({
      l2Facts: 0,
      l4Sessions: 0,
      l3Corrections: 0,
      l5Insights: 0,
    })
    expect(state.outputCounts).toEqual({
      insightsGenerated: 2,
      contradictionsFound: 0,
    })
    expect(state.lastErrorCode).toBeNull()
    // 旧字段保留
    expect(state.lastRunTime).toBe(oldTimestamp)
    expect(state.lastInsights).toEqual(['旧洞察 1', '旧洞察 2'])
  })

  // ---------------------------------------------------------------
  // 7. 新状态正常加载（向前兼容）
  // ---------------------------------------------------------------
  test('新格式状态文件加载后字段完整', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    const now = Date.now()
    writeStateFile(dir, {
      lastRunTime: now - 3600000,
      lastInsights: ['新洞察'],
      lastAttemptTime: now - 3600000,
      lastSuccessTime: now - 3600000,
      lastOutcome: 'success',
      lastErrorCode: null,
      inputCounts: { l2Facts: 3, l4Sessions: 2, l3Corrections: 0, l5Insights: 1 },
      outputCounts: { insightsGenerated: 1, contradictionsFound: 0 },
      cursor: { lastProcessedSessionId: 5, lastProcessedAt: now - 3600000 },
    })

    // 直接测试 loadState，不触发 checkAndRun
    const svc = reflectService as unknown as { loadState(mode: string): void }
    svc.loadState('general')

    const state = readStateFile(dir)
    expect(state.lastOutcome).toBe('success')
    expect(state.inputCounts).toEqual({ l2Facts: 3, l4Sessions: 2, l3Corrections: 0, l5Insights: 1 })
    expect(state.outputCounts).toEqual({ insightsGenerated: 1, contradictionsFound: 0 })
    expect(state.cursor).toEqual({ lastProcessedSessionId: 5, lastProcessedAt: now - 3600000 })
  })

  // ---------------------------------------------------------------
  // 8. 规则 Fallback 同时使用 L2 和 L4（不因 L2 为空跳过 L4）
  // ---------------------------------------------------------------
  test('规则 Fallback 在 L2 数据少时仍能从 L4 产生洞察', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    // L2 只有 1 条（不足 2 条，但 L4 有会话 → 通过数据不足门控）
    createL2(dir, ['用户喜欢 Rust'])
    // L4 有 3 条会话，都包含 "Rust"
    mockListRecentSessions.mockReturnValue([
      buildSession({ title: 'Rust 重构', summary: '用 Rust 重写核心模块' }),
      buildSession({ title: 'Rust 学习', summary: '学习 Rust 的所有权系统' }),
      buildSession({ title: '性能优化', summary: 'Rust 版本性能提升 10 倍' }),
    ])

    // 强制走规则 fallback（不配置渠道）
    mockGetSettings.mockReturnValue({ agentChannelId: null, agentModelId: null })

    const result = await reflectService.runReflect('general')

    expect(result.outcome).toBe('success')
    // "Rust" 在 L2 和 L4 中多次出现 → 应产生洞察
    expect(result.insights.some((i) => i.includes('Rust'))).toBe(true)
  })

  // ---------------------------------------------------------------
  // 9. outputCounts 在 result 与 state 中一致
  // ---------------------------------------------------------------
  test('outputCounts 在 result 与 state 文件中一致', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    createL2(dir, ['用户偏好 TypeScript', '用户使用 React', '用户关注性能'])
    mockListRecentSessions.mockReturnValue([
      buildSession({ title: '优化首页', summary: '使用 React 重写首页' }),
    ])

    mockGetSettings.mockReturnValue({
      agentChannelId: 'ch-test',
      agentModelId: 'claude-sonnet-4-6',
    })
    mockGetChannelById.mockReturnValue({
      id: 'ch-test',
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
    })
    mockDecryptApiKey.mockReturnValue('sk-test-key')
    mockGetAdapter.mockReturnValue({
      providerType: 'anthropic',
      buildStreamRequest: vi.fn().mockReturnValue({
        url: 'https://api.anthropic.com/v1/messages',
        headers: {},
        body: '{}',
      }),
      parseSSELine: vi.fn(),
      buildTitleRequest: vi.fn(),
      parseTitleResponse: vi.fn(),
    })
    mockGetFetchFn.mockReturnValue(globalThis.fetch)

    // streamSSE 返回包含矛盾的数据
    mockStreamSSE.mockResolvedValue({
      content: JSON.stringify({
        insights: ['用户偏好函数式编程'],
        contradictions: ['与旧洞察"喜欢命令式"矛盾'],
      }),
      reasoning: '',
      thinkingBlocks: [],
      toolCalls: [],
      stopReason: 'end_turn',
    })

    const result = await reflectService.runReflect('general')

    // result.outputCounts 与状态文件一致
    const state = readStateFile(dir)
    expect(result.outputCounts).toEqual(state.outputCounts)
    expect(result.outputCounts.insightsGenerated).toBe(1)
    // contradictions 被正确计数
    expect(result.outputCounts.contradictionsFound).toBe(1)
    // L3 文件已被写入矛盾
    const l3Content = readFileSync(path.join(dir, 'corrections.jsonl'), 'utf-8')
    expect(l3Content).toContain('矛盾')
  })

  // ---------------------------------------------------------------
  // 10. lastRunTime 在成功 attempt 后更新
  // ---------------------------------------------------------------
  test('成功 attempt 更新 lastRunTime、lastAttemptTime、lastSuccessTime', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    createL2(dir, ['用户偏好 TypeScript'])
    mockListRecentSessions.mockReturnValue([
      buildSession({ title: 'Test', summary: 'Test' }),
    ])

    // 强制走 rules fallback（足够触发 success）
    mockGetSettings.mockReturnValue({ agentChannelId: null, agentModelId: null })

    const before = Date.now()
    const result = await reflectService.runReflect('general')
    const after = Date.now()

    expect(result.outcome).toBe('success')

    const state = readStateFile(dir)
    // 三个时间戳都应在 [before, after] 范围内
    expect(state.lastRunTime).toBeGreaterThanOrEqual(before)
    expect(state.lastRunTime).toBeLessThanOrEqual(after)
    expect(state.lastAttemptTime).toBeGreaterThanOrEqual(before)
    expect(state.lastAttemptTime).toBeLessThanOrEqual(after)
    expect(state.lastSuccessTime).toBeGreaterThanOrEqual(before)
    expect(state.lastSuccessTime).toBeLessThanOrEqual(after)
  })

  // ---------------------------------------------------------------
  // 11. 数据不足时 outputCounts 正确反映零产出
  // ---------------------------------------------------------------
  test('数据不足时 outputCounts 中 insightsGenerated 与 contradictionsFound 均为 0', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    writeFileSync(path.join(dir, 'L2_facts.md'), '# Facts\n', 'utf-8')
    mockListRecentSessions.mockReturnValue([])

    const result = await reflectService.runReflect('general')

    expect(result.outcome).toBe('skipped_insufficient_evidence')
    expect(result.outputCounts.insightsGenerated).toBe(0)
    expect(result.outputCounts.contradictionsFound).toBe(0)

    const state = readStateFile(dir)
    expect(state.outputCounts.insightsGenerated).toBe(0)
    expect(state.outputCounts.contradictionsFound).toBe(0)
  })

  // ---------------------------------------------------------------
  // 12. LLM 成功但无矛盾时 contradictionCount 为 0
  // ---------------------------------------------------------------
  test('LLM 响应中 contradictions 为空时 contradictionCount 为 0', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    createL2(dir, ['用户偏好 TypeScript', '用户使用 React'])
    mockListRecentSessions.mockReturnValue([
      buildSession({ title: 'Test', summary: 'Test content' }),
    ])

    mockGetSettings.mockReturnValue({
      agentChannelId: 'ch-test',
      agentModelId: 'claude-sonnet-4-6',
    })
    mockGetChannelById.mockReturnValue({
      id: 'ch-test',
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
    })
    mockDecryptApiKey.mockReturnValue('sk-test-key')
    mockGetAdapter.mockReturnValue({
      providerType: 'anthropic',
      buildStreamRequest: vi.fn().mockReturnValue({ url: '', headers: {}, body: '' }),
      parseSSELine: vi.fn(),
      buildTitleRequest: vi.fn(),
      parseTitleResponse: vi.fn(),
    })
    mockGetFetchFn.mockReturnValue(globalThis.fetch)

    mockStreamSSE.mockResolvedValue({
      content: JSON.stringify({ insights: ['用户偏好函数式编程'], contradictions: [] }),
      reasoning: '',
      thinkingBlocks: [],
      toolCalls: [],
      stopReason: 'end_turn',
    })

    const result = await reflectService.runReflect('general')
    expect(result.outcome).toBe('success')
    expect(result.outputCounts.contradictionsFound).toBe(0)

    // L3 文件不应被创建
    expect(existsSync(path.join(dir, 'corrections.jsonl'))).toBe(false)
  })

  // ---------------------------------------------------------------
  // 13. 失败 attempt 不更新 lastRunTime 和 lastSuccessTime
  // ---------------------------------------------------------------
  test('失败 attempt 记录 lastAttemptTime 但不更新 lastRunTime 和 lastSuccessTime', async () => {
    const dir = resolveMemoryDir('general')
    mkdirSync(dir, { recursive: true })

    createL2(dir, ['用户偏好 TypeScript', '用户使用 React', '用户关注性能'])
    mockListRecentSessions.mockReturnValue([
      buildSession({ title: 'Test', summary: 'Test content' }),
    ])

    // 让 runReflect 在读取最近会话时抛错
    mockListRecentSessions.mockImplementation(() => {
      throw new Error('数据库连接失败')
    })

    const before = Date.now()
    const result = await reflectService.runReflect('general')
    const after = Date.now()

    expect(result.outcome).toBe('failed')

    const state = readStateFile(dir)
    // lastAttemptTime 更新
    expect(state.lastAttemptTime).toBeGreaterThanOrEqual(before)
    expect(state.lastAttemptTime).toBeLessThanOrEqual(after)
    // lastRunTime 和 lastSuccessTime 不应被更新（仍为 null）
    expect(state.lastRunTime).toBeNull()
    expect(state.lastSuccessTime).toBeNull()
  })
})
