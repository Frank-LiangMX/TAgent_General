import { useAtomValue } from 'jotai'
import * as React from 'react'
import { createPortal } from 'react-dom'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'

import { AssistantPresenceRenderer } from './assistant-renderer'
import {
  ASSISTANT_TIRED_DURATION_MS,
  INITIAL_ASSISTANT_CLICK_STATE,
  recoverAssistantClickState,
  resolveAssistantClick,
} from './assistant-interaction'
import {
  getAssistantGestureDuration,
  type AssistantGesture,
  type AssistantPresenceState,
} from './assistant-motion'

import { assistantPresenceStyleAtom } from '@/atoms/assistant-presence'
import { resolvedThemeAtom } from '@/atoms/theme'
import './assistant-presence.css'

interface AssistantPresenceProps {
  ariaLabel?: string
  className?: string
  onActivate?: () => void
  onPlayfulMessage?: (message: string, duration: number) => void
  roaming?: boolean
  showPlayfulBubble?: boolean
  state?: AssistantPresenceState
  title?: string
  transitionSource?: boolean
  variant?: 'hero' | 'compact'
}

interface AssistantRoamCue {
  phase: 'waiting' | 'caught'
  x: number
  y: number
}

export function AssistantPresence({
  ariaLabel = '和 Agent 打个招呼',
  className,
  onActivate,
  onPlayfulMessage,
  roaming = false,
  showPlayfulBubble = true,
  state = 'input',
  transitionSource = false,
  title = '点击和 Agent 打个招呼',
  variant = 'hero',
}: AssistantPresenceProps = {}): React.ReactElement {
  const theme = useAtomValue(resolvedThemeAtom)
  const style = useAtomValue(assistantPresenceStyleAtom)
  const hostRef = React.useRef<HTMLDivElement>(null)
  const rendererRef = React.useRef<AssistantPresenceRenderer | null>(null)
  const gestureTimerRef = React.useRef<number | null>(null)
  const messageTimerRef = React.useRef<number | null>(null)
  const recoveryTimerRef = React.useRef<number | null>(null)
  const roamTimerRef = React.useRef<number | null>(null)
  const clickStateRef = React.useRef(INITIAL_ASSISTANT_CLICK_STATE)
  const cardContactRef = React.useRef(false)
  const contactOffsetRef = React.useRef(0)
  const chasingRef = React.useRef(false)
  const roamPoseRef = React.useRef({ rotation: 0, x: 0, y: 0 })
  const roamWorldRef = React.useRef({ x: 0, y: 0 })
  const roamXRef = React.useRef(0)
  const [ready, setReady] = React.useState(false)
  const [reacting, setReacting] = React.useState(false)
  const [exhausted, setExhausted] = React.useState(false)
  const [reducedMotion, setReducedMotion] = React.useState(false)
  const [gesture, setGesture] = React.useState<AssistantGesture | null>(null)
  const [playfulMessage, setPlayfulMessage] = React.useState<string | null>(null)
  const [roamCue, setRoamCue] = React.useState<AssistantRoamCue | null>(null)
  const [roamDuration, setRoamDuration] = React.useState(5200)
  const [roamMode, setRoamMode] = React.useState<
    'bubble' | 'notice' | 'chase' | 'land' | 'roll' | 'dizzy'
  >('bubble')
  const [roamStage, setRoamStage] = React.useState<HTMLElement | null>(null)
  const [roamPose, setRoamPose] = React.useState({ rotation: 0, x: 0, y: 0 })
  const [grounded, setGrounded] = React.useState(false)
  const [contactOffset, setContactOffset] = React.useState(0)

  const measureCardContactOffset = React.useCallback((): number => {
    const host = hostRef.current
    const stage = host?.parentElement
    const surface = stage?.parentElement?.querySelector<HTMLElement>(
      '[data-assistant-contact-surface]'
    )
    if (!host || !stage || !surface) return (host?.offsetHeight ?? 144) * 0.3

    const stageRect = stage.getBoundingClientRect()
    const surfaceRect = surface.getBoundingClientRect()
    const bodyContactY = host.offsetHeight * 0.78
    return surfaceRect.top - stageRect.top - host.offsetTop - bodyContactY
  }, [])

  const updateContactOffset = React.useCallback((nextOffset: number): void => {
    contactOffsetRef.current = nextOffset
    setContactOffset(nextOffset)
  }, [])

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(motionQuery.matches)
    const renderer = new AssistantPresenceRenderer(host, theme, motionQuery.matches, style, state)
    let disposed = false
    rendererRef.current = renderer

    void renderer
      .init()
      .then((canvas) => {
        if (disposed) {
          renderer.destroy()
          return
        }
        canvas.setAttribute('aria-hidden', 'true')
        host.appendChild(canvas)
        setReady(true)
      })
      .catch((error: unknown) => {
        console.warn('[assistant-presence] Falling back to static rendering.', error)
        if (rendererRef.current === renderer) rendererRef.current = null
      })

    const onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
      renderer.setReducedMotion(event.matches)
      setReducedMotion(event.matches)
    }
    motionQuery.addEventListener('change', onMotionPreferenceChange)

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      renderer.setActive(entry?.isIntersecting ?? false)
    })
    visibilityObserver.observe(host)

    return () => {
      disposed = true
      visibilityObserver.disconnect()
      motionQuery.removeEventListener('change', onMotionPreferenceChange)
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  React.useEffect(() => {
    rendererRef.current?.setTheme(theme)
  }, [theme])

  React.useEffect(() => {
    rendererRef.current?.setStyle(style)
  }, [style])

  React.useEffect(() => {
    rendererRef.current?.setPresenceState(state)
  }, [state])

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      if (chasingRef.current) return
      rendererRef.current?.setPointer(event.clientX, event.clientY)
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  React.useEffect(
    () => () => {
      if (gestureTimerRef.current !== null) window.clearTimeout(gestureTimerRef.current)
      if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current)
      if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current)
      if (roamTimerRef.current !== null) window.clearTimeout(roamTimerRef.current)
    },
    []
  )

  React.useEffect(() => {
    if (!roaming || variant !== 'hero' || reducedMotion || exhausted) return
    let disposed = false
    let bubbleDrifts = 0
    const host = hostRef.current
    const stage = host?.parentElement
    if (!host || !stage) return
    setRoamStage(stage)

    const later = (callback: () => void, delay: number): void => {
      roamTimerRef.current = window.setTimeout(callback, delay)
    }

    const applyPose = (
      nextPose: { rotation: number; x: number; y: number },
      duration: number,
      cardContact = false
    ): void => {
      const nextContactOffset = cardContact ? measureCardContactOffset() : 0
      const nextWorld = {
        x: nextPose.x,
        y: nextPose.y + nextContactOffset,
      }
      rendererRef.current?.setTravelMotion(
        nextWorld.x - roamWorldRef.current.x,
        nextWorld.y - roamWorldRef.current.y,
        duration
      )
      rendererRef.current?.setSurfaceContact(cardContact)
      roamWorldRef.current = nextWorld
      cardContactRef.current = cardContact
      updateContactOffset(nextContactOffset)
      roamPoseRef.current = nextPose
      roamXRef.current = nextPose.x
      setRoamPose(nextPose)
    }

    const getBounds = (): { maxX: number; maxY: number } => ({
      maxX: Math.max(0, (stage.clientWidth - host.offsetWidth) / 2 - 12),
      maxY: Math.max(5, Math.min(13, (stage.clientHeight - host.offsetHeight) / 2 - 2)),
    })

    const showRoamMessage = (message: string, duration: number): void => {
      onPlayfulMessage?.(message, duration)
      if (!showPlayfulBubble) return
      if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current)
      setPlayfulMessage(message)
      messageTimerRef.current = window.setTimeout(() => {
        setPlayfulMessage(null)
        messageTimerRef.current = null
      }, duration)
    }

    const scheduleBubbleDrift = (initial = false): void => {
      later(
        () => {
          if (disposed) return
          const { maxX, maxY } = getBounds()
          const current = roamPoseRef.current
          const direction = Math.random() > 0.5 ? 1 : -1
          const distance = 28 + Math.random() * Math.min(76, Math.max(30, maxX * 0.42))
          let nextX = Math.max(-maxX, Math.min(maxX, current.x + direction * distance))
          if (Math.abs(nextX - current.x) < 20) {
            nextX = Math.max(-maxX, Math.min(maxX, current.x - direction * distance))
          }
          const duration = 4800 + Math.random() * 2200
          setRoamMode('bubble')
          setRoamDuration(duration)
          applyPose(
            {
              rotation: (Math.random() * 2 - 1) * 1.25,
              x: nextX,
              y: (Math.random() * 2 - 1) * maxY,
            },
            duration
          )
          bubbleDrifts += 1

          if (bubbleDrifts >= 2 + Math.floor(Math.random() * 2) && maxX > 32) {
            later(Math.random() < 0.32 ? startCardRoll : startParticleChase, duration + 650)
          } else {
            later(() => scheduleBubbleDrift(), duration + 350)
          }
        },
        initial ? 1800 + Math.random() * 1000 : 0
      )
    }

    const startParticleChase = (): void => {
      if (disposed) return
      const { maxX, maxY } = getBounds()
      const current = roamPoseRef.current
      const direction =
        current.x > maxX * 0.25 ? -1 : current.x < -maxX * 0.25 ? 1 : Math.random() > 0.5 ? 1 : -1
      const targetX = Math.max(
        -maxX,
        Math.min(maxX, current.x + direction * (72 + Math.random() * 92))
      )
      const targetY = (Math.random() * 2 - 1) * maxY
      const stageRect = stage.getBoundingClientRect()

      chasingRef.current = true
      setRoamMode('notice')
      setRoamDuration(520)
      setRoamCue({ phase: 'waiting', x: targetX, y: targetY })
      rendererRef.current?.setPointer(
        stageRect.left + stageRect.width / 2 + targetX,
        stageRect.top + stageRect.height / 2 + targetY
      )
      rendererRef.current?.triggerGesture('peek')

      later(() => {
        if (disposed) return
        const arcY = Math.max(-maxY, Math.min(maxY, (current.y + targetY) / 2 - 9))
        setRoamMode('chase')
        setRoamDuration(940)
        applyPose(
          {
            rotation: direction * 2.4,
            x: current.x + (targetX - current.x) * 0.58,
            y: arcY,
          },
          940
        )

        later(() => {
          if (disposed) return
          setRoamDuration(860)
          applyPose({ rotation: direction * -0.7, x: targetX, y: targetY }, 860)

          later(() => {
            if (disposed) return
            setRoamCue((cue) => (cue ? { ...cue, phase: 'caught' } : null))
            chasingRef.current = false
            bubbleDrifts = 0
            later(() => {
              setRoamCue(null)
              scheduleBubbleDrift()
            }, 420)
          }, 900)
        }, 880)
      }, 680)
    }

    const startCardRoll = (): void => {
      if (disposed) return
      const { maxX, maxY } = getBounds()
      const current = roamPoseRef.current
      const targetX = current.x >= 0 ? -maxX * 0.78 : maxX * 0.78
      const direction = targetX > current.x ? 1 : -1
      const stageRect = stage.getBoundingClientRect()

      chasingRef.current = true
      setRoamCue(null)
      setGrounded(true)
      setRoamMode('land')
      setRoamDuration(760)
      applyPose({ rotation: 0, x: current.x, y: 0 }, 760, true)
      rendererRef.current?.setPointer(
        stageRect.left + stageRect.width / 2 + current.x,
        stageRect.bottom
      )
      rendererRef.current?.triggerGesture('nod')

      later(() => {
        if (disposed) return
        setRoamMode('roll')
        setRoamDuration(2400)
        rendererRef.current?.startRoll(direction, 2400)
        applyPose({ rotation: 0, x: targetX, y: 0 }, 2400, true)

        later(() => {
          if (disposed) return
          rendererRef.current?.clearRoll()
          setRoamDuration(0)
          applyPose({ rotation: 0, x: targetX, y: 0 }, 0, true)
          setRoamMode('dizzy')
          rendererRef.current?.triggerGesture('dizzy')
          showRoamMessage('等等，地面在转…', 1550)

          later(() => {
            if (disposed) return
            setGrounded(false)
            chasingRef.current = false
            setRoamMode('bubble')
            setRoamDuration(1250)
            applyPose(
              {
                rotation: 0,
                x: targetX,
                y: (Math.random() * 2 - 1) * maxY,
              },
              1250
            )
            bubbleDrifts = 0
            later(() => scheduleBubbleDrift(), 1380)
          }, 1450)
        }, 2440)
      }, 820)
    }

    scheduleBubbleDrift(true)
    return () => {
      disposed = true
      chasingRef.current = false
      rendererRef.current?.clearRoll()
      setGrounded(false)
      setRoamCue(null)
      if (roamTimerRef.current !== null) {
        window.clearTimeout(roamTimerRef.current)
        roamTimerRef.current = null
      }
    }
  }, [
    exhausted,
    measureCardContactOffset,
    onPlayfulMessage,
    reducedMotion,
    roaming,
    showPlayfulBubble,
    updateContactOffset,
    variant,
  ])

  const showMessage = React.useCallback(
    (message: string, duration: number) => {
      onPlayfulMessage?.(message, duration)
      if (!showPlayfulBubble) return
      if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current)
      setPlayfulMessage(message)
      messageTimerRef.current = window.setTimeout(() => {
        setPlayfulMessage(null)
        messageTimerRef.current = null
      }, duration)
    },
    [onPlayfulMessage, showPlayfulBubble]
  )

  const playGesture = React.useCallback((nextGesture: AssistantGesture) => {
    rendererRef.current?.triggerGesture(nextGesture)
    setGesture(nextGesture)
    setReacting(true)
    if (gestureTimerRef.current !== null) window.clearTimeout(gestureTimerRef.current)
    gestureTimerRef.current = window.setTimeout(() => {
      setGesture(null)
      setReacting(false)
      gestureTimerRef.current = null
    }, getAssistantGestureDuration(nextGesture))
  }, [])

  const activate = React.useCallback(() => {
    const interaction = resolveAssistantClick(clickStateRef.current, performance.now())
    clickStateRef.current = interaction.state
    if (interaction.gesture) playGesture(interaction.gesture)
    showMessage(interaction.message, interaction.gesture === 'tired' ? 2200 : 1500)

    if (interaction.becameTired) {
      const canTravelToCard = roaming && variant === 'hero' && !reducedMotion
      const host = hostRef.current
      if (canTravelToCard && host && !cardContactRef.current) {
        const dropDistance = measureCardContactOffset()
        rendererRef.current?.setTravelMotion(0, dropDistance, 780)
        rendererRef.current?.setSurfaceContact(true)
        roamWorldRef.current.y += dropDistance
        cardContactRef.current = true
        updateContactOffset(dropDistance)
      }
      setExhausted(true)
      if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current)
      recoveryTimerRef.current = window.setTimeout(() => {
        clickStateRef.current = recoverAssistantClickState()
        if (canTravelToCard && host && cardContactRef.current) {
          const riseDistance = contactOffsetRef.current
          rendererRef.current?.setTravelMotion(0, -riseDistance, 780)
          rendererRef.current?.setSurfaceContact(false)
          roamWorldRef.current.y -= riseDistance
          cardContactRef.current = false
          updateContactOffset(0)
        }
        setExhausted(false)
        playGesture('recover')
        showMessage('呼……缓过来了', 1600)
        recoveryTimerRef.current = null
      }, ASSISTANT_TIRED_DURATION_MS)
    }
    onActivate?.()
  }, [
    measureCardContactOffset,
    onActivate,
    playGesture,
    reducedMotion,
    roaming,
    showMessage,
    updateContactOffset,
    variant,
  ])

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button === 0) activate()
    },
    [activate]
  )

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) activate()
    },
    [activate]
  )

  return (
    <div
      ref={hostRef}
      className={['assistant-presence', className].filter(Boolean).join(' ')}
      data-reacting={reacting ? 'true' : 'false'}
      data-ready={ready ? 'true' : 'false'}
      data-exhausted={exhausted ? 'true' : 'false'}
      data-gesture={gesture ?? undefined}
      data-roam-mode={roaming && variant === 'hero' ? roamMode : undefined}
      data-roaming={roaming && variant === 'hero' ? 'true' : undefined}
      data-style={style}
      data-theme={theme}
      data-state={state}
      data-assistant-transition-source={transitionSource ? 'true' : undefined}
      data-variant={variant}
      style={
        roaming && variant === 'hero'
          ? ({
              '--assistant-roam-duration': `${exhausted || gesture === 'recover' ? 780 : roamDuration}ms`,
              transform: reducedMotion
                ? undefined
                : exhausted || grounded
                  ? `translate3d(${roamPose.x}px, ${roamPose.y + contactOffset}px, 0) rotate(${exhausted ? roamPose.rotation * 0.2 : roamPose.rotation}deg)`
                  : `translate3d(${roamPose.x}px, ${roamPose.y}px, 0) rotate(${roamPose.rotation}deg)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div aria-hidden="true" className="assistant-presence__fallback">
        <span className="assistant-presence__fallback-eye" />
        <span className="assistant-presence__fallback-eye" />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className="assistant-presence__hit-target"
            onClick={handleClick}
            onPointerDown={handlePointerDown}
          />
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {title}
        </TooltipContent>
      </Tooltip>
      {showPlayfulBubble && (
        <span
          aria-live="polite"
          className="assistant-presence__speech"
          data-visible={playfulMessage ? 'true' : 'false'}
          role="status"
        >
          {playfulMessage}
        </span>
      )}
      {roamCue && roamStage
        ? createPortal(
            <span
              aria-hidden="true"
              className="assistant-presence-roam-cue"
              data-phase={roamCue.phase}
              style={
                {
                  '--assistant-cue-x': `${roamCue.x}px`,
                  '--assistant-cue-y': `${roamCue.y}px`,
                } as React.CSSProperties
              }
            >
              <span className="assistant-presence-roam-cue__spark" />
            </span>,
            roamStage
          )
        : null}
    </div>
  )
}
