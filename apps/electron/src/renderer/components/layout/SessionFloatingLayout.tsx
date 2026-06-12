/**
 * SessionFloatingLayout — 会话区悬浮底栏布局
 *
 * 消息列表铺满整个区域并可滚动；底部输入框/横幅浮在消息之上，
 * 配合 chat-input-glass 的 backdrop-filter 实现「会话从玻璃后方滚过」的效果。
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

interface SessionFloatingLayoutProps {
  children: React.ReactNode
  /** 底部浮层：输入框、权限横幅、错误提示等 */
  bottom: React.ReactNode
  className?: string
}

export function SessionFloatingLayout({
  children,
  bottom,
  className,
}: SessionFloatingLayoutProps): React.ReactElement {
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const body = bodyRef.current
    const bottomEl = bottomRef.current
    if (!body || !bottomEl) return

    const syncReserve = (): void => {
      body.style.setProperty('--session-bottom-reserve', `${bottomEl.offsetHeight}px`)
    }

    syncReserve()
    const observer = new ResizeObserver(syncReserve)
    observer.observe(bottomEl)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={bodyRef}
      className={cn('session-body relative flex flex-1 min-h-0 min-w-0 flex-col', className)}
    >
      <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col">
        {children}
      </div>

      <div
        ref={bottomRef}
        className="session-bottom-stack pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col"
      >
        {bottom}
      </div>
    </div>
  )
}
