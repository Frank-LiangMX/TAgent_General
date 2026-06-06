import { describe, expect, test } from 'bun:test'
import { planDropOldToolResults, planKeepLastN } from './agent-session-compactor'
import type { SDKMessageRow } from './agent-session-compactor'

describe('planDropOldToolResults (P1-3)', () => {
  test('Given 空数组 When plan Then 返回空 kept + 空 dropped', () => {
    const { kept, dropped } = planDropOldToolResults([])
    expect(kept).toEqual([])
    expect(dropped).toEqual([])
  })

  test('Given 全 system 消息 When plan Then 全部保留', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'system', subtype: 'init' },
      { type: 'system', subtype: 'compact_boundary' },
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept).toEqual(msgs)
    expect(dropped).toEqual([])
  })

  test('Given user 消息只含 tool_result 块 When plan Then 丢', () => {
    const msgs: SDKMessageRow[] = [
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'result' },
          ],
        },
      },
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept).toEqual([])
    expect(dropped).toEqual(msgs)
  })

  test('Given user 消息含 text + tool_result 混合 When plan Then 保留', () => {
    const msgs: SDKMessageRow[] = [
      {
        type: 'user',
        message: {
          content: [
            { type: 'text', text: '用户问题' },
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'result' },
          ],
        },
      },
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept).toEqual(msgs)
    expect(dropped).toEqual([])
  })

  test('Given user 消息只含 text 块 When plan Then 保留', () => {
    const msgs: SDKMessageRow[] = [
      {
        type: 'user',
        message: { content: [{ type: 'text', text: '普通消息' }] },
      },
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept).toEqual(msgs)
    expect(dropped).toEqual([])
  })

  test('Given assistant 消息只含 tool_use 块 (无文本) When plan Then 丢', () => {
    const msgs: SDKMessageRow[] = [
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/x' } },
          ],
        },
      },
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept).toEqual([])
    expect(dropped).toEqual(msgs)
  })

  test('Given assistant 消息含 text + tool_use When plan Then 保留', () => {
    const msgs: SDKMessageRow[] = [
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '我要读取文件' },
            { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
          ],
        },
      },
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept).toEqual(msgs)
    expect(dropped).toEqual([])
  })

  test('Given 混合会话 (system+user+assistant+tool_result+tool_use) When plan Then 只丢纯 tool 块', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'system' },                                                                      // 0: 保留
      { type: 'user', message: { content: [{ type: 'text', text: 'Q1' }] } },               // 1: 保留
      { type: 'assistant', message: { content: [{ type: 'text', text: 'A1' }] } },         // 2: 保留
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1' }] } },     // 3: 丢
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1' }] } },  // 4: 丢
      { type: 'assistant', message: { content: [{ type: 'text', text: 'A2' }] } },         // 5: 保留
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept.length).toBe(4)  // 0, 1, 2, 5
    expect(dropped.length).toBe(2)  // 3, 4
    expect(kept[0]?.type).toBe('system')
    expect(kept[1]?.type).toBe('user')
    expect(kept[2]?.type).toBe('assistant')
    expect(kept[3]?.type).toBe('assistant')
    expect(dropped[0]?.type).toBe('assistant')
    expect(dropped[1]?.type).toBe('user')
  })

  test('Given message.content 不是数组 (畸形) When plan Then 保守保留', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'user', message: {} },
      { type: 'assistant', message: { content: null as unknown as never } },
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept).toEqual(msgs)
    expect(dropped).toEqual([])
  })

  test('Given 未知 type 消息 When plan Then 保留 (保守)', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'sdk_result', something: 'foo' },
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept).toEqual(msgs)
    expect(dropped).toEqual([])
  })
})

describe('planKeepLastN (P1-3)', () => {
  test('Given N=0 When plan Then 只保留 system, 丢全部其他', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'system' },
      { type: 'user', message: { content: [{ type: 'text' }] } },
      { type: 'assistant', message: { content: [{ type: 'text' }] } },
    ]
    const { kept, dropped } = planKeepLastN(msgs, 0)
    expect(kept.length).toBe(1)
    expect(kept[0]?.type).toBe('system')
    expect(dropped.length).toBe(2)
  })

  test('Given N=2 When plan Then 保留最后 2 条 user+assistant + 全部 system', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'system' },
      { type: 'user', message: { content: [{ type: 'text', text: 'Q1' }] } },    // 0
      { type: 'assistant', message: { content: [{ type: 'text', text: 'A1' }] } }, // 1
      { type: 'user', message: { content: [{ type: 'text', text: 'Q2' }] } },    // 2
      { type: 'assistant', message: { content: [{ type: 'text', text: 'A2' }] } }, // 3
      { type: 'user', message: { content: [{ type: 'text', text: 'Q3' }] } },    // 4
      { type: 'assistant', message: { content: [{ type: 'text', text: 'A3' }] } }, // 5
    ]
    const { kept, dropped } = planKeepLastN(msgs, 2)
    // system + 最后 2 条 (Q3, A3)
    expect(kept.length).toBe(3)
    expect(kept[0]?.type).toBe('system')
    expect(kept[1]?.type).toBe('user')
    expect(kept[2]?.type).toBe('assistant')
    expect(dropped.length).toBe(4)
  })

  test('Given N 大于非系统消息总数 When plan Then 全部保留, dropped 空', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'system' },
      { type: 'user', message: { content: [{ type: 'text', text: 'Q1' }] } },
    ]
    const { kept, dropped } = planKeepLastN(msgs, 100)
    expect(kept.length).toBe(2)
    expect(dropped.length).toBe(0)
  })

  test('Given 只有 system 消息 When plan Then 全保留, dropped 空', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'system' },
      { type: 'system', subtype: 'compact_boundary' },
    ]
    const { kept, dropped } = planKeepLastN(msgs, 5)
    expect(kept.length).toBe(2)
    expect(dropped.length).toBe(0)
  })

  test('Given 默认 N=10 When plan Then 用 10', () => {
    const msgs: SDKMessageRow[] = Array.from({ length: 25 }, (_, i) => ({
      type: i % 2 === 0 ? 'user' : 'assistant',
      message: { content: [{ type: 'text', text: `m${i}` }] },
    }))
    const { kept, dropped } = planKeepLastN(msgs)
    expect(kept.length).toBe(10)  // 默认 10
    expect(dropped.length).toBe(15)
  })
})
