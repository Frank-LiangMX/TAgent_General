import { useAtomValue } from 'jotai'
import * as React from 'react'
import { createPortal } from 'react-dom'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'

import { AssistantPresenceRenderer, BODY_BOTTOM_RATIO } from './assistant-renderer'
import {
  ASSISTANT_TIRED_DURATION_MS,
  INITIAL_ASSISTANT_CLICK_STATE,
  recoverAssistantClickState,
  resolveAssistantClick,
} from './assistant-interaction'
import {
  computeWorldShadowParams,
  getAssistantGestureDuration,
  type AssistantGesture,
  type AssistantPresenceState,
} from './assistant-motion'

import { assistantPresenceMotionAtom, assistantPresenceStyleAtom } from '@/atoms/assistant-presence'
import { resolvedThemeAtom } from '@/atoms/theme'
import './assistant-presence.css'

/** 地面在 stage 底部的内缩量（px），与 CSS anchor 一致 */
const GROUND_INSET_PX = 8

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
  const motionMode = useAtomValue(assistantPresenceMotionAtom)
  const style = useAtomValue(assistantPresenceStyleAtom)
  const reducedMotion = motionMode === 'reduced'
  const hostRef = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLElement | null>(null)
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
  const shadowElRef = React.useRef<HTMLSpanElement | null>(null)
  const groundedRef = React.useRef(false)
  const reducedMotionRef = React.useRef(reducedMotion)
  const [ready, setReady] = React.useState(false)
  const [reacting, setReacting] = React.useState(false)
  const [exhausted, setExhausted] = React.useState(false)
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
  const [satelliteCount, setSatelliteCount] = React.useState(0)
  const [stageRect, setStageRect] = React.useState<{ width: number; height: number } | null>(null)
  // 同步 ref 供 rAF 闭包读取最新值（render 阶段同步，保证 effect 执行前已是最新）
  groundedRef.current = grounded
  reducedMotionRef.current = reducedMotion

  const measureCardContactOffset = React.useCallback((): number => {
    const host = hostRef.current
    const stage = host?.parentElement
    const surface = stage?.parentElement?.querySelector<HTMLElement>(
      '[data-assistant-contact-surface]'
    )
    if (!host || !stage || !surface) return (host?.offsetHeight ?? 144) * 0.3

    const stageRect = stage.getBoundingClientRect()
    const surfaceRect = surface.getBoundingClientRect()
    const bodyContactY = host.offsetHeight * BODY_BOTTOM_RATIO
    return surfaceRect.top - stageRect.top - host.offsetTop - bodyContactY
  }, [])

  const updateContactOffset = React.useCallback((nextOffset: number): void => {
    contactOffsetRef.current = nextOffset
    setContactOffset(nextOffset)
  }, [])

  /**
   * 从 host 实际 DOM 位置同步 shadow 样式。
   * 直接写 DOM ref style，不触发 React 重渲染。
   */
  const syncShadow = React.useCallback((): void => {
    const shadow = shadowElRef.current
    const host = hostRef.current
    const stage = stageRef.current
    if (!shadow || !host || !stage) return

    const hostRect = host.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    const hostCenterX = hostRect.left + hostRect.width / 2 - stageRect.left
    const groundY = stageRect.height - GROUND_INSET_PX
    const bodyBottomWorldY = hostRect.top - stageRect.top + hostRect.height * BODY_BOTTOM_RATIO
    const signedDistanceToGround = groundY - bodyBottomWorldY
    const cardContactHidden = groundedRef.current || cardContactRef.current
    const shadowParams = computeWorldShadowParams(
      signedDistanceToGround,
      cardContactHidden,
      reducedMotionRef.current
    )
    const shadowScaleX = 1 + shadowParams.groundContactWidthBonus / Math.max(1, shadowParams.width)

    shadow.style.left = `${hostCenterX}px`
    shadow.style.top = `${groundY}px`
    shadow.style.opacity = String(shadowParams.alpha)
    shadow.style.width = `${shadowParams.width}px`
    shadow.style.transform = `translate(-50%, -50%) scaleX(${shadowScaleX})`
  }, [])

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const renderer = new AssistantPresenceRenderer(host, theme, reducedMotion, style, state)
    let disposed = false
    rendererRef.current = renderer
    renderer.onSatelliteCountChange = setSatelliteCount

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

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      renderer.setActive(entry?.isIntersecting ?? false)
    })
    visibilityObserver.observe(host)

    return () => {
      disposed = true
      visibilityObserver.disconnect()
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  // 追踪 stage 容器 + ResizeObserver 测量，用于世界坐标阴影 portal
  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const stage = host.parentElement
    if (!stage || !stage.classList.contains('assistant-presence-stage')) return

    stageRef.current = stage

    const syncStageRect = (): void => {
      const rect = stage.getBoundingClientRect()
      setStageRect({ width: rect.width, height: rect.height })
      syncShadow()
    }
    syncStageRect()

    const observer = new ResizeObserver(syncStageRect)
    observer.observe(stage)

    return () => {
      observer.disconnect()
      stageRef.current = null
      setStageRect(null)
    }
  }, [syncShadow])

  // 世界坐标阴影：hero + shadow 存在时立即 sync；rich 模式 rAF 跟随 CSS transition
  React.useEffect(() => {
    if (variant !== 'hero') return
    const shadow = shadowElRef.current
    if (!shadow || !stageRef.current || !hostRef.current) return

    // 立即 sync 一次
    syncShadow()

    if (reducedMotion) return

    // rich 模式：rAF 循环跟随 CSS transition，持续 roamDuration + 100ms（上限 6500ms）
    let rafId = 0
    const startTime = performance.now()
    const duration = Math.min(roamDuration + 100, 6500)

    const tick = (): void => {
      syncShadow()
      if (performance.now() - startTime < duration) {
        rafId = requestAnimationFrame(tick)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [
    roamPose,
    contactOffset,
    roamDuration,
    grounded,
    stageRect,
    reducedMotion,
    variant,
    syncShadow,
  ])

  React.useEffect(() => {
    rendererRef.current?.setTheme(theme)
  }, [theme])

  React.useEffect(() => {
    rendererRef.current?.setStyle(style)
  }, [style])

  React.useEffect(() => {
    rendererRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

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
            setRoamCue((cue) => {
              if (cue) {
                // 粒子被捕获 → 转为卫星；count 由 renderer 回调驱动
                const colorIndex = Math.floor(Math.random() * 4)
                rendererRef.current?.addSatellite(colorIndex)
                return { ...cue, phase: 'caught' }
              }
              return null
            })
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

  // 卫星数量变化 → 显示消息（由 renderer 回调驱动，保证吸收归零后可再次循环）
  const prevSatelliteCountRef = React.useRef(0)
  React.useEffect(() => {
    const prev = prevSatelliteCountRef.current
    prevSatelliteCountRef.current = satelliteCount
    if (satelliteCount <= prev) return
    if (satelliteCount >= 5) {
      rendererRef.current?.setGreenMode(true)
      showMessage('✨ 集齐了！', 2200)
    } else if (satelliteCount >= 3) {
      showMessage(`已有 ${satelliteCount} 颗卫星`, 1400)
    }
  }, [satelliteCount, showMessage])

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
      data-green-mode={satelliteCount >= 5 ? 'true' : undefined}
      data-motion={motionMode}
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
      {/* 世界坐标地面阴影：portal 到 stage，由 syncShadow 驱动 */}
      {variant === 'hero' && stageRef.current && stageRect
        ? createPortal(
            <span
              ref={shadowElRef}
              aria-hidden="true"
              className="assistant-world-shadow"
              data-world-shadow="ground"
              style={{
                opacity: 0,
                left: '50%',
                top: `${stageRect.height - GROUND_INSET_PX}px`,
              }}
            />,
            stageRef.current!
          )
        : null}
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
