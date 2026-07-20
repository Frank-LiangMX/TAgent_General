import type { AssistantPresenceState } from '@/components/welcome/assistant-presence/assistant-motion'

export const ASSISTANT_TYPING_EVENT = 'tagent:assistant-typing'

export const ASSISTANT_TYPING_STEPS = ['哒·', '哒哒·', '哒哒哒…'] as const

export interface AssistantTypingEventDetail {
  hasText: boolean
  sessionId: string
}

/**
 * 输入事件直接发给小助手，避免为了一个“哒哒”让三千多行的 AgentView 每次按键重渲染。
 */
export function dispatchAssistantTyping(sessionId: string, value: string): void {
  window.dispatchEvent(
    new CustomEvent<AssistantTypingEventDetail>(ASSISTANT_TYPING_EVENT, {
      detail: { hasText: value.trim().length > 0, sessionId },
    })
  )
}

/** 把内部工具名转成短而自然的角色语言，不向用户暴露实现细节。 */
export function getAssistantToolMicrocopy(toolName: string | undefined): string {
  const normalized = toolName?.trim().toLowerCase() ?? ''

  if (/(read|glob|grep|search|find|list|browse|fetch|open|lookup|query)/.test(normalized)) {
    return '我去找找'
  }
  if (/(edit|write|create|patch|replace|insert|update|delete|remove|move|copy)/.test(normalized)) {
    return '正在改'
  }
  if (
    /(bash|shell|exec|terminal|command|test|build|lint|typecheck|pytest|vitest|run)/.test(
      normalized
    )
  ) {
    return '跑一下看看'
  }
  if (/(task|agent|subagent|delegate|skill|mcp)/.test(normalized)) {
    return '叫个帮手一起'
  }
  return '正在处理'
}

export function getAssistantStateMicrocopy(state: AssistantPresenceState): string | null {
  switch (state) {
    case 'needs-input':
      return '这里需要你点一下'
    case 'success':
      return '好啦 ✦'
    case 'error':
      return '这里卡住了'
    default:
      return null
  }
}

/** 非阻断状态只做低频陪伴式反馈，随打字或更重要的业务状态立即让位。 */
export function getAssistantAmbientMicrocopy(state: AssistantPresenceState): string | null {
  switch (state) {
    case 'standby':
      return '我在这儿'
    case 'input':
      return '你说，我听着'
    case 'thinking':
      return '让我捋一捋…'
    case 'acting':
      return '我动手啦'
    default:
      return null
  }
}

export function shouldAcknowledgeSend(
  previous: AssistantPresenceState,
  next: AssistantPresenceState
): boolean {
  const wasComposing = previous === 'standby' || previous === 'input'
  const startedRunning = next === 'thinking' || next === 'acting'
  return wasComposing && startedRunning
}
