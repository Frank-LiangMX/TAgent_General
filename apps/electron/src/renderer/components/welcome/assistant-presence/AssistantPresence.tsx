import { useAtomValue } from 'jotai'
import * as React from 'react'

import { AssistantPresenceRenderer } from './assistant-renderer'
import type { AssistantPresenceState } from './assistant-motion'

import { assistantPresenceStyleAtom } from '@/atoms/assistant-presence'
import { resolvedThemeAtom } from '@/atoms/theme'
import './assistant-presence.css'

interface AssistantPresenceProps {
  ariaLabel?: string
  className?: string
  onActivate?: () => void
  state?: AssistantPresenceState
  title?: string
  variant?: 'hero' | 'compact'
}

export function AssistantPresence({
  ariaLabel = '和 Agent 打个招呼',
  className,
  onActivate,
  state = 'input',
  title = '点击和 Agent 打个招呼',
  variant = 'hero',
}: AssistantPresenceProps = {}): React.ReactElement {
  const theme = useAtomValue(resolvedThemeAtom)
  const style = useAtomValue(assistantPresenceStyleAtom)
  const hostRef = React.useRef<HTMLDivElement>(null)
  const rendererRef = React.useRef<AssistantPresenceRenderer | null>(null)
  const reactionTimerRef = React.useRef<number | null>(null)
  const [ready, setReady] = React.useState(false)
  const [reacting, setReacting] = React.useState(false)

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
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
      rendererRef.current?.setPointer(event.clientX, event.clientY)
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  React.useEffect(
    () => () => {
      if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current)
    },
    []
  )

  const activate = React.useCallback(() => {
    rendererRef.current?.triggerReaction()
    setReacting(true)
    if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current)
    reactionTimerRef.current = window.setTimeout(() => {
      setReacting(false)
      reactionTimerRef.current = null
    }, 520)
    onActivate?.()
  }, [onActivate])

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
      data-style={style}
      data-theme={theme}
      data-state={state}
      data-variant={variant}
    >
      <div aria-hidden="true" className="assistant-presence__fallback">
        <span className="assistant-presence__fallback-eye" />
        <span className="assistant-presence__fallback-eye" />
      </div>
      <button
        type="button"
        aria-label={ariaLabel}
        className="assistant-presence__hit-target"
        title={title}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
      />
    </div>
  )
}
