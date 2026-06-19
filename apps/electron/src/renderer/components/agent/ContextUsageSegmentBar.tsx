import * as React from 'react'

import type { ContextUsageCategory } from '@tagent/shared'
import { resolveContextUsageColor } from '@tagent/shared'

import { getContextUsageLabel } from '@/lib/context-usage-labels'
import {
  formatContextTokens,
  isFreeSpaceCategory,
} from '@/lib/context-usage-format'
import { cn } from '@/lib/utils'

interface ContextUsageSegmentBarProps {
  categories: ContextUsageCategory[]
  totalTokens: number
  /** 窗口上限；有值时分段条以 maxTokens 为分母并显示剩余灰段 */
  maxTokens?: number
  /** 下方已有分类列表时关闭图例，避免重复 */
  showLegend?: boolean
  className?: string
}

interface SegmentItem {
  key: string
  label: string
  tokens: number
  color: string
  widthPercent: number
}

function buildSegments(
  categories: ContextUsageCategory[],
  totalTokens: number,
  maxTokens?: number
): { segments: SegmentItem[]; denominator: number } {
  const usedCategories = categories.filter(
    (category) => category.tokens > 0 && !isFreeSpaceCategory(category.name)
  )
  const freeSpaceCategory = categories.find(
    (category) => category.tokens > 0 && isFreeSpaceCategory(category.name)
  )

  const denominator =
    maxTokens && maxTokens > 0
      ? maxTokens
      : totalTokens > 0
        ? totalTokens
        : usedCategories.reduce((sum, category) => sum + category.tokens, 0)

  const segments: SegmentItem[] = usedCategories.map((category) => ({
    key: category.name,
    label: getContextUsageLabel(category.name),
    tokens: category.tokens,
    color: resolveContextUsageColor(category.name, category.color),
    widthPercent: denominator > 0 ? (category.tokens / denominator) * 100 : 0,
  }))

  const accounted = usedCategories.reduce((sum, category) => sum + category.tokens, 0)
  const remainder =
    freeSpaceCategory?.tokens ??
    (maxTokens && maxTokens > 0 ? Math.max(0, maxTokens - Math.min(totalTokens, maxTokens)) : 0)

  if (remainder > 0 && denominator > 0) {
    segments.push({
      key: '__remainder__',
      label: freeSpaceCategory ? getContextUsageLabel(freeSpaceCategory.name) : '剩余',
      tokens: remainder,
      color: freeSpaceCategory
        ? resolveContextUsageColor(freeSpaceCategory.name, freeSpaceCategory.color)
        : '#D1D5DB',
      widthPercent: (remainder / denominator) * 100,
    })
  }

  return { segments, denominator }
}

function SegmentLegend({ segments }: { segments: SegmentItem[] }): React.ReactElement {
  const visible = segments.filter((segment) => segment.key !== '__remainder__' && segment.tokens > 0)
  if (visible.length === 0) return <></>

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {visible.map((segment) => (
        <div key={segment.key} className="flex min-w-0 items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-[3px]"
            style={{ backgroundColor: segment.color }}
            aria-hidden="true"
          />
          <span className="truncate text-[10px] text-muted-foreground">{segment.label}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-foreground/75">
            {formatContextTokens(segment.tokens)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ContextUsageSegmentBar({
  categories,
  totalTokens,
  maxTokens,
  showLegend = true,
  className,
}: ContextUsageSegmentBarProps): React.ReactElement {
  const { segments } = buildSegments(categories, totalTokens, maxTokens)
  const coloredSegments = segments.filter((segment) => segment.widthPercent > 0)

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-border/30"
        role="img"
        aria-label="Context 占用分段"
      >
        {coloredSegments.map((segment) => (
          <div
            key={segment.key}
            className="h-full min-w-[2px] shrink-0"
            style={{
              width: `${segment.widthPercent}%`,
              backgroundColor: segment.color,
            }}
            title={`${segment.label}: ${formatContextTokens(segment.tokens)}`}
          />
        ))}
      </div>
      {showLegend ? <SegmentLegend segments={coloredSegments} /> : null}
    </div>
  )
}
