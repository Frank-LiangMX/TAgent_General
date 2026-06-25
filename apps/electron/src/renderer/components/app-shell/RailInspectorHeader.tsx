/**
 * RailInspectorHeader — 主从布局主区顶栏（面包屑 + 标题 + 操作区）
 */

import { ChevronRight } from 'lucide-react'
import * as React from 'react'

import { detectIsWindows } from '@/lib/platform'
import { cn } from '@/lib/utils'

export interface RailInspectorCrumb {
  label: string
}

interface RailInspectorHeaderProps {
  crumbs: RailInspectorCrumb[]
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  /** Windows 上为窗口控制按钮预留右侧空间 */
  reserveWindowControls?: boolean
}

export function RailInspectorHeader({
  crumbs,
  title,
  description,
  actions,
  className,
  reserveWindowControls = true,
}: RailInspectorHeaderProps): React.ReactElement {
  const isWindows = React.useMemo(() => detectIsWindows(), [])
  const reserveControls = reserveWindowControls && isWindows

  return (
    <div
      className={cn(
        'relative shrink-0 border-b border-border/50 px-5 py-4',
        reserveControls && 'pr-[134px]',
        className
      )}
    >
      {reserveControls ? (
        <div
          className="pointer-events-none absolute inset-0 right-[126px] z-[1] titlebar-drag-region"
          aria-hidden
        />
      ) : null}

      <div className="relative z-[2] flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {crumbs.length > 0 ? (
              <nav
                className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground"
                aria-label="路径"
              >
                {crumbs.map((crumb, index) => (
                  <React.Fragment key={`${crumb.label}-${index}`}>
                    {index > 0 ? (
                      <ChevronRight size={12} className="shrink-0 text-muted-foreground/50" />
                    ) : null}
                    <span className={cn(index === crumbs.length - 1 && 'text-foreground/70')}>
                      {crumb.label}
                    </span>
                  </React.Fragment>
                ))}
              </nav>
            ) : null}
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="titlebar-no-drag relative z-[20] flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
