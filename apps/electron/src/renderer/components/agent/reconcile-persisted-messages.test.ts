import { describe, expect, test } from 'vitest'

import type { SDKMessage } from '@tagent/shared'
import {
  extractUserMessageText,
  isOptimisticUserMessage,
  reconcilePersistedMessagesOnReload,
} from './reconcile-persisted-messages'

function userMsg(text: string, opts?: { uuid?: string; optimistic?: boolean }): SDKMessage {
  return {
    type: 'user',
    uuid: opts?.uuid,
    message: { content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
    ...(opts?.optimistic ? { _optimistic: true } : {}),
  } as unknown as SDKMessage
}

function assistantMsg(text: string): SDKMessage {
  return {
    type: 'assistant',
    message: { content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
  } as unknown as SDKMessage
}

describe('reconcilePersistedMessagesOnReload', () => {
  test('idle reload trusts disk snapshot', () => {
    const disk = [userMsg('a'), assistantMsg('b')]
    const local = [...disk, userMsg('c', { optimistic: true, uuid: 'opt-1' })]
    expect(
      reconcilePersistedMessagesOnReload({
        diskMessages: disk,
        localMessages: local,
        preserveOptimistic: false,
      })
    ).toEqual(disk)
  })

  test('preserves trailing optimistic user bubble while busy', () => {
    const disk = [userMsg('a'), assistantMsg('b')]
    const optimistic = userMsg('c', { optimistic: true, uuid: 'opt-1' })
    const local = [...disk, optimistic]
    expect(
      reconcilePersistedMessagesOnReload({
        diskMessages: disk,
        localMessages: local,
        preserveOptimistic: true,
      })
    ).toEqual([...disk, optimistic])
  })

  test('drops optimistic bubble once disk already has the same user text', () => {
    const optimistic = userMsg('hello', { optimistic: true, uuid: 'opt-1' })
    const disk = [userMsg('hello')]
    expect(
      reconcilePersistedMessagesOnReload({
        diskMessages: disk,
        localMessages: [optimistic],
        preserveOptimistic: true,
      })
    ).toEqual(disk)
  })

  test('isOptimisticUserMessage only accepts flagged top-level user msgs', () => {
    expect(isOptimisticUserMessage(userMsg('x', { optimistic: true }))).toBe(true)
    expect(isOptimisticUserMessage(userMsg('x'))).toBe(false)
    expect(isOptimisticUserMessage(assistantMsg('x'))).toBe(false)
    expect(extractUserMessageText(userMsg('hello world'))).toBe('hello world')
  })
})
