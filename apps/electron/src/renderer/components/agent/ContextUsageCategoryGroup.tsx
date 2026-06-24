import type { ContextUsageCategory } from '@tagent/shared'
import { resolveContextUsageColor } from '@tagent/shared'
import { ChevronDown } from 'lucide-react'
import * as React from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { getContextUsageLabel } from '@/lib/context-usage-labels'
import { formatContextTokens, isFreeSpaceCategory } from '@/lib/context-usage-format'
import { cn } from '@/lib/utils'

interface ContextUsageCategoryGroupProps {
  category: ContextUsageCategory
  itemCount?: number
  barPercent?: number
  defaultOpen?: boolean
  children: React.ReactNode
}

export function ContextUsageCategoryGroup({
  category,
  itemCount,
  barPercent,
  defaultOpen = false,
  children,
}: ContextUsageCategoryGroupProps): React.ReactElement {
  const label = getContextUsageLabel(category.name)
  const swatchColor = resolveContextUsageColor(category.name, category.color)
  const isFreeSpace = isFreeSpaceCategory(category.name)

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full flex-col gap-1.5 rounded-xl px-2 py-1.5 text-left transition-colors',
          'hover:bg-foreground/5'
        )}
      >
        <div className="grid w-full grid-cols-[1fr_auto_42px] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
            <span
              className="size-2.5 shrink-0 rounded-[4px]"
              style={{ backgroundColor: swatchColor }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/85">
              {label}
              {itemCount != null && itemCount > 0 ? (
                <span className="ml-1 text-muted-foreground">({itemCount})</span>
              ) : null}
            </span>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-foreground/90">
            {formatContextTokens(category.tokens)}
          </span>
          <span className="text-right text-[11px] tabular-nums text-muted-foreground">
            {barPercent != null ? `${Math.round(barPercent)}%` : '—'}
          </span>
        </div>
        {!isFreeSpace && barPercent != null && barPercent > 0 && (
          <div className="ml-5 h-1 overflow-hidden rounded-full bg-foreground/8">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, barPercent)}%`,
                backgroundColor: swatchColor,
              }}
            />
          </div>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-1 pl-5">
        <div className="mt-1 flex flex-col gap-1 border-l border-foreground/10 pl-2.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
