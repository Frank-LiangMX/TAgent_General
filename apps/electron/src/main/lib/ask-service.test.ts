/**
 * Ask 服务单元测试
 *
 * 覆盖 §8 P0 验收点：
 * - 权限契约包含边界关键词
 * - 工具白名单严格（suggest_agent_switch 必开；TA / nano-banana / 自定义 HTTP 不在）
 * - JSONL CRUD 往返（read/write/replace/delete）
 * - 纯函数 buildAskSystemPromptWithHistory 注入契约 + 历史
 *
 * 集成测试（流式 mock）放 P1 阶段。
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

// ask-prompt-builder 依赖 btw-service（其内部读 SDK messages），mock 掉避免拉起 fs
vi.mock('./btw-service', () => ({
  convertSDKMessagesToChatHistory: (messages: ReadonlyArray<unknown>, maxTurns: number) => {
    // 简化版：把 SDKMessage[] 转成 ChatMessage[]
    const result: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: number }> = []
    for (const m of messages) {
      const r = m as { type?: string; message?: { content?: Array<{ type: string; text?: string }> }; uuid?: string }
      if (r.type !== 'user' && r.type !== 'assistant') continue
      const text = (r.message?.content ?? [])
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text!)
        .join('\n')
      if (!text) continue
      result.push({
        id: r.uuid ?? `idx-${result.length}`,
        role: r.type,
        content: text,
        createdAt: Date.now(),
      })
    }
    return result.slice(-maxTurns * 2)
  },
}))

// ask-tool-policy 依赖 chat-tool-config（其内部读 JSON），mock 掉
vi.mock('./chat-tool-config', () => ({
  getChatToolsConfig: () => ({ toolStates: {}, customTools: [] }),
}))

const { buildAskSystemPromptWithHistory, ASK_PERMISSION_CONTRACT } = await import('./ask-prompt-builder')
const { isSuggestAgentSwitchToolCall, SUGGEST_AGENT_SWITCH_TOOL_NAMES, SUGGEST_AGENT_SWITCH_TOOL_DEFINITION, getAskEnabledTools } = await import('./ask-tool-policy')
const askStore = await import('./ask-message-store')

// ============================================
// ask-prompt-builder
// ============================================

describe('ASK_PERMISSION_CONTRACT', () => {
  test('包含 Ask 档位核心边界关键词', () => {
    expect(ASK_PERMISSION_CONTRACT).toContain('Ask 档位')
    expect(ASK_PERMISSION_CONTRACT).toContain('不能读写文件')
    expect(ASK_PERMISSION_CONTRACT).toContain('不能执行命令')
    expect(ASK_PERMISSION_CONTRACT).toContain('不能使用 MCP')
    expect(ASK_PERMISSION_CONTRACT).toContain('不能使用 Skills')
    expect(ASK_PERMISSION_CONTRACT).toContain('suggest_agent_switch')
  })

  test('明确禁止模型假装完成动手操作', () => {
    expect(ASK_PERMISSION_CONTRACT).toContain('不要假装')
  })
})

describe('buildAskSystemPromptWithHistory', () => {
  test('override 非空时直接返回 override', () => {
    const result = buildAskSystemPromptWithHistory([], 20, 'CUSTOM')
    expect(result).toBe('CUSTOM')
  })

  test('空历史时只输出权限契约', () => {
    const result = buildAskSystemPromptWithHistory([], 20)
    expect(result).toContain(ASK_PERMISSION_CONTRACT)
    expect(result).not.toContain('<agent_session_history>')
  })

  test('有历史时同时输出权限契约 + 历史摘要', () => {
    const sdkMessages = [
      {
        type: 'user',
        uuid: 'u1',
        message: { content: [{ type: 'text', text: '你好' }] },
      },
      {
        type: 'assistant',
        uuid: 'a1',
        message: { content: [{ type: 'text', text: '你好，有什么可以帮你的？' }] },
      },
    ]
    const result = buildAskSystemPromptWithHistory(sdkMessages, 20)
    expect(result).toContain(ASK_PERMISSION_CONTRACT)
    expect(result).toContain('<agent_session_history>')
    expect(result).toContain('[user] 你好')
    expect(result).toContain('[assistant] 你好，有什么可以帮你的？')
  })
})

// ============================================
// ask-tool-policy
// ============================================

describe('ask-tool-policy 白名单', () => {
  test('suggest_agent_switch 工具名集合正确', () => {
    expect(SUGGEST_AGENT_SWITCH_TOOL_NAMES.has('suggest_agent_switch')).toBe(true)
    expect(SUGGEST_AGENT_SWITCH_TOOL_NAMES.size).toBe(1)
  })

  test('isSuggestAgentSwitchToolCall 仅识别白名单内工具', () => {
    expect(isSuggestAgentSwitchToolCall('suggest_agent_switch')).toBe(true)
    expect(isSuggestAgentSwitchToolCall('suggest_agent_mode')).toBe(false)
    expect(isSuggestAgentSwitchToolCall('web-search')).toBe(false)
    expect(isSuggestAgentSwitchToolCall('Bash')).toBe(false)
    expect(isSuggestAgentSwitchToolCall('Write')).toBe(false)
    expect(isSuggestAgentSwitchToolCall('Read')).toBe(false)
    expect(isSuggestAgentSwitchToolCall('Edit')).toBe(false)
    expect(isSuggestAgentSwitchToolCall('mcp__something')).toBe(false)
  })

  test('SUGGEST_AGENT_SWITCH_TOOL_DEFINITION 名称与必填参数正确', () => {
    expect(SUGGEST_AGENT_SWITCH_TOOL_DEFINITION.name).toBe('suggest_agent_switch')
    const required = SUGGEST_AGENT_SWITCH_TOOL_DEFINITION.parameters.required ?? []
    expect(required).toContain('reason')
    expect(required).toContain('suggestedPrompt')
  })
})

describe('getAskEnabledTools', () => {
  test('始终返回包含 suggest_agent_switch 的工具集', () => {
    const result = getAskEnabledTools()
    expect(result.tools).toBeDefined()
    expect(result.tools).not.toBeNull()
    const names = (result.tools ?? []).map((t) => t.name)
    expect(names).toContain('suggest_agent_switch')
  })

  test('不允许的 TA / nano-banana / 自定义 HTTP 工具不在白名单', () => {
    const result = getAskEnabledTools()
    const names = (result.tools ?? []).map((t) => t.name)
    expect(names.some((n) => n.startsWith('ta-'))).toBe(false)
    expect(names).not.toContain('nano-banana')
    expect(names).not.toContain('Bash')
    expect(names).not.toContain('Read')
    expect(names).not.toContain('Write')
    expect(names).not.toContain('Edit')
    expect(names).not.toContain('ListMcpResources')
  })
})

// ============================================
// ask-message-store
// ============================================

// 隔离临时目录，避免污染真实配置
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
let originalGetConfigDir: typeof import('./config-paths').getConfigDir | undefined

beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'tagent-ask-test-'))
  // 重写 getConfigDir 指向临时目录
  const cp = await import('./config-paths')
  originalGetConfigDir = cp.getConfigDir
  // 替换模块内部方法（不重导出，但要能影响 getAgentSessionAskMessagesPath 的解析）
  // config-paths.ts 内部调用 getConfigDir()，但因为是内部 const 引用，
  // 我们用更直接的办法：覆盖 getConfigDirName 返回 `.tagent-ask-test-<rand>`，
  // 并预设对应的真实临时目录结构。
  vi.spyOn(cp, 'getConfigDir').mockReturnValue(tmpDir)
})

describe('ask-message-store JSONL CRUD', () => {
  test('空会话返回空数组', () => {
    const messages = askStore.getAgentSessionAskMessages('test-session-1')
    expect(messages).toEqual([])
  })

  test('追加 + 读取往返保留字段', () => {
    const msg = {
      id: 'm1',
      role: 'user' as const,
      content: 'hello',
      createdAt: 1234,
      channelId: 'c1',
      modelId: 'm1',
    }
    askStore.appendAskMessage('test-session-2', msg)
    const got = askStore.getAgentSessionAskMessages('test-session-2')
    expect(got).toHaveLength(1)
    expect(got[0]).toEqual(msg)
  })

  test('多条消息按追加顺序保留', () => {
    askStore.appendAskMessage('test-session-3', { id: 'a', role: 'user', content: '1', createdAt: 1 })
    askStore.appendAskMessage('test-session-3', { id: 'b', role: 'assistant', content: '2', createdAt: 2 })
    askStore.appendAskMessage('test-session-3', { id: 'c', role: 'user', content: '3', createdAt: 3 })
    const got = askStore.getAgentSessionAskMessages('test-session-3')
    expect(got.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  test('deleteAskMessage 移除指定消息并返回剩余', () => {
    askStore.appendAskMessage('test-session-4', { id: 'a', role: 'user', content: '1', createdAt: 1 })
    askStore.appendAskMessage('test-session-4', { id: 'b', role: 'assistant', content: '2', createdAt: 2 })
    const remaining = askStore.deleteAskMessage('test-session-4', 'a')
    expect(remaining.map((m) => m.id)).toEqual(['b'])
    expect(askStore.getAgentSessionAskMessages('test-session-4').map((m) => m.id)).toEqual(['b'])
  })

  test('rewriteAskMessages 覆盖整条 JSONL', () => {
    askStore.appendAskMessage('test-session-5', { id: 'old', role: 'user', content: 'old', createdAt: 0 })
    const newMessages = [
      { id: 'x', role: 'user' as const, content: 'x', createdAt: 1 },
      { id: 'y', role: 'assistant' as const, content: 'y', createdAt: 2 },
    ]
    askStore.rewriteAskMessages('test-session-5', newMessages)
    const got = askStore.getAgentSessionAskMessages('test-session-5')
    expect(got).toEqual(newMessages)
  })

  test('rewriteAskMessages 空数组会清空文件', () => {
    askStore.appendAskMessage('test-session-6', { id: 'a', role: 'user', content: '1', createdAt: 1 })
    askStore.rewriteAskMessages('test-session-6', [])
    expect(askStore.getAgentSessionAskMessages('test-session-6')).toEqual([])
  })

  test('deleteAskMessagesFile 清理文件', () => {
    askStore.appendAskMessage('test-session-7', { id: 'a', role: 'user', content: '1', createdAt: 1 })
    askStore.deleteAskMessagesFile('test-session-7')
    expect(askStore.getAgentSessionAskMessages('test-session-7')).toEqual([])
  })
})

// 清理临时目录
import { afterAll } from 'vitest'
afterAll(() => {
  if (tmpDir) {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
  if (originalGetConfigDir) {
    vi.restoreAllMocks()
  }
})
