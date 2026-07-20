import * as React from 'react'

import {
  ASSISTANT_TYPING_EVENT,
  ASSISTANT_TYPING_STEPS,
  getAssistantAmbientMicrocopy,
  getAssistantStateMicrocopy,
  getAssistantToolMicrocopy,
  shouldAcknowledgeSend,
  type AssistantTypingEventDetail,
} from './assistant-microcopy'
import { AssistantPresence } from '@/components/welcome/assistant-presence/AssistantPresence'
import type { AssistantPresenceState } from '@/components/welcome/assistant-presence/assistant-motion'

import './composer-assistant-presence.css'

const STATE_LABELS: Record<AssistantPresenceState, string> = {
  standby: '随时可以开始',
  input: '我在听',
  thinking: '正在思考',
  acting: '正在执行',
  'needs-input': '需要你确认',
  success: '任务已完成',
  error: '遇到问题了',
}

const BUBBLE_DURATION = {
  click: 1600,
  state: 1800,
  tool: 1800,
  typing: 760,
} as const

const BUBBLE_PRIORITY = {
  typing: 1,
  tool: 2,
  click: 3,
  state: 4,
} as const

interface ComposerAssistantPresenceProps {
  activeToolName?: string
  location?: 'composer' | 'attention'
  onActivate: () => void
  sessionId: string
  state: AssistantPresenceState
}

interface LiveAnnouncement {
  id: number
  text: string
}

/** 会话输入区的角色锚点：状态可读、点击有回应，并用克制的短句反馈当前动作。 */
export function ComposerAssistantPresence({
  activeToolName,
  location = 'composer',
  onActivate,
  sessionId,
  state,
}: ComposerAssistantPresenceProps): React.ReactElement {
  const bubbleTimerRef = React.useRef<number | null>(null)
  const bubbleTokenRef = React.useRef(0)
  const bubblePriorityRef = React.useRef(0)
  const typingIntervalRef = React.useRef<number | null>(null)
  const typingStopTimerRef = React.useRef<number | null>(null)
  const typingStepRef = React.useRef(0)
  const typingActiveRef = React.useRef(false)
  const toolTimerRef = React.useRef<number | null>(null)
  const stateTimerRef = React.useRef<number | null>(null)
  const lastToolBubbleAtRef = React.useRef(0)
  const acknowledgementAtRef = React.useRef(0)
  const previousStateRef = React.useRef(state)
  const [bubble, setBubble] = React.useState<string | null>(null)
  const [announcement, setAnnouncement] = React.useState<LiveAnnouncement>({ id: 0, text: '' })
  const label = STATE_LABELS[state]

  const clearBubbleTimer = React.useCallback(() => {
    if (bubbleTimerRef.current === null) return
    window.clearTimeout(bubbleTimerRef.current)
    bubbleTimerRef.current = null
  }, [])

  const clearStateTimer = React.useCallback(() => {
    if (stateTimerRef.current === null) return
    window.clearTimeout(stateTimerRef.current)
    stateTimerRef.current = null
  }, [])

  const showBubble = React.useCallback(
    (text: string, duration: number, priority: number, announce = false): boolean => {
      if (priority < bubblePriorityRef.current) return false

      clearBubbleTimer()
      const token = ++bubbleTokenRef.current
      bubblePriorityRef.current = priority
      setBubble(text)
      if (announce) {
        setAnnouncement((current) => ({ id: current.id + 1, text }))
      }
      bubbleTimerRef.current = window.setTimeout(() => {
        if (bubbleTokenRef.current !== token) return
        bubblePriorityRef.current = 0
        bubbleTimerRef.current = null
        setBubble(null)
      }, duration)
      return true
    },
    [clearBubbleTimer]
  )

  const clearTyping = React.useCallback(
    (hideBubble: boolean) => {
      if (typingIntervalRef.current !== null) {
        window.clearInterval(typingIntervalRef.current)
        typingIntervalRef.current = null
      }
      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current)
        typingStopTimerRef.current = null
      }
      typingActiveRef.current = false
      typingStepRef.current = 0

      if (hideBubble && bubblePriorityRef.current <= BUBBLE_PRIORITY.typing) {
        clearBubbleTimer()
        bubblePriorityRef.current = 0
        bubbleTokenRef.current += 1
        setBubble(null)
      }
    },
    [clearBubbleTimer]
  )

  React.useEffect(() => {
    const handleTyping = (event: Event): void => {
      const detail = (event as CustomEvent<AssistantTypingEventDetail>).detail
      if (!detail || detail.sessionId !== sessionId) return

      if (!typingActiveRef.current) {
        typingActiveRef.current = true
        typingStepRef.current = 0
        showBubble(
          ASSISTANT_TYPING_STEPS[typingStepRef.current] ?? '哒·',
          BUBBLE_DURATION.typing,
          BUBBLE_PRIORITY.typing
        )
        typingIntervalRef.current = window.setInterval(() => {
          typingStepRef.current = (typingStepRef.current + 1) % ASSISTANT_TYPING_STEPS.length
          showBubble(
            ASSISTANT_TYPING_STEPS[typingStepRef.current] ?? '哒·',
            BUBBLE_DURATION.typing,
            BUBBLE_PRIORITY.typing
          )
        }, 280)
      }

      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current)
      }
      typingStopTimerRef.current = window.setTimeout(() => clearTyping(true), 560)
    }

    window.addEventListener(ASSISTANT_TYPING_EVENT, handleTyping)
    return () => window.removeEventListener(ASSISTANT_TYPING_EVENT, handleTyping)
  }, [clearTyping, sessionId, showBubble])

  React.useEffect(() => {
    const previous = previousStateRef.current
    previousStateRef.current = state
    clearStateTimer()
    if (previous === state) return

    const stateCopy = getAssistantStateMicrocopy(state)

    if (stateCopy) {
      clearTyping(false)
      showBubble(stateCopy, BUBBLE_DURATION.state, BUBBLE_PRIORITY.state, true)
      return
    }

    if (shouldAcknowledgeSend(previous, state)) {
      clearTyping(false)
      acknowledgementAtRef.current = Date.now()
      showBubble('收到！', 900, BUBBLE_PRIORITY.click, true)
      const followup =
        state === 'thinking'
          ? getAssistantAmbientMicrocopy('thinking')
          : state === 'acting' && !activeToolName
            ? getAssistantAmbientMicrocopy('acting')
            : null
      if (followup) {
        stateTimerRef.current = window.setTimeout(() => {
          stateTimerRef.current = null
          showBubble(followup, 1500, BUBBLE_PRIORITY.tool)
        }, 960)
      }
      return
    }

    const ambientCopy = getAssistantAmbientMicrocopy(state)
    if (!ambientCopy) return
    if (state === 'acting' && activeToolName) return
    const priority =
      state === 'thinking' || state === 'acting' ? BUBBLE_PRIORITY.tool : BUBBLE_PRIORITY.typing
    showBubble(ambientCopy, 1500, priority)
  }, [activeToolName, clearStateTimer, clearTyping, showBubble, state])

  React.useEffect(() => {
    if (toolTimerRef.current !== null) {
      window.clearTimeout(toolTimerRef.current)
      toolTimerRef.current = null
    }
    if (state !== 'acting' || !activeToolName) return

    const elapsedSinceAcknowledgement = Date.now() - acknowledgementAtRef.current
    const delay = elapsedSinceAcknowledgement < 1000 ? 960 - elapsedSinceAcknowledgement : 0
    toolTimerRef.current = window.setTimeout(
      () => {
        toolTimerRef.current = null
        const now = Date.now()
        if (now - lastToolBubbleAtRef.current < 3200) return
        const didShow = showBubble(
          getAssistantToolMicrocopy(activeToolName),
          BUBBLE_DURATION.tool,
          BUBBLE_PRIORITY.tool
        )
        if (didShow) lastToolBubbleAtRef.current = now
      },
      Math.max(0, delay)
    )

    return () => {
      if (toolTimerRef.current !== null) {
        window.clearTimeout(toolTimerRef.current)
        toolTimerRef.current = null
      }
    }
  }, [activeToolName, showBubble, state])

  React.useEffect(
    () => () => {
      clearBubbleTimer()
      clearStateTimer()
      clearTyping(false)
      if (toolTimerRef.current !== null) window.clearTimeout(toolTimerRef.current)
    },
    [clearBubbleTimer, clearStateTimer, clearTyping]
  )

  const handleActivate = React.useCallback(() => {
    showBubble(label, BUBBLE_DURATION.click, BUBBLE_PRIORITY.click, true)
    onActivate()
  }, [label, onActivate, showBubble])

  return (
    <div
      className="composer-assistant-presence"
      data-announcing={bubble ? 'true' : 'false'}
      data-location={location}
      data-state={state}
    >
      <AssistantPresence
        ariaLabel={`Agent 当前状态：${label}`}
        onActivate={handleActivate}
        state={state}
        title={`${label} · 点击查看反馈`}
        variant="compact"
      />
      <span aria-hidden="true" className="composer-assistant-presence__state-dot" />
      <span aria-hidden="true" className="composer-assistant-presence__status">
        {bubble}
      </span>
      <span aria-live="polite" className="sr-only" key={announcement.id}>
        {announcement.text}
      </span>
    </div>
  )
}
