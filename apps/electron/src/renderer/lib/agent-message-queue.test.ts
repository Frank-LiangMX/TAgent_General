import { describe, expect, it } from 'bun:test'

import {
  buildQueuedMessageSendPayload,
  createAgentQueuedMessage,
  moveQueuedMessage,
  removeQueuedMessage,
  restoreQueuedMessageToFront,
} from './agent-message-queue'

describe('Agent 消息队列', () => {
  it('创建队列消息时裁剪文本并保留引用', () => {
    const selection = {
      text: 'const answer = 42',
      filePath: 'src/example.ts',
      capturedAt: 123,
    }

    const message = createAgentQueuedMessage('  请修改这里  ', 'message-1', 456, selection)

    expect(message).toEqual({
      id: 'message-1',
      text: '请修改这里',
      createdAt: 456,
      quotedSelection: selection,
    })
  })

  it('支持删除、失败回滚且不会重复恢复', () => {
    const first = createAgentQueuedMessage('第一条', 'first', 1)
    const second = createAgentQueuedMessage('第二条', 'second', 2)

    expect(removeQueuedMessage([first, second], 'first')).toEqual([second])
    expect(restoreQueuedMessageToFront([second], first)).toEqual([first, second])
    expect(restoreQueuedMessageToFront([first, second], first)).toEqual([first, second])
  })

  it('支持拖拽调整消息顺序', () => {
    const first = createAgentQueuedMessage('第一条', 'first', 1)
    const second = createAgentQueuedMessage('第二条', 'second', 2)
    const third = createAgentQueuedMessage('第三条', 'third', 3)

    expect(moveQueuedMessage([first, second, third], 'third', 'first', 'before')).toEqual([
      third,
      first,
      second,
    ])
    expect(moveQueuedMessage([first, second, third], 'first', 'second', 'after')).toEqual([
      second,
      first,
      third,
    ])
  })

  it('发送时保留展示文本并从 SDK 文本中剥离 mention 标记', () => {
    const message = createAgentQueuedMessage(
      '请检查 /skill:review #mcp:github &session:session-2',
      'message-1',
      1,
      null,
      { fileReferenceBlock: '<attached_files>file.ts</attached_files>' }
    )

    const payload = buildQueuedMessageSendPayload(
      message,
      '<quoted_file path="file.ts">代码</quoted_file>'
    )

    expect(payload.rawText).toContain('/skill:review')
    expect(payload.sdkText).not.toContain('/skill:review')
    expect(payload.sdkText).toContain('请检查')
    expect(payload.mentions).toEqual({
      cleanedText: '请检查',
      mentionedSkills: ['review'],
      mentionedMcpServers: ['github'],
      mentionedSessionIds: ['session-2'],
    })
  })
})
