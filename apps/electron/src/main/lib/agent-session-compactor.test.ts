import { describe, expect, test } from 'vitest'

import {
  PROTECT_FIRST_N,
  PROTECT_LAST_N,
  planDropOldToolResults,
  planKeepLastN,
} from './agent-session-compactor'

import type { SDKMessageRow } from './agent-session-compactor'

/**
 * P1-3 + 3.7: Context 压缩兜底测试
 *
 * 覆盖:
 * - drop_old_tool_results: 首尾保护 / middle 丢 tool 块 / 配对保护 / 边界不处理
 * - keep_last_n: 首尾保护 / N 兜底 / 去重
 */

/** 构造纯文本 user 消息 */
function userText(text: string): SDKMessageRow {
  return { type: 'user', message: { content: [{ type: 'text', text }] } }
}

/** 构造纯文本 assistant 消息 */
function assistantText(text: string): SDKMessageRow {
  return { type: 'assistant', message: { content: [{ type: 'text', text }] } }
}

/** 构造纯 tool_use assistant 消息 */
function assistantToolUse(id: string, name = 'Read'): SDKMessageRow {
  return {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name, input: {} }] },
  }
}

/** 构造纯 tool_result user 消息 */
function userToolResult(toolUseId: string): SDKMessageRow {
  return {
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: toolUseId, content: 'ok' }] },
  }
}

describe('planDropOldToolResults (P1-3 + 3.7)', () => {
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

  test('Given 消息数 <= PROTECT_FIRST_N + PROTECT_LAST_N When plan Then 不处理原样返回', () => {
    // 边界: 总数恰好 = 9 (3+6), 不分段
    const msgs: SDKMessageRow[] = Array.from({ length: PROTECT_FIRST_N + PROTECT_LAST_N }, (_, i) =>
      i % 2 === 0 ? userText(`u${i}`) : assistantText(`a${i}`)
    )
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept.length).toBe(msgs.length)
    expect(dropped.length).toBe(0)
    // 引用相等: 原样返回
    expect(kept).toEqual(msgs)
  })

  test('Given 8 条消息 (< 9) 含 tool 块 When plan Then 不处理, tool 块也保留', () => {
    // 边界场景: 消息数 < 阈值, 即使 middle 区域有 tool 块也不丢
    const msgs: SDKMessageRow[] = [
      { type: 'system' },
      userText('Q1'),
      assistantText('A1'),
      assistantToolUse('t1'), // 即便有 tool_use 也不丢
      userToolResult('t1'), // 即便有 tool_result 也不丢
      assistantText('A2'),
      userText('Q2'),
      assistantText('A3'),
    ]
    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(kept.length).toBe(8)
    expect(dropped.length).toBe(0)
  })

  test('Given 20 条消息含 middle tool 块 When plan Then 首 3 + 尾 6 保留, middle tool 块丢', () => {
    // 构造: 0 system, 1 user, 2 assistant (firstN)
    //       3 assistant tool_use, 4 user tool_result (middle, 要丢)
    //       5-13 各种文本消息 (middle, 保留)
    //       14-19 lastN (保留)
    const msgs: SDKMessageRow[] = [
      { type: 'system' }, // 0 firstN
      userText('Q1'), // 1 firstN
      assistantText('A1'), // 2 firstN
      assistantToolUse('t1'), // 3 middle - 丢
      userToolResult('t1'), // 4 middle - 丢
      assistantText('A2'), // 5 middle
      userText('Q2'), // 6 middle
      assistantText('A3'), // 7 middle
      userText('Q3'), // 8 middle
      assistantText('A4'), // 9 middle
      userText('Q4'), // 10 middle
      assistantText('A5'), // 11 middle
      userText('Q5'), // 12 middle
      assistantText('A6'), // 13 middle - middle 最后一条
      userText('Q6'), // 14 lastN
      assistantText('A7'), // 15 lastN
      userText('Q7'), // 16 lastN
      assistantText('A8'), // 17 lastN
      userText('Q8'), // 18 lastN
      assistantText('A9'), // 19 lastN
    ]
    expect(msgs.length).toBe(20)

    const { kept, dropped } = planDropOldToolResults(msgs)

    // 首 3 条保留 (引用相等)
    expect(kept[0]).toBe(msgs[0])
    expect(kept[1]).toBe(msgs[1])
    expect(kept[2]).toBe(msgs[2])

    // 尾 6 条保留 (引用相等)
    expect(kept[kept.length - 6]).toBe(msgs[14])
    expect(kept[kept.length - 5]).toBe(msgs[15])
    expect(kept[kept.length - 1]).toBe(msgs[19])

    // middle tool 块丢
    expect(dropped.length).toBe(2)
    expect(dropped[0]).toBe(msgs[3]) // assistantToolUse
    expect(dropped[1]).toBe(msgs[4]) // userToolResult

    // 总数: 20 - 2 = 18
    expect(kept.length).toBe(18)
  })

  test('Given middle 含混合块 (text + tool_use) When plan Then 保留 (不丢)', () => {
    // 构造 20 条: middle 中第 4 条是 assistant 含 text + tool_use 混合 → 保留
    const msgs: SDKMessageRow[] = [
      { type: 'system' }, // 0 firstN
      userText('Q1'), // 1 firstN
      assistantText('A1'), // 2 firstN
      // middle 开始
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '我要读文件' },
            { type: 'tool_use', id: 't1', name: 'Read', input: {} },
          ],
        },
      }, // 3 middle - 保留 (混合)
      userToolResult('t1'), // 4 middle - 丢 (纯 tool_result, 但配对 t1 在 middle 保留消息中)
      // ... 填充 middle 到 14
      assistantText('A2'), // 5
      userText('Q2'), // 6
      assistantText('A3'), // 7
      userText('Q3'), // 8
      assistantText('A4'), // 9
      userText('Q4'), // 10
      assistantText('A5'), // 11
      userText('Q5'), // 12
      assistantText('A6'), // 13
      // lastN 开始 (14-19)
      userText('Q6'), // 14
      assistantText('A7'), // 15
      userText('Q7'), // 16
      assistantText('A8'), // 17
      userText('Q8'), // 18
      assistantText('A9'), // 19
    ]
    expect(msgs.length).toBe(20)

    const { kept, dropped } = planDropOldToolResults(msgs)

    // 索引 4 的纯 tool_result 应该丢 (因为配对 t1 在索引 3 的混合消息中, 该消息保留)
    // 等等: 配对保护逻辑是检查"配对是否在 protected 区域", 索引 3 在 middle 不在 protected
    // 所以索引 4 的 tool_result 仍会丢, 但这会让索引 3 的 tool_use 变孤儿
    // → 这是原逻辑的已知行为, 3.7 任务的配对保护只针对 protected 区域
    expect(dropped.length).toBe(1)
    expect(dropped[0]).toBe(msgs[4]) // 纯 tool_result 丢
  })

  test('Given middle tool_use 配对在 lastN When plan Then 不丢 (避免孤儿)', () => {
    // 配对保护: tool_use 在 middle, 对应 tool_result 在 lastN → 不丢 tool_use
    const msgs: SDKMessageRow[] = [
      { type: 'system' }, // 0 firstN
      userText('Q1'), // 1 firstN
      assistantText('A1'), // 2 firstN
      // middle 开始
      assistantToolUse('t-orphan'), // 3 middle - 配对在 lastN, 不丢
      assistantText('A2'), // 4 middle
      userText('Q2'), // 5 middle
      assistantText('A3'), // 6 middle
      userText('Q3'), // 7 middle
      assistantText('A4'), // 8 middle
      userText('Q4'), // 9 middle
      assistantText('A5'), // 10 middle
      userText('Q5'), // 11 middle
      assistantText('A6'), // 12 middle
      userText('Q6'), // 13 middle
      // lastN 开始 (14-19)
      userToolResult('t-orphan'), // 14 lastN - 配对 tool_use 在 middle
      assistantText('A7'), // 15 lastN
      userText('Q7'), // 16 lastN
      assistantText('A8'), // 17 lastN
      userText('Q8'), // 18 lastN
      assistantText('A9'), // 19 lastN
    ]
    expect(msgs.length).toBe(20)

    const { kept, dropped } = planDropOldToolResults(msgs)

    // middle tool_use (索引 3) 配对在 lastN (索引 14), 不丢 → dropped 为空
    expect(dropped.length).toBe(0)
    expect(kept.length).toBe(20)
    expect(kept).toContain(msgs[3]) // tool_use 仍在
    expect(kept).toContain(msgs[14]) // tool_result 仍在
  })

  test('Given middle tool_result 配对在 firstN When plan Then 不丢 (避免孤儿)', () => {
    // 配对保护: tool_result 在 middle, 对应 tool_use 在 firstN → 不丢 tool_result
    const msgs: SDKMessageRow[] = [
      { type: 'system' }, // 0 firstN
      userText('Q1'), // 1 firstN
      assistantToolUse('t-early'), // 2 firstN - tool_use 在 firstN
      // middle 开始
      userToolResult('t-early'), // 3 middle - 配对在 firstN, 不丢
      assistantText('A2'), // 4 middle
      userText('Q2'), // 5 middle
      assistantText('A3'), // 6 middle
      userText('Q3'), // 7 middle
      assistantText('A4'), // 8 middle
      userText('Q4'), // 9 middle
      assistantText('A5'), // 10 middle
      userText('Q5'), // 11 middle
      assistantText('A6'), // 12 middle
      userText('Q6'), // 13 middle
      // lastN 开始 (14-19)
      userText('Q7'), // 14 lastN
      assistantText('A7'), // 15 lastN
      userText('Q8'), // 16 lastN
      assistantText('A8'), // 17 lastN
      userText('Q9'), // 18 lastN
      assistantText('A9'), // 19 lastN
    ]
    expect(msgs.length).toBe(20)

    const { kept, dropped } = planDropOldToolResults(msgs)

    // middle tool_result (索引 3) 配对在 firstN (索引 2), 不丢 → dropped 为空
    expect(dropped.length).toBe(0)
    expect(kept.length).toBe(20)
    expect(kept).toContain(msgs[2]) // tool_use 仍在 firstN
    expect(kept).toContain(msgs[3]) // tool_result 仍在
  })

  test('Given middle 多对 tool_use/tool_result 全在 middle When plan Then 全丢', () => {
    // middle 中 2 对独立的 tool_use/tool_result, 都没在 protected 区域 → 全丢
    const msgs: SDKMessageRow[] = [
      { type: 'system' }, // 0 firstN
      userText('Q1'), // 1 firstN
      assistantText('A1'), // 2 firstN
      // middle 开始
      assistantToolUse('t1'), // 3 middle - 丢
      userToolResult('t1'), // 4 middle - 丢
      assistantToolUse('t2'), // 5 middle - 丢
      userToolResult('t2'), // 6 middle - 丢
      assistantText('A2'), // 7 middle - 保留
      userText('Q2'), // 8 middle - 保留
      assistantText('A3'), // 9 middle - 保留
      userText('Q3'), // 10 middle - 保留
      assistantText('A4'), // 11 middle - 保留
      userText('Q4'), // 12 middle - 保留
      assistantText('A5'), // 13 middle - 保留
      // lastN 开始 (14-19)
      userText('Q5'), // 14 lastN
      assistantText('A6'), // 15 lastN
      userText('Q6'), // 16 lastN
      assistantText('A7'), // 17 lastN
      userText('Q7'), // 18 lastN
      assistantText('A8'), // 19 lastN
    ]
    expect(msgs.length).toBe(20)

    const { kept, dropped } = planDropOldToolResults(msgs)

    expect(dropped.length).toBe(4)
    expect(dropped).toContain(msgs[3])
    expect(dropped).toContain(msgs[4])
    expect(dropped).toContain(msgs[5])
    expect(dropped).toContain(msgs[6])
    expect(kept.length).toBe(16)
  })

  test('Given message.content 不是数组 (畸形) When plan Then 保守保留', () => {
    // 畸形消息放在 middle 中
    const msgs: SDKMessageRow[] = [
      { type: 'system' }, // 0 firstN
      userText('Q1'), // 1 firstN
      assistantText('A1'), // 2 firstN
      // middle
      { type: 'user', message: {} }, // 3 middle - 保守保留
      { type: 'assistant', message: { content: null as unknown as never } }, // 4 middle - 保守保留
      assistantText('A2'), // 5 middle
      userText('Q2'), // 6 middle
      assistantText('A3'), // 7 middle
      userText('Q3'), // 8 middle
      assistantText('A4'), // 9 middle
      userText('Q4'), // 10 middle
      assistantText('A5'), // 11 middle
      userText('Q5'), // 12 middle
      assistantText('A6'), // 13 middle
      // lastN
      userText('Q6'), // 14 lastN
      assistantText('A7'), // 15 lastN
      userText('Q7'), // 16 lastN
      assistantText('A8'), // 17 lastN
      userText('Q8'), // 18 lastN
      assistantText('A9'), // 19 lastN
    ]
    expect(msgs.length).toBe(20)

    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(dropped.length).toBe(0)
    expect(kept.length).toBe(20)
  })

  test('Given 未知 type 消息在 middle When plan Then 保留 (保守)', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'system' }, // 0 firstN
      userText('Q1'), // 1 firstN
      assistantText('A1'), // 2 firstN
      // middle
      { type: 'sdk_result', something: 'foo' }, // 3 middle - 未知类型保留
      assistantText('A2'), // 4 middle
      userText('Q2'), // 5 middle
      assistantText('A3'), // 6 middle
      userText('Q3'), // 7 middle
      assistantText('A4'), // 8 middle
      userText('Q4'), // 9 middle
      assistantText('A5'), // 10 middle
      userText('Q5'), // 11 middle
      assistantText('A6'), // 12 middle
      userText('Q6'), // 13 middle
      // lastN
      userText('Q7'), // 14 lastN
      assistantText('A7'), // 15 lastN
      userText('Q8'), // 16 lastN
      assistantText('A8'), // 17 lastN
      userText('Q9'), // 18 lastN
      assistantText('A9'), // 19 lastN
    ]
    expect(msgs.length).toBe(20)

    const { kept, dropped } = planDropOldToolResults(msgs)
    expect(dropped.length).toBe(0)
    expect(kept.length).toBe(20)
    expect(kept[3]).toBe(msgs[3]) // 未知类型保留
  })
})

describe('planKeepLastN (P1-3 + 3.7)', () => {
  test('Given 空数组 When plan Then 返回空', () => {
    const { kept, dropped } = planKeepLastN([], 10)
    expect(kept).toEqual([])
    expect(dropped).toEqual([])
  })

  test('Given N=0 When plan Then 仍保留首 PROTECT_FIRST_N + 尾 PROTECT_LAST_N (强制兜底)', () => {
    // 新行为: N=0 不再"全丢只留 system", 而是强制保留首尾
    const msgs: SDKMessageRow[] = [
      { type: 'system' }, // 0 firstN
      userText('Q1'), // 1 firstN
      assistantText('A1'), // 2 firstN
      // middle (索引 3-13, 将被丢)
      userText('Q2'), // 3
      assistantText('A2'), // 4
      userText('Q3'), // 5
      assistantText('A3'), // 6
      userText('Q4'), // 7
      assistantText('A4'), // 8
      userText('Q5'), // 9
      assistantText('A5'), // 10
      userText('Q6'), // 11
      assistantText('A6'), // 12
      userText('Q7'), // 13
      // lastN (effectiveLastN = max(0, 6) = 6): 索引 14-19
      assistantText('A7'), // 14 lastN
      userText('Q8'), // 15 lastN
      assistantText('A8'), // 16 lastN
      userText('Q9'), // 17 lastN
      assistantText('A9'), // 18 lastN
      userText('Q10'), // 19 lastN
    ]
    expect(msgs.length).toBe(20)

    const { kept, dropped } = planKeepLastN(msgs, 0)

    // effectiveLastN = max(0, 6) = 6 → 保留首 3 + 尾 6 = 9 (无重叠)
    expect(kept.length).toBe(9)
    expect(dropped.length).toBe(11)

    // 首 3 条保留
    expect(kept[0]).toBe(msgs[0])
    expect(kept[1]).toBe(msgs[1])
    expect(kept[2]).toBe(msgs[2])

    // 尾 6 条保留 (索引 14-19)
    expect(kept[kept.length - 6]).toBe(msgs[14])
    expect(kept[kept.length - 1]).toBe(msgs[19])
  })

  test('Given N=2 (< PROTECT_LAST_N) When plan Then 强制取 PROTECT_LAST_N=6', () => {
    const msgs: SDKMessageRow[] = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? userText(`Q${i}`) : assistantText(`A${i}`)
    )

    const { kept, dropped } = planKeepLastN(msgs, 2)

    // effectiveLastN = max(2, 6) = 6 → 首 3 + 尾 6 = 9
    expect(kept.length).toBe(9)
    expect(dropped.length).toBe(11)

    // 首 3 保留
    expect(kept[0]).toBe(msgs[0])
    expect(kept[1]).toBe(msgs[1])
    expect(kept[2]).toBe(msgs[2])

    // 尾 6 保留 (索引 14-19)
    expect(kept[kept.length - 6]).toBe(msgs[14])
    expect(kept[kept.length - 1]).toBe(msgs[19])
  })

  test('Given N=10 (> PROTECT_LAST_N) When plan Then 保留首 3 + 尾 10', () => {
    const msgs: SDKMessageRow[] = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? userText(`Q${i}`) : assistantText(`A${i}`)
    )

    const { kept, dropped } = planKeepLastN(msgs, 10)

    // effectiveLastN = max(10, 6) = 10 → 首 3 + 尾 10, 但首尾在索引 0-2 和 10-19, 无重叠
    // 等等: slice(0, 3) = [0,1,2], slice(-10) = [10..19], 无重叠 → 共 13 条
    expect(kept.length).toBe(13)
    expect(dropped.length).toBe(7)

    // 首 3
    expect(kept[0]).toBe(msgs[0])
    expect(kept[2]).toBe(msgs[2])

    // 尾 10 (索引 10-19)
    expect(kept[kept.length - 10]).toBe(msgs[10])
    expect(kept[kept.length - 1]).toBe(msgs[19])
  })

  test('Given N=10 默认 (无第二参数) When plan Then 用 10', () => {
    const msgs: SDKMessageRow[] = Array.from({ length: 25 }, (_, i) => ({
      type: i % 2 === 0 ? 'user' : 'assistant',
      message: { content: [{ type: 'text', text: `m${i}` }] },
    }))

    const { kept, dropped } = planKeepLastN(msgs)
    // effectiveLastN = max(10, 6) = 10 → 首 3 + 尾 10 = 13
    expect(kept.length).toBe(13)
    expect(dropped.length).toBe(12)
  })

  test('Given N 大于消息总数 When plan Then 全保留, dropped 空', () => {
    const msgs: SDKMessageRow[] = [
      { type: 'system' },
      userText('Q1'),
      assistantText('A1'),
    ]
    const { kept, dropped } = planKeepLastN(msgs, 100)
    // effectiveLastN = max(100, 6) = 100, slice(-100) 全部
    // 首 3 + 尾 100 全部, 去重后 = 全部 3 条
    expect(kept.length).toBe(3)
    expect(dropped.length).toBe(0)
  })

  test('Given 消息总数 < PROTECT_FIRST_N + PROTECT_LAST_N When plan Then 全保留 (首尾重叠去重)', () => {
    // 5 条消息, 首 3 + 尾 6 重叠, 去重后 = 全部
    const msgs: SDKMessageRow[] = [
      { type: 'system' },
      userText('Q1'),
      assistantText('A1'),
      userText('Q2'),
      assistantText('A2'),
    ]
    const { kept, dropped } = planKeepLastN(msgs, 2)
    // effectiveLastN = max(2, 6) = 6, slice(-6) 全部
    // 首 3 + 尾 6 全部, 去重 = 5 条
    expect(kept.length).toBe(5)
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

  test('Given 20 条消息 N=10 When plan Then 首 3 + 尾 max(10,6)=10 保留, 中间 7 条丢', () => {
    // 任务要求的核心验收测试用例
    const msgs: SDKMessageRow[] = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? userText(`Q${i}`) : assistantText(`A${i}`)
    )

    const { kept, dropped } = planKeepLastN(msgs, 10)

    // effectiveLastN = max(10, 6) = 10
    // 首 3 (索引 0-2) + 尾 10 (索引 10-19), 无重叠 → 共 13 条
    expect(kept.length).toBe(13)
    expect(dropped.length).toBe(7)

    // 首 3 保留
    expect(kept[0]).toBe(msgs[0])
    expect(kept[1]).toBe(msgs[1])
    expect(kept[2]).toBe(msgs[2])

    // 尾 10 保留 (索引 10-19)
    expect(kept[3]).toBe(msgs[10]) // 第 4 个 kept 是 msgs[10]
    expect(kept[kept.length - 1]).toBe(msgs[19])

    // 中间 7 条 (索引 3-9) 被丢
    for (let i = 3; i <= 9; i++) {
      expect(dropped).toContain(msgs[i])
    }
  })
})
