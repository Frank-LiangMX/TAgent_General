import * as React from 'react'

import type { ContextUsageCategory } from '@tagent/shared'

import { getContextUsageLabel } from '@/lib/context-usage-labels'
import { cn } from '@/lib/utils'

interface ContextUsageCategoryRowProps {
  category: ContextUsageCategory
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return `${tokens}`
}

export function ContextUsageCategoryRow({
  category,
}: ContextUsageCategoryRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-sm"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        />
        <span className={cn('truncate text-foreground/80', category.isDeferred && 'opacity-70')}>
          {getContextUsageLabel(category.name)}
          {category.isDeferred ? (
            <span className="ml-1 text-[10px] text-muted-foreground">(延迟加载)</span>
          ) : null}
        </span>
      </div>
      <span className="shrink-0 tabular-nums text-foreground/90">{formatTokens(category.tokens)}</span>
    </div>
  )
}
