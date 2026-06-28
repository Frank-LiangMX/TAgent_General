/**
 * PluginNavSlideList — 插件侧栏导航滑动选中层
 */

import * as React from 'react'

import {
  LIST_SLIDE_HOST_CLASS,
  LIST_SLIDE_INDICATOR_CLASS,
  LIST_SLIDE_ITEM_GHOST_CLASS,
  LIST_SLIDE_ITEM_SELECTED_CLASS,
} from '@/lib/list-slide-selection'
import { measurePluginNavItem, useListSlideIndicator } from '@/hooks/useListSlideIndicator'
import { cn } from '@/lib/utils'

interface PluginNavSlideListProps {
  activeId: string | null
  layoutKey?: string
  className?: string
  children: React.ReactNode
}

export function PluginNavSlideList({
  activeId,
  layoutKey = '',
  className,
  children,
}: PluginNavSlideListProps): React.ReactElement {
  const listRef = React.useRef<HTMLDivElement>(null)
  const { plateStyle, accentStyle } = useListSlideIndicator(
    listRef,
    activeId,
    measurePluginNavItem,
    layoutKey
  )

  return (
    <div ref={listRef} className={cn('relative', LIST_SLIDE_HOST_CLASS, className)}>
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        {plateStyle ? <div className={LIST_SLIDE_INDICATOR_CLASS} style={plateStyle} /> : null}
        {accentStyle ? (
          <div
            className="sidebar-session-slide-accent session-sidebar-accent rounded-full bg-primary/50"
            style={accentStyle}
          />
        ) : null}
      </div>
      <div className="relative z-10 flex flex-col gap-0.5">{children}</div>
    </div>
  )
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
        'relative flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12px] transition-colors duration-150 titlebar-no-drag',
        active
          ? cn(
              'session-item-selected z-10 font-medium text-foreground',
              LIST_SLIDE_ITEM_SELECTED_CLASS,
              LIST_SLIDE_ITEM_GHOST_CLASS
            )
          : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/[0.05]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span className="shrink-0 rounded-md bg-foreground/6 px-1.5 py-0.5 text-[10px] tabular-nums opacity-80">
          {count}
        </span>
      ) : null}
    </button>
  )
}
