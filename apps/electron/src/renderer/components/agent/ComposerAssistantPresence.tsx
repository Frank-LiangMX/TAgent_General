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
import { formatRunElapsed, useSessionRunElapsed } from '@/lib/run-timer'
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
  /** thinking 状态文案停留时长（与节奏 var(--motion-presence-rhythm) 对齐） */
  state: 1800,
  /** tool+elapsed 浮岛停留时长：acting 期间持续显示，不设上限 */
  tool: 999_999,
  /** typing 打字反馈节奏 */
  typing: 760,
  /** success 完成卡片浮岛停留时长 */
  success: 2400,
} as const

const BUBBLE_PRIORITY = {
  typing: 1,
  /** tool + elapsed 浮岛优先级与 click 同级；成功态 completion 高一档 */
  tool: 3,
  click: 3,
  state: 4,
  /** success 完成态独立最高 */
  completion: 5,
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

export function ComposerAssistantPresence({
  activeToolName,
  location = 'composer',
  onActivate,
  sessionId,
  state,
}: ComposerAssistantPresenceProps): React.ReactElement {
  const { elapsedMs, isRunning, isCompleted, shouldShow } = useSessionRunElapsed(sessionId)
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
  /** 当前 microcopy 短语（运行中追加到时间后边的"对话"）。
   * 与浮岛可见性解耦 —— running 期间浮岛永远常驻时间，bubble 只是临时后缀。 */
  const [bubble, setBubble] = React.useState<string | null>(null)
  const [announcement, setAnnouncement] = React.useState<LiveAnnouncement>({ id: 0, text: '' })
  const label = STATE_LABELS[state]

  /** 浮岛可见性：
   * - isRunning：浮岛常驻，显示时间
   * - bubble 不为空：显示 microcopy（typing / state / success 等）
   * - isCompleted 不参与浮岛可见性；完成态的耗时由信息流底部完成卡片承担
   */
  const islandVisible = isRunning || bubble !== null

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
      if (duration === BUBBLE_DURATION.tool) {
        // tool 浮岛持续显示，由优先级 / state 切换让位，无需 timer
        bubbleTimerRef.current = null
        return true
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
          ASSISTANT_TYPING_STEPS[typingStepRef.current] ?? '哒...',
          BUBBLE_DURATION.typing,
          BUBBLE_PRIORITY.typing
        )
        typingIntervalRef.current = window.setInterval(() => {
          typingStepRef.current = (typingStepRef.current + 1) % ASSISTANT_TYPING_STEPS.length
          showBubble(
            ASSISTANT_TYPING_STEPS[typingStepRef.current] ?? '哒...',
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

    // success 完成态：浮岛显示「好啦 ✦」2.4s 后淡出。
    // 时间由 isCompleted 维持显示，bubble 仅作为"对话"后缀。
    if (state === 'success') {
      clearTyping(false)
      showBubble(getAssistantStateMicrocopy('success') ?? '好啦 ✦', BUBBLE_DURATION.success, BUBBLE_PRIORITY.completion, true)
      return
    }

    if (previous === state) {
      // 同 state 内 update（如 elapsedMs 推进）→ bubble 文本无依赖 elapsed，跳过
      return
    }

    const stateCopy = getAssistantStateMicrocopy(state)

    if (stateCopy) {
      clearTyping(false)
      showBubble(stateCopy, BUBBLE_DURATION.state, BUBBLE_PRIORITY.state, true)
      return
    }

    if (shouldAcknowledgeSend(previous, state)) {
      clearTyping(false)
      acknowledgementAtRef.current = Date.now()
      showBubble('收到啦', 900, BUBBLE_PRIORITY.click, true)
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

  const handlePlayfulMessage = React.useCallback(
    (message: string, duration: number) => {
      showBubble(message, duration, BUBBLE_PRIORITY.click, true)
    },
    [showBubble]
  )

  /** 浮岛主体：仅在 running 期间显示时间（1 秒一跳）。
   *  completed 状态的时间由信息流底部的「完成 ✓ 0:42」卡片承担，浮岛不再显示。
   *  对话后缀：bubble 不为空时拼到时间后边（typing / tool / click / state / success 任意一种） */
  const showTime = isRunning
  const showBubbleText = bubble !== null

  return (
    <div
      className="composer-assistant-presence"
      data-announcing={islandVisible ? 'true' : 'false'}
      data-assistant-transition-target={location === 'composer' ? sessionId : undefined}
      data-location={location}
      data-state={state}
    >
      <AssistantPresence
        ariaLabel={`Agent 当前状态：${label}`}
        onActivate={onActivate}
        onPlayfulMessage={handlePlayfulMessage}
        showPlayfulBubble={false}
        state={state}
        title={`${label} · 点击查看反馈`}
        variant="compact"
      />
      <span aria-hidden="true" className="composer-assistant-presence__state-dot" />
      <span aria-hidden="true" className="composer-assistant-presence__status">
        <span className="composer-assistant-presence__status-inner">
          {showTime && (
            <span className="composer-assistant-presence__status-time tabular-nums">
              {formatRunElapsed(elapsedMs)}
            </span>
          )}
          {showTime && showBubbleText && (
            <span className="composer-assistant-presence__status-divider" aria-hidden>
              ·
            </span>
          )}
          {showBubbleText && (
            <span className="composer-assistant-presence__status-text">{bubble}</span>
          )}
        </span>
      </span>
      <span aria-live="polite" className="sr-only" key={announcement.id}>
        {announcement.text}
      </span>
    </div>
  )
}
