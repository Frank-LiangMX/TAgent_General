const TRANSITION_ROOT_ATTRIBUTE = 'data-assistant-presence-transition'
const TRANSITION_TARGET_ATTRIBUTE = 'data-assistant-transition-target'
const TARGET_WAIT_TIMEOUT_MS = 1500
const LEAVE_DURATION_MS = 190
const TRAVEL_DURATION_MS = 360
const CROSSFADE_DURATION_MS = 100
const LINEAR_SMOOTH_EASING = 'cubic-bezier(0.45, 0, 0.55, 1)'

export interface AssistantTransitionRect {
  height: number
  left: number
  top: number
  width: number
}

export interface AssistantTransitionGeometry {
  deltaX: number
  deltaY: number
  scale: number
}

export interface AssistantPresenceTransitionHandle {
  cancel: () => void
  finish: (sessionId: string) => Promise<void>
  readyForNavigation: Promise<void>
}

type SessionEntranceRole = 'composer' | 'rail' | 'tab'

export function calculateAssistantTransitionGeometry(
  source: AssistantTransitionRect,
  target: AssistantTransitionRect
): AssistantTransitionGeometry {
  const sourceCenterX = source.left + source.width / 2
  const sourceCenterY = source.top + source.height / 2
  const targetCenterX = target.left + target.width / 2
  const targetCenterY = target.top + target.height / 2
  const scale =
    source.width > 0 && source.height > 0
      ? Math.min(target.width / source.width, target.height / source.height)
      : 1

  return {
    deltaX: targetCenterX - sourceCenterX,
    deltaY: targetCenterY - sourceCenterY,
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
  }
}

function transformAt(deltaX: number, deltaY: number, scale: number): string {
  return `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale})`
}

export function buildAssistantTransitionKeyframes(
  geometry: AssistantTransitionGeometry
): Keyframe[] {
  const { deltaX, deltaY, scale } = geometry
  return [
    { offset: 0, opacity: 1, transform: transformAt(0, 0, 1) },
    {
      offset: 0.16,
      opacity: 1,
      transform: transformAt(deltaX * 0.08, deltaY * 0.035 - 6, 1.02),
    },
    {
      offset: 0.72,
      opacity: 1,
      transform: transformAt(deltaX * 0.82, deltaY * 0.82 - 2, 1 + (scale - 1) * 0.78),
    },
    { offset: 1, opacity: 1, transform: transformAt(deltaX, deltaY, scale) },
  ]
}

function copyCanvasFrames(source: HTMLElement, clone: HTMLElement): void {
  const sourceCanvases = source.querySelectorAll('canvas')
  const cloneCanvases = clone.querySelectorAll('canvas')

  sourceCanvases.forEach((sourceCanvas, index) => {
    const cloneCanvas = cloneCanvases.item(index)
    if (
      !(sourceCanvas instanceof HTMLCanvasElement) ||
      !(cloneCanvas instanceof HTMLCanvasElement)
    ) {
      return
    }

    cloneCanvas.width = sourceCanvas.width
    cloneCanvas.height = sourceCanvas.height
    try {
      const context = cloneCanvas.getContext('2d')
      if (!context) {
        clone.dataset.ready = 'false'
        return
      }
      context.drawImage(sourceCanvas, 0, 0)
      const centerAlpha = context.getImageData(
        Math.floor(cloneCanvas.width / 2),
        Math.floor(cloneCanvas.height / 2),
        1,
        1
      ).data[3]
      if (centerAlpha === 0) clone.dataset.ready = 'false'
    } catch (error) {
      console.warn('[assistant-presence] Could not snapshot the transition frame.', error)
      clone.dataset.ready = 'false'
    }
  })
}

function createOverlay(source: HTMLElement, rect: DOMRect): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll('button').forEach((button) => button.remove())
  copyCanvasFrames(source, clone)
  clone.classList.add('assistant-presence-transition-overlay')
  clone.setAttribute('aria-hidden', 'true')
  clone.style.position = 'fixed'
  clone.style.zIndex = '1200'
  clone.style.left = `${rect.left}px`
  clone.style.top = `${rect.top}px`
  clone.style.width = `${rect.width}px`
  clone.style.height = `${rect.height}px`
  clone.style.margin = '0'
  clone.style.pointerEvents = 'none'
  clone.style.transform = 'none'
  clone.style.transformOrigin = 'center center'
  clone.style.willChange = 'transform, opacity'
  document.body.appendChild(clone)
  return clone
}

function getTarget(sessionId: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[${TRANSITION_TARGET_ATTRIBUTE}]`)
  for (const candidate of candidates) {
    if (candidate.dataset.assistantTransitionTarget === sessionId) return candidate
  }
  return null
}

async function waitForTarget(
  sessionId: string,
  isCancelled: () => boolean
): Promise<HTMLElement | null> {
  const startedAt = performance.now()

  while (!isCancelled() && performance.now() - startedAt < TARGET_WAIT_TIMEOUT_MS) {
    const target = getTarget(sessionId)
    if (target) {
      const rect = target.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) return target
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  return null
}

async function waitForAnimation(animation: Animation): Promise<void> {
  try {
    await animation.finished
  } catch {
    // Cancellation is expected during rapid navigation or an interrupted creation attempt.
  }
}

function startWelcomeExit(
  source: HTMLElement,
  activeAnimations: Set<Animation>,
  reducedMotion: boolean
): { ready: Promise<void>; root: HTMLElement | null } {
  const root = source.closest<HTMLElement>('[data-assistant-welcome-transition]')
  if (!root) return { ready: Promise.resolve(), root: null }

  root.style.pointerEvents = 'none'
  const items = root.querySelectorAll<HTMLElement>('[data-welcome-transition-item]')
  const animations = Array.from(items).map((item, index) => {
    const direction = item.dataset.welcomeTransitionDirection === 'right' ? 1 : -1
    const animation = item.animate(
      reducedMotion
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            { opacity: 0, transform: `translate3d(${direction * 64}px, 0, 0)` },
          ],
      {
        delay: reducedMotion ? 0 : index * 14,
        duration: reducedMotion ? 120 : LEAVE_DURATION_MS,
        easing: reducedMotion ? 'ease-out' : LINEAR_SMOOTH_EASING,
        fill: 'both',
      }
    )
    activeAnimations.add(animation)
    return animation
  })

  return {
    ready: Promise.all(animations.map(waitForAnimation)).then(() => undefined),
    root,
  }
}

function getSessionEntranceElement(
  role: SessionEntranceRole,
  sessionId: string
): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    `[data-session-transition-enter="${role}"]`
  )
  for (const candidate of candidates) {
    const candidateSessionId = candidate.dataset.sessionTransitionSession
    if (!candidateSessionId || candidateSessionId === sessionId) return candidate
  }
  return null
}

function startSessionEntrances(
  sessionId: string,
  activeAnimations: Set<Animation>,
  reducedMotion: boolean
): Animation[] {
  const specs: Array<{
    delay: number
    duration: number
    from: string
    role: SessionEntranceRole
  }> = [
    { role: 'tab', delay: 0, duration: 220, from: 'translate3d(0, -12px, 0)' },
    { role: 'rail', delay: 40, duration: 240, from: 'translate3d(18px, 0, 0)' },
    { role: 'composer', delay: 90, duration: 280, from: 'translate3d(0, 22px, 0)' },
  ]

  return specs.flatMap(({ role, delay, duration, from }) => {
    const element = getSessionEntranceElement(role, sessionId)
    if (!element || element.getBoundingClientRect().width <= 0) return []
    element.style.willChange = 'transform, opacity'
    const animation = element.animate(
      reducedMotion
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: from },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          ],
      {
        delay: reducedMotion ? 0 : delay,
        duration: reducedMotion ? 140 : duration,
        easing: reducedMotion ? 'ease-out' : LINEAR_SMOOTH_EASING,
        fill: 'both',
      }
    )
    activeAnimations.add(animation)
    return [animation]
  })
}

export function beginAssistantPresenceTransition(
  source: HTMLElement | null,
  reducedMotion = false
): AssistantPresenceTransitionHandle | null {
  if (!source) return null
  const sourceRect = source.getBoundingClientRect()
  if (sourceRect.width <= 0 || sourceRect.height <= 0) return null

  const activeAnimations = new Set<Animation>()
  const overlay = createOverlay(source, sourceRect)
  const welcomeExit = startWelcomeExit(source, activeAnimations, reducedMotion)
  source.style.visibility = 'hidden'
  document.documentElement.setAttribute(TRANSITION_ROOT_ATTRIBUTE, 'pending')
  let cancelled = false
  let target: HTMLElement | null = null

  const cleanup = (): void => {
    activeAnimations.forEach((animation) => animation.cancel())
    activeAnimations.clear()
    overlay.remove()
    source.style.removeProperty('visibility')
    welcomeExit.root?.style.removeProperty('pointer-events')
    if (target) {
      target.style.removeProperty('opacity')
      target.style.removeProperty('will-change')
    }
    document
      .querySelectorAll<HTMLElement>('[data-session-transition-enter]')
      .forEach((element) => element.style.removeProperty('will-change'))
    document.documentElement.removeAttribute(TRANSITION_ROOT_ATTRIBUTE)
  }

  return {
    cancel: () => {
      cancelled = true
      cleanup()
    },
    readyForNavigation: welcomeExit.ready,
    finish: async (sessionId: string) => {
      target = await waitForTarget(sessionId, () => cancelled)
      if (cancelled) return
      if (!target) {
        cleanup()
        return
      }

      target.style.opacity = '0'
      target.style.willChange = 'opacity'
      const targetRect = target.getBoundingClientRect()
      document.documentElement.setAttribute(TRANSITION_ROOT_ATTRIBUTE, 'entering')
      const entranceAnimations = startSessionEntrances(sessionId, activeAnimations, reducedMotion)

      if (!reducedMotion) {
        const geometry = calculateAssistantTransitionGeometry(sourceRect, targetRect)
        const travelAnimation = overlay.animate(buildAssistantTransitionKeyframes(geometry), {
          duration: TRAVEL_DURATION_MS,
          easing: LINEAR_SMOOTH_EASING,
          fill: 'forwards',
        })
        activeAnimations.add(travelAnimation)
        await waitForAnimation(travelAnimation)
        if (cancelled) return
      }

      document.documentElement.setAttribute(TRANSITION_ROOT_ATTRIBUTE, 'arrived')
      const fadeDuration = reducedMotion ? 140 : CROSSFADE_DURATION_MS
      const overlayFade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: fadeDuration,
        easing: 'ease-out',
        fill: 'forwards',
      })
      const targetFade = target.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: fadeDuration,
        easing: 'ease-out',
        fill: 'forwards',
      })
      activeAnimations.add(overlayFade)
      activeAnimations.add(targetFade)
      await Promise.all([
        waitForAnimation(overlayFade),
        waitForAnimation(targetFade),
        ...entranceAnimations.map(waitForAnimation),
      ])
      if (!cancelled) cleanup()
    },
  }
}
