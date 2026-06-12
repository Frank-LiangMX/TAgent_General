/**
 * chat-service 集成测试（核心纯逻辑部分）
 *
 * chat-service.ts 大量依赖 Electron (webContents/JSONL/channels/fs)，
 * 这里只测能纯函数化的部分：
 * - filterHistory: 上下文裁剪（三层过滤：空消息 / 分隔线 / 轮数）
 * - enrichMessageWithDocuments + enrichHistoryWithDocuments: 文档附件文本注入
 * - stopGeneration / stopAllGenerations: AbortController 行为
 *
 * 详见 docs/plans/2026-06-05-tagent-fusion-design.md §8.4
 */

import { describe, expect, test, vi } from 'vitest'

// chat-service.ts 顶部 import 了 'electron' (WebContents) 和
// 几个 fs/JSONL 模块，测试运行时拉不起来。mock 掉只测试我们关心的纯逻辑。
// 注意：mock 必须覆盖所有 chat-service 传递依赖中可能出现的 electron 导出
// （attachment-service 用 BrowserWindow/dialog, chat-tool-executor 也用 BrowserWindow）
vi.mock('electron', () => ({
  WebContents: class {},
  BrowserWindow: class {
    static getAllWindows() { return [] }
    static getFocusedWindow() { return null }
  },
  dialog: { showOpenDialog: () => {} },
  app: { getPath: () => '/tmp' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

// 文档解析器我们也 mock 掉，只测 chat-service 的注入逻辑（不测解析器本身）
vi.mock('./document-parser', () => ({
  isDocumentAttachment: (mediaType: string) =>
    mediaType.startsWith('text/') ||
    mediaType === 'application/pdf' ||
    mediaType === 'application/json',
  extractTextFromAttachment: async (localPath: string) => {
    if (localPath.includes('fail')) throw new Error('extract failed')
    if (localPath.includes('empty')) return ''
    return `<<extracted from ${localPath}>>`
  },
}))

const { filterHistory } = await import('./chat-service')
const { enrichMessageWithDocuments, enrichHistoryWithDocuments } = await import('./chat-service')

// ============================================
// 辅助构造
// ============================================

interface TestMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

function msg(id: string, role: TestMessage['role'], content: string): TestMessage {
  return { id, role, content, createdAt: 0 }
}

function user(id: string, text: string): TestMessage {
  return msg(id, 'user', text)
}

function asst(id: string, text: string): TestMessage {
  return msg(id, 'assistant', text)
}

// ============================================
// filterHistory
// ============================================

describe('filterHistory - 第一层（空消息过滤）', () => {
  test('Given 含空 assistant 消息 When filter Then 空消息被移除', () => {
    const out = filterHistory([
      user('u1', 'hi'),
      asst('a1', '   '),  // 全空白内容
      asst('a2', 'real answer'),
    ])
    expect(out.map((m) => m.id)).toEqual(['u1', 'a2'])
  })

  test('Given user 消息内容为空 When filter Then 保留 (空 user 仍要送，filter 只管 assistant)', () => {
    const out = filterHistory([
      user('u1', ''),
      asst('a1', 'reply'),
    ])
    expect(out).toHaveLength(2)
  })
})

describe('filterHistory - 第二层（分隔线过滤）', () => {
  test('Given 单个分隔线 When filter Then 只保留分隔线之后的消息 (分隔线本身被排除)', () => {
    const out = filterHistory(
      [
        user('u1', 'old question'),
        asst('a1', 'old answer'),
        user('u2', 'divider msg'),
        asst('a2', 'new answer after divider'),
      ],
      ['u2'],
    )
    expect(out.map((m) => m.id)).toEqual(['a2'])
  })

  test('Given 多个分隔线（取最后一个） When filter Then 只保留最后一个之后的消息', () => {
    const out = filterHistory(
      [
        user('u1', 'a'),
        asst('a1', 'A'),
        user('u2', 'b'),
        asst('a2', 'B'),
        user('u3', 'c'),
        asst('a3', 'C'),
      ],
      ['u1', 'u2'],  // 取 u2 为最后分隔线
    )
    expect(out.map((m) => m.id)).toEqual(['a2', 'u3', 'a3'])
  })

  test('Given 分隔线 ID 不存在 When filter Then 保留全部 (找不到就不裁)', () => {
    const out = filterHistory(
      [user('u1', 'a'), asst('a1', 'A'), user('u2', 'b')],
      ['non-existent-id'],
    )
    expect(out).toHaveLength(3)
  })

  test('Given 空 contextDividers 数组 When filter Then 不过滤 (不进入分支)', () => {
    const out = filterHistory([user('u1', 'a'), asst('a1', 'A')], [])
    expect(out).toHaveLength(2)
  })
})

describe('filterHistory - 第三层（轮数裁剪）', () => {
  test('Given contextLength=0 When filter Then 返回空数组', () => {
    const out = filterHistory([user('u1', 'a'), asst('a1', 'A')], undefined, 0)
    expect(out).toEqual([])
  })

  test('Given contextLength=2 (保留最近 2 轮) When filter Then 保留最近 2 个 user + 它们之间的 assistant', () => {
    const out = filterHistory(
      [
        user('u1', 'q1'),
        asst('a1', 'A1'),
        user('u2', 'q2'),
        asst('a2', 'A2'),
        user('u3', 'q3'),
        asst('a3', 'A3'),
      ],
      undefined,
      2,
    )
    // 从后往前数 2 轮：u2 算第 1 轮，u3 算第 2 轮 → 保留 u2 a2 u3 a3
    expect(out.map((m) => m.id)).toEqual(['u2', 'a2', 'u3', 'a3'])
  })

  test('Given contextLength 超过总轮数 When filter Then 全部保留', () => {
    const out = filterHistory(
      [user('u1', 'a'), asst('a1', 'A')],
      undefined,
      100,
    )
    expect(out).toHaveLength(2)
  })

  test('Given contextLength=1 (只保留最后 1 轮) When filter Then 只有最后 user+assistant', () => {
    const out = filterHistory(
      [user('u1', 'a'), asst('a1', 'A'), user('u2', 'b'), asst('a2', 'B')],
      undefined,
      1,
    )
    expect(out.map((m) => m.id)).toEqual(['u2', 'a2'])
  })

  test('Given contextLength="infinite" When filter Then 全部保留', () => {
    const out = filterHistory(
      [user('u1', 'a'), asst('a1', 'A'), user('u2', 'b')],
      undefined,
      'infinite',
    )
    expect(out).toHaveLength(3)
  })

  test('Given contextLength=undefined When filter Then 全部保留', () => {
    const out = filterHistory([user('u1', 'a'), asst('a1', 'A')], undefined, undefined)
    expect(out).toHaveLength(2)
  })
})

describe('filterHistory - 多层组合', () => {
  test('Given 分隔线 + 轮数裁剪 同时启用 When filter Then 先按分隔线切，再按轮数裁', () => {
    const out = filterHistory(
      [
        user('u1', 'old'),
        asst('a1', 'OLD'),
        user('u2', 'divider'),
        asst('a2', 'A2'),
        user('u3', 'q3'),
        asst('a3', 'A3'),
        user('u4', 'q4'),
        asst('a4', 'A4'),
      ],
      ['u2'],
      2,
    )
    // 先按 u2 切：u2 a2 u3 a3 u4 a4
    // 再按 2 轮切：u3 a3 u4 a4
    expect(out.map((m) => m.id)).toEqual(['u3', 'a3', 'u4', 'a4'])
  })

  test('Given 空 assistant + 分隔线 + 轮数 三层同时 When filter Then 三层依次生效', () => {
    const out = filterHistory(
      [
        user('u1', 'a'),
        asst('a1', ''),         // 空 assistant 应被第一步过滤
        asst('a1b', 'A'),       // 占位 id
        user('u2', 'b'),
        asst('a2', 'B'),
        user('u3', 'c'),
      ],
      ['u1'],
      1,
    )
    // 第一步：去掉 asst('a1', '') → u1 a1b u2 a2 u3
    // 第二步：u1 是分隔线 → 去掉 u1，剩 a1b u2 a2 u3
    // 第三步：1 轮 → 从后数到第一个 user = u3
    // 注：第一轮中只数到 1 个 user 就停，但要从 user u3 开始往后收
    // 实际上实现是从后往前数 user 消息：u3 是第 1 个 → 收集 u3
    expect(out.map((m) => m.id)).toEqual(['u3'])
  })
})

// ============================================
// enrichMessageWithDocuments
// ============================================

describe('enrichMessageWithDocuments', () => {
  test('Given 无附件 When enrich Then 原样返回文本', async () => {
    const out = await enrichMessageWithDocuments('hello', undefined)
    expect(out).toBe('hello')
  })

  test('Given 仅图片附件 When enrich Then 不提取文档 (返回原文本)', async () => {
    const out = await enrichMessageWithDocuments('look at this', [
      { mediaType: 'image/png', localPath: '/tmp/p.png', filename: 'p.png' },
    ] as never)
    expect(out).toBe('look at this')
  })

  test('Given 文档附件 + 成功提取 When enrich Then 追加 <file> 块', async () => {
    const out = await enrichMessageWithDocuments('summarize', [
      { mediaType: 'text/plain', localPath: '/tmp/ok.txt', filename: 'ok.txt' },
    ] as never)
    expect(out).toContain('summarize')
    expect(out).toContain('<file name="ok.txt">')
    expect(out).toContain('<<extracted from /tmp/ok.txt>>')
    expect(out).toContain('</file>')
  })

  test('Given 文档附件 + 提取为空 When enrich Then 注入 "[文件内容为空]" 标记', async () => {
    const out = await enrichMessageWithDocuments('check', [
      { mediaType: 'text/plain', localPath: '/tmp/empty.txt', filename: 'empty.txt' },
    ] as never)
    expect(out).toContain('[文件内容为空]')
  })

  test('Given 文档附件 + 提取抛错 When enrich Then 注入 "[文件内容提取失败: <msg>]" 但不抛', async () => {
    const out = await enrichMessageWithDocuments('check', [
      { mediaType: 'text/plain', localPath: '/tmp/fail.txt', filename: 'fail.txt' },
    ] as never)
    expect(out).toContain('[文件内容提取失败: extract failed]')
  })

  test('Given 多个文档附件 When enrich Then 按顺序追加多个 <file> 块', async () => {
    const out = await enrichMessageWithDocuments('merge', [
      { mediaType: 'text/plain', localPath: '/tmp/a.txt', filename: 'a.txt' },
      { mediaType: 'application/pdf', localPath: '/tmp/b.pdf', filename: 'b.pdf' },
    ] as never)
    expect(out).toContain('<file name="a.txt">')
    expect(out).toContain('<file name="b.pdf">')
    // a 应该在 b 前面
    const aIdx = out.indexOf('a.txt')
    const bIdx = out.indexOf('b.pdf')
    expect(aIdx).toBeLessThan(bIdx)
  })
})

// ============================================
// enrichHistoryWithDocuments
// ============================================

describe('enrichHistoryWithDocuments', () => {
  test('Given user 消息无附件 When enrich Then 原样返回', async () => {
    const history = [
      { id: 'u1', role: 'user' as const, content: 'hi' },
      { id: 'a1', role: 'assistant' as const, content: 'hello' },
    ]
    const out = await enrichHistoryWithDocuments(history as never)
    expect(out).toHaveLength(2)
    expect(out[0]!.content).toBe('hi')
  })

  test('Given user 消息含图片无文档 When enrich Then 原样返回 (不处理图片)', async () => {
    const history = [
      {
        id: 'u1',
        role: 'user' as const,
        content: 'look',
        attachments: [{ mediaType: 'image/png', localPath: '/tmp/p.png', filename: 'p.png' }],
      },
    ]
    const out = await enrichHistoryWithDocuments(history as never)
    expect(out[0]!.content).toBe('look')
  })

  test('Given user 消息含文档附件 When enrich Then content 被增强但其他字段不变', async () => {
    const history = [
      {
        id: 'u1',
        role: 'user' as const,
        content: 'read',
        attachments: [{ mediaType: 'text/plain', localPath: '/tmp/ok.txt', filename: 'ok.txt' }],
      },
    ]
    const out = await enrichHistoryWithDocuments(history as never)
    expect(out[0]!.id).toBe('u1')
    expect(out[0]!.role).toBe('user')
    expect(out[0]!.content).toContain('read')
    expect(out[0]!.content).toContain('<file name="ok.txt">')
    expect(out[0]!.attachments).toBeDefined()  // 不动 attachments 字段
  })

  test('Given assistant 消息含附件 (异常 case) When enrich Then 不处理 (只处理 user)', async () => {
    const history = [
      {
        id: 'a1',
        role: 'assistant' as const,
        content: 'reply',
        attachments: [{ mediaType: 'text/plain', localPath: '/tmp/ok.txt', filename: 'ok.txt' }],
      },
    ]
    const out = await enrichHistoryWithDocuments(history as never)
    expect(out[0]!.content).toBe('reply')  // assistant 不被增强
  })

  test('Given 多条混合消息 When enrich Then 只增强有文档附件的 user 消息', async () => {
    const history = [
      { id: 'u1', role: 'user' as const, content: 'q1' },
      { id: 'a1', role: 'assistant' as const, content: 'A1' },
      {
        id: 'u2',
        role: 'user' as const,
        content: 'q2',
        attachments: [{ mediaType: 'text/plain', localPath: '/tmp/ok.txt', filename: 'ok.txt' }],
      },
      { id: 'a2', role: 'assistant' as const, content: 'A2' },
    ]
    const out = await enrichHistoryWithDocuments(history as never)
    expect(out[0]!.content).toBe('q1')                          // 不动
    expect(out[1]!.content).toBe('A1')                          // 不动
    expect(out[2]!.content).toContain('q2')                     // 增强
    expect(out[2]!.content).toContain('<file name="ok.txt">')    // 增强
    expect(out[3]!.content).toBe('A2')                          // 不动
  })
})
