import * as React from 'react'

import type { ContextUsageCategory } from '@tagent/shared'
import { resolveContextUsageColor } from '@tagent/shared'

import { ContextUsageTermHint } from './ContextUsageTermHint'

import {
  categoryPercentOfWindow,
  formatContextTokens,
  isFreeSpaceCategory,
} from '@/lib/context-usage-format'
import { cn } from '@/lib/utils'

interface ContextUsageCategoryRowProps {
  category: ContextUsageCategory
  maxTokens?: number
}

export function ContextUsageCategoryRow({
  category,
  maxTokens,
}: ContextUsageCategoryRowProps): React.ReactElement {
  const barPercent = categoryPercentOfWindow(category.tokens, maxTokens)
  const isFreeSpace = isFreeSpaceCategory(category.name)
  const swatchColor = resolveContextUsageColor(category.name, category.color)

  return (
    <div className="rounded-xl px-2 py-1.5 transition-colors hover:bg-foreground/5">
      <div className="grid grid-cols-[1fr_auto_42px] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-[4px]"
            style={{ backgroundColor: isFreeSpace ? '#D1D5DB' : swatchColor }}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <ContextUsageTermHint
              term={category.name}
              className={cn(
                'min-w-0 truncate text-xs text-foreground/85',
                category.isDeferred && 'opacity-70'
              )}
            />
            {category.isDeferred ? (
              <ContextUsageTermHint
                term="延迟加载"
                display="延迟"
                inline
                className="shrink-0 text-[10px] text-muted-foreground"
              />
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-foreground/90">
          {formatContextTokens(category.tokens)}
        </span>
        <span className="text-right text-[11px] tabular-nums text-muted-foreground">
          {barPercent != null ? `${barPercent}%` : '—'}
        </span>
      </div>
      {!isFreeSpace && barPercent != null && barPercent > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/8">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${Math.min(100, barPercent)}%`,
              backgroundColor: swatchColor,
            }}
          />
        </div>
      )}
    </div>
  )
}
