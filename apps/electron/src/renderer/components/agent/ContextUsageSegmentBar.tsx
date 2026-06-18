import * as React from 'react'

import type { ContextUsageCategory } from '@tagent/shared'

import { cn } from '@/lib/utils'

interface ContextUsageSegmentBarProps {
  categories: ContextUsageCategory[]
  totalTokens: number
  className?: string
}

export function ContextUsageSegmentBar({
  categories,
  totalTokens,
  className,
}: ContextUsageSegmentBarProps): React.ReactElement {
  const visible = categories.filter((category) => category.tokens > 0)
  const denominator = totalTokens > 0 ? totalTokens : visible.reduce((sum, c) => sum + c.tokens, 0)

  return (
    <div
      className={cn('flex h-2 w-full overflow-hidden rounded-full bg-border/40', className)}
      aria-hidden="true"
    >
      {visible.map((category) => {
        const width = denominator > 0 ? (category.tokens / denominator) * 100 : 0
        return (
          <div
            key={category.name}
            className="h-full min-w-[2px] transition-[width] duration-300"
            style={{ width: `${width}%`, backgroundColor: category.color }}
            title={`${category.name}: ${category.tokens}`}
          />
        )
      })}
    </div>
  )
}
