import { useAtomValue } from 'jotai'
import * as React from 'react'

import { AssistantPresenceRenderer } from './assistant-renderer'

import { resolvedThemeAtom } from '@/atoms/theme'
import './assistant-presence.css'

export function AssistantPresence(): React.ReactElement {
  const theme = useAtomValue(resolvedThemeAtom)
  const hostRef = React.useRef<HTMLDivElement>(null)
  const rendererRef = React.useRef<AssistantPresenceRenderer | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const renderer = new AssistantPresenceRenderer(host, theme, motionQuery.matches)
    let disposed = false

    void renderer
      .init()
      .then((canvas) => {
        if (disposed) {
          renderer.destroy()
          return
        }
        host.appendChild(canvas)
        rendererRef.current = renderer
        setReady(true)
      })
      .catch((error: unknown) => {
        console.warn('[assistant-presence] Falling back to static rendering.', error)
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
    const onPointerMove = (event: PointerEvent): void => {
      rendererRef.current?.setPointer(event.clientX, event.clientY)
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="assistant-presence"
      data-ready={ready ? 'true' : 'false'}
      data-theme={theme}
    >
      <div className="assistant-presence__fallback">
        <span className="assistant-presence__fallback-eye" />
        <span className="assistant-presence__fallback-eye" />
      </div>
    </div>
  )
}
