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

const RUN_BADGE_TARGET_WAIT_MS = 1600
const RUN_BADGE_TRAVEL_MS = 360

async function waitForRunBadgeTarget(sessionId: string): Promise<HTMLElement | null> {
  const startedAt = performance.now()

  while (performance.now() - startedAt < RUN_BADGE_TARGET_WAIT_MS) {
    const target = document.querySelector<HTMLElement>(
      `[data-run-badge-complete-target="${sessionId}"]`
    )
    if (target) {
      const rect = target.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) return target
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  return null
}

async function animateRunBadgeToFooter(source: HTMLElement, sessionId: string): Promise<void> {
  const sourceRect = source.getBoundingClientRect()
  if (sourceRect.width <= 0 || sourceRect.height <= 0) return

  const target = await waitForRunBadgeTarget(sessionId)
  if (!target) return

  const targetRect = target.getBoundingClientRect()
  const clone = source.cloneNode(true) as HTMLElement
  clone.setAttribute('aria-hidden', 'true')
  clone.style.position = 'fixed'
  clone.style.left = `${sourceRect.left}px`
  clone.style.top = `${sourceRect.top}px`
  clone.style.width = `${sourceRect.width}px`
  clone.style.height = `${sourceRect.height}px`
  clone.style.margin = '0'
  clone.style.zIndex = '1250'
  clone.style.pointerEvents = 'none'
  clone.style.transformOrigin = 'center center'
  clone.style.willChange = 'transform, opacity'
  document.body.appendChild(clone)

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2)
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2)
  const scale =
    sourceRect.width > 0 ? Math.min(1.04, Math.max(0.78, targetRect.width / sourceRect.width)) : 1

  const previousTargetOpacity = target.style.opacity
  target.style.opacity = '0'
  target.style.willChange = 'opacity'

  const travel = clone.animate(
    [
      { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
      {
        offset: 0.18,
        opacity: 1,
        transform: `translate3d(${deltaX * 0.1}px, ${deltaY * 0.04 - 5}px, 0) scale(1.02)`,
      },
      {
        offset: 0.74,
        opacity: 1,
        transform: `translate3d(${deltaX * 0.84}px, ${deltaY * 0.82 - 2}px, 0) scale(${1 + (scale - 1) * 0.72})`,
      },
      {
        opacity: 0.2,
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale})`,
      },
    ],
    {
      duration: RUN_BADGE_TRAVEL_MS,
      easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
      fill: 'forwards',
    }
  )

  const targetFade = target.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 180,
    delay: 170,
    easing: 'ease-out',
    fill: 'forwards',
  })

  try {
    await Promise.all([travel.finished, targetFade.finished])
  } catch {
    // Ignore cancelled transitions during rapid UI updates.
  } finally {
    clone.remove()
    target.style.opacity = previousTargetOpacity
    target.style.removeProperty('will-change')
  }
}

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

  return (
    <div
      className="composer-assistant-presence"
      data-announcing={bubble ? 'true' : 'false'}
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
        {bubble}
      </span>
      <span aria-live="polite" className="sr-only" key={announcement.id}>
        {announcement.text}
      </span>
    </div>
  )
}

export function ComposerRunBadge({ sessionId }: { sessionId: string }): React.ReactElement {
  const { elapsedMs, isRunning } = useSessionRunElapsed(sessionId)
  const badgeRef = React.useRef<HTMLSpanElement>(null)
  const previousRunningRef = React.useRef(isRunning)

  React.useEffect(() => {
    const wasRunning = previousRunningRef.current
    previousRunningRef.current = isRunning
    if (!wasRunning || isRunning) return
    const badge = badgeRef.current
    if (!badge) return
    void animateRunBadgeToFooter(badge, sessionId)
  }, [isRunning, sessionId])

  return (
    <span
      ref={badgeRef}
      className="composer-run-badge"
      aria-hidden="true"
      data-status={isRunning ? 'running' : 'idle'}
      data-visible={isRunning ? 'true' : 'false'}
    >
      <span className="composer-run-badge__dot" aria-hidden />
      <span className="composer-run-badge__pulse" aria-hidden />
      <span className="composer-run-badge__label-default">{'运行中 ·\u00A0'}</span>
      <span className="composer-run-badge__label-narrow">{'运行 ·\u00A0'}</span>
      <span className="composer-run-badge__time tabular-nums">{formatRunElapsed(elapsedMs)}</span>
    </span>
  )
}
