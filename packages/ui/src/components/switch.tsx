'use client'

import * as SwitchPrimitives from '@radix-ui/react-switch'
import { gsap } from 'gsap'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Switch - 通用开关
 *
 * 自动适配材质:
 * - frosted: 标准实色开关
 * - glass: 复刻 Liquid Toggle Switch 的 knockout + goo + GSAP 交互
 * - soft: 拟态凸起
 *
 * glass材质下的液态效果参考:
 * - https://freefrontend.com/css-liquid-glass/ (Liquid Toggle Switch)
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(
  (
    { className, onBlur, onClick, onKeyDown, onPointerCancel, onPointerDown, style, ...props },
    ref
  ) => {
    const rootRef = React.useRef<HTMLButtonElement | null>(null)
    const timelineRef = React.useRef<gsap.core.Timeline | null>(null)
    const releaseCallRef = React.useRef<gsap.core.Tween | null>(null)
    const instanceId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '')
    const gooFilterId = `ui-switch-goo-${instanceId}`
    const removeBlackFilterId = `ui-switch-remove-black-${instanceId}`

    const setRootRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        rootRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    const isGlassMaterial = (element: HTMLElement): boolean =>
      element.closest('[data-material="glass"]') !== null

    const clearLiquidState = React.useCallback(() => {
      const root = rootRef.current
      if (!root) return
      root.dataset.liquidActive = 'false'
      root.dataset.liquidPressed = 'false'
    }, [])

    React.useLayoutEffect(() => {
      const root = rootRef.current
      if (!root) return
      gsap.set(root, {
        '--complete': root.dataset.state === 'checked' ? 100 : 0,
      })

      return () => {
        timelineRef.current?.kill()
        releaseCallRef.current?.kill()
      }
    }, [])

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event)
      if (event.defaultPrevented || !isGlassMaterial(event.currentTarget)) return
      event.currentTarget.dataset.liquidActive = 'true'
      event.currentTarget.dataset.liquidPressed = 'true'
    }

    const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerCancel?.(event)
      timelineRef.current?.kill()
      releaseCallRef.current?.kill()
      clearLiquidState()
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event)
      if (
        !event.defaultPrevented &&
        (event.key === ' ' || event.key === 'Enter') &&
        isGlassMaterial(event.currentTarget)
      ) {
        event.currentTarget.dataset.liquidActive = 'true'
        event.currentTarget.dataset.liquidPressed = 'true'
      }
    }

    const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
      onBlur?.(event)
      if (!timelineRef.current?.isActive()) clearLiquidState()
    }

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (event.defaultPrevented || !isGlassMaterial(event.currentTarget)) return

      const root = event.currentTarget
      const targetComplete = root.dataset.state === 'checked' ? 0 : 100

      timelineRef.current?.kill()
      releaseCallRef.current?.kill()
      root.dataset.liquidActive = 'true'
      root.dataset.liquidPressed = 'true'

      timelineRef.current = gsap
        .timeline({
          onComplete: () => {
            releaseCallRef.current = gsap.delayedCall(0.05, clearLiquidState)
          },
        })
        .to(root, {
          '--complete': targetComplete,
          duration: 0.12,
          delay: 0.18,
          ease: 'none',
        })
    }

    const switchStyle = {
      ...style,
      '--ui-switch-goo-filter': `url("#${gooFilterId}")`,
      '--ui-switch-remove-black-filter': `url("#${removeBlackFilterId}")`,
    } as React.CSSProperties

    return (
      <SwitchPrimitives.Root
        className={cn(
          'ui-switch',
          'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-foreground/24',
          className
        )}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        style={switchStyle}
        {...props}
        ref={setRootRef}
      >
        <svg className="ui-switch-filter-defs" aria-hidden="true">
          <defs>
            <filter id={gooFilterId}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -10"
                result="goo"
              />
              <feComposite in="goo" operator="atop" />
            </filter>
            <filter id={removeBlackFilterId} colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -255 -255 -255 0 1"
                result="black-pixels"
              />
              <feMorphology in="black-pixels" operator="dilate" radius="0.5" result="smoothed" />
              <feComposite in="SourceGraphic" in2="smoothed" operator="out" />
            </filter>
          </defs>
        </svg>

        {/* Liquid Toggle Switch 原始分层：knockout mask + goo window。 */}
        <span className="ui-switch-knockout" aria-hidden="true">
          <span className="ui-switch-indicator ui-switch-indicator-masked">
            <span className="ui-switch-mask" />
          </span>
        </span>
        <span className="ui-switch-indicator-liquid" aria-hidden="true">
          <span className="ui-switch-liquid-shadow" />
          <span className="ui-switch-liquid-wrapper">
            <span className="ui-switch-liquids">
              <span className="ui-switch-track-shadow" />
              <span className="ui-switch-liquid-track" />
            </span>
          </span>
          <span className="ui-switch-liquid-cover" />
        </span>

        <SwitchPrimitives.Thumb
          className={cn(
            'ui-switch-thumb',
            'pointer-events-none block h-4 w-4 rounded-full ring-0 transition-transform duration-200',
            'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
            'bg-background dark:bg-foreground dark:data-[state=checked]:bg-background'
          )}
        />
      </SwitchPrimitives.Root>
    )
  }
)
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
