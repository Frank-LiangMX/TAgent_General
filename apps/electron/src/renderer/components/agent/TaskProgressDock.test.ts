import { describe, expect, test } from 'bun:test'

import type { SDKMessage } from '@tagent/shared'
import { sliceCurrentTurnMessages } from './TaskProgressDock'

function userText(text: string): SDKMessage {
  return {
    type: 'user',
    message: { content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
  } as unknown as SDKMessage
}

function toolResult(): SDKMessage {
  return {
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }],
    },
    parent_tool_use_id: null,
  } as unknown as SDKMessage
}

function assistant(): SDKMessage {
  return {
    type: 'assistant',
    message: { content: [{ type: 'text', text: 'hi' }] },
    parent_tool_use_id: null,
  } as unknown as SDKMessage
}

describe('sliceCurrentTurnMessages', () => {
  test('截取最近一次真实用户输入之后的消息', () => {
    const messages = [
      userText('旧问题'),
      assistant(),
      userText('新问题'),
      assistant(),
      toolResult(),
    ]
    const sliced = sliceCurrentTurnMessages(messages)
    expect(sliced).toHaveLength(3)
    expect(
      (sliced[0] as { message: { content: Array<{ text?: string }> } }).message.content[0]?.text
    ).toBe('新问题')
  })

  test('没有真实用户输入时返回空数组', () => {
    expect(sliceCurrentTurnMessages([assistant(), toolResult()])).toEqual([])
  })

  test('跳过 tool_result 用户消息', () => {
    const messages = [userText('提问'), toolResult(), assistant()]
    const sliced = sliceCurrentTurnMessages(messages)
    expect(sliced[0]).toBe(messages[0])
  })
})
