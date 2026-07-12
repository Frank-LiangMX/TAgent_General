/**
 * PluginNavSlideList / PluginNavItem — 插件侧栏导航
 *
 * 选中态与过渡对齐会话列表：session-list-row + session-list-item-active
 * （不再使用 list-slide 滑动底板）
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

interface PluginNavSlideListProps {
  activeId: string | null
  layoutKey?: string
  className?: string
  children: React.ReactNode
}

export function PluginNavSlideList({
  className,
  children,
}: PluginNavSlideListProps): React.ReactElement {
  return <div className={cn('flex flex-col gap-0.5', className)}>{children}</div>
}

interface PluginNavItemProps {
  navId: string
  active: boolean
  icon: React.ReactNode
  label: string
  count?: number
  onClick: () => void
}

export function PluginNavItem({
  navId,
  active,
  icon,
  label,
  count,
  onClick,
}: PluginNavItemProps): React.ReactElement {
  return (
    <button
      type="button"
      data-plugin-nav-id={navId}
      onClick={onClick}
      className={cn(
        'session-list-row relative flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] font-medium titlebar-no-drag',
        active ? 'session-list-item-active z-10' : 'text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md',
          active ? 'bg-primary/12' : 'bg-foreground/[0.05]'
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
            active ? 'bg-primary/10 opacity-90' : 'bg-foreground/6 opacity-80'
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}
