/**
 * SessionFloatingLayout — 会话区悬浮底栏布局
 *
 * 消息列表铺满整个区域并可滚动；底部输入框/横幅浮在消息之上，
 * 配合 chat-input-glass 的 backdrop-filter 实现「会话从玻璃后方滚过」的效果。
 *
 * 底栏高度变化（如 composer focus 展开 underlay）时：
 * 更新 --session-bottom-reserve，并在用户贴底时把滚动钉在底部，
 * 避免输入框上移后挡住原先可见的最后几条消息。
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

interface SessionFloatingLayoutProps {
  children: React.ReactNode
  /** 底部浮层：输入框、权限横幅、错误提示等 */
  bottom: React.ReactNode
  className?: string
}

/** StickToBottom.Content 的滚动容器：role=log 下 height:100% 的那层 */
function findConversationScrollEl(body: HTMLElement): HTMLElement | null {
  const log = body.querySelector('[role="log"]')
  if (!log) return null
  for (const child of Array.from(log.querySelectorAll('div'))) {
    const el = child as HTMLElement
    const style = el.style
    // use-stick-to-bottom Content 根节点：height/width 100% + overflow auto
    if (style.height === '100%' && style.width === '100%') {
      return el
    }
  }
  // 兜底：可滚动的最大块
  let best: HTMLElement | null = null
  let bestOverflow = 0
  for (const child of Array.from(log.querySelectorAll('div'))) {
    const el = child as HTMLElement
    const overflow = el.scrollHeight - el.clientHeight
    if (overflow > bestOverflow) {
      bestOverflow = overflow
      best = el
    }
  }
  return best
}

const NEAR_BOTTOM_PX = 80
/** 与 underlay height transition 对齐，贴底时在动画期间持续钉底 */
const STICK_FOLLOW_MS = 280

export function SessionFloatingLayout({
  children,
  bottom,
  className,
}: SessionFloatingLayoutProps): React.ReactElement {
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const prevBottomHeightRef = React.useRef(0)
  const stickRafRef = React.useRef(0)

  React.useEffect(() => {
    const body = bodyRef.current
    const bottomEl = bottomRef.current
    if (!body || !bottomEl) return

    const stopStickFollow = (): void => {
      if (stickRafRef.current) {
        cancelAnimationFrame(stickRafRef.current)
        stickRafRef.current = 0
      }
    }

    /** 用户贴底时，在 duration 内持续 scrollTop = max，跟上底栏增高动画 */
    const stickToBottomFor = (scrollEl: HTMLElement, durationMs: number): void => {
      stopStickFollow()
      const start = performance.now()
      const tick = (now: number): void => {
        scrollEl.scrollTop = scrollEl.scrollHeight - scrollEl.clientHeight
        if (now - start < durationMs) {
          stickRafRef.current = requestAnimationFrame(tick)
        } else {
          stickRafRef.current = 0
        }
      }
      stickRafRef.current = requestAnimationFrame(tick)
    }

    const applyReserve = (): void => {
      const nextH = bottomEl.offsetHeight
      const prevH = prevBottomHeightRef.current
      const delta = nextH - prevH

      body.style.setProperty('--session-bottom-reserve', `${nextH}px`)

      if (prevH > 0 && delta !== 0) {
        const scrollEl = findConversationScrollEl(body)
        if (scrollEl) {
          const distanceFromBottom =
            scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
          const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX

          if (delta > 0 && nearBottom) {
            // 底栏变高（underlay 展开）：钉在底部，会话坐标跟着上移
            stickToBottomFor(scrollEl, STICK_FOLLOW_MS)
          } else if (delta < 0 && nearBottom) {
            // 收回：同样钉底，避免留白跳动
            stickToBottomFor(scrollEl, 120)
          } else if (delta > 0 && !nearBottom) {
            // 不在底部：垫高 padding 后保持视觉锚点（内容不跳）
            requestAnimationFrame(() => {
              scrollEl.scrollTop += delta
            })
          }
        }
      }

      prevBottomHeightRef.current = nextH
    }

    applyReserve()

    let rafId = 0
    const scheduleSync = (): void => {
      if (rafId !== 0) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        applyReserve()
      })
    }

    const observer = new ResizeObserver(scheduleSync)
    observer.observe(bottomEl)
    return () => {
      observer.disconnect()
      stopStickFollow()
      if (rafId !== 0) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div
      ref={bodyRef}
      className={cn('session-body relative flex flex-1 min-h-0 min-w-0 flex-col', className)}
    >
      <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col">{children}</div>

      <div
        ref={bottomRef}
        className="session-bottom-stack pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col"
      >
        {bottom}
      </div>
    </div>
  )
}
