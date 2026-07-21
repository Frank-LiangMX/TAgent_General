import { describe, expect, it } from 'vitest'

import {
  ASSISTANT_TYPING_STEPS,
  getAssistantAmbientMicrocopy,
  getAssistantStateMicrocopy,
  getAssistantToolMicrocopy,
  shouldAcknowledgeSend,
} from './assistant-microcopy'

describe('assistant microcopy', () => {
  it('uses a short three-step typing rhythm', () => {
    expect(ASSISTANT_TYPING_STEPS).toEqual(['哒·', '哒哒·', '哒哒哒…'])
  })

  it('translates implementation-oriented tool names into friendly phrases', () => {
    expect(getAssistantToolMicrocopy('Read')).toBe('我去找找')
    expect(getAssistantToolMicrocopy('apply_patch')).toBe('正在改')
    expect(getAssistantToolMicrocopy('shell_command')).toBe('跑一下看看')
    expect(getAssistantToolMicrocopy('spawn_agent')).toBe('叫个帮手一起')
    expect(getAssistantToolMicrocopy('custom_tool')).toBe('正在处理')
  })

  it('reserves automatic copy for states that need explicit feedback', () => {
    expect(getAssistantStateMicrocopy('success')).toBe('好啦 ✦')
    expect(getAssistantStateMicrocopy('needs-input')).toBe('这里需要你点一下')
    expect(getAssistantStateMicrocopy('error')).toBe('这里卡住了')
    expect(getAssistantStateMicrocopy('standby')).toBeNull()
    expect(getAssistantStateMicrocopy('acting')).toBeNull()
  })

  it('gives every quiet working state a low-priority ambient phrase', () => {
    expect(getAssistantAmbientMicrocopy('standby')).toBe('我在这儿')
    expect(getAssistantAmbientMicrocopy('input')).toBe('你说，我听着')
    expect(getAssistantAmbientMicrocopy('thinking')).toBe('让我捋一捋…')
    expect(getAssistantAmbientMicrocopy('acting')).toBe('我动手啦')
    expect(getAssistantAmbientMicrocopy('success')).toBeNull()
  })

  it('acknowledges a new send without repeating during an existing run', () => {
    expect(shouldAcknowledgeSend('input', 'thinking')).toBe(true)
    expect(shouldAcknowledgeSend('standby', 'acting')).toBe(true)
    expect(shouldAcknowledgeSend('thinking', 'acting')).toBe(false)
    expect(shouldAcknowledgeSend('acting', 'success')).toBe(false)
  })
})
