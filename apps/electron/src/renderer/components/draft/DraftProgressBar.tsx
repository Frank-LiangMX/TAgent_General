/**
 * DraftProgressBar — 分段进度条
 *
 * 在标题区域下方显示需求按状态分段的彩色进度条。
 * 块级状态回退到草稿全局状态。
 */

import * as React from 'react'

import type { DraftStatus, RequirementBlock } from '@tagent/shared'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { STATUS_STYLES, STATUS_LABELS, STATUS_ORDER } from './draft-status-styles'

interface DraftProgressBarProps {
  requirements: RequirementBlock[]
  overallStatus: DraftStatus
}

/** 提取进度条色段使用的背景色（不含文字色） */
const SEGMENT_BG: Record<DraftStatus, string> = {
  draft: 'bg-foreground/15',
  ready: 'bg-blue-500/25',
  executing: 'bg-amber-500/25',
  done: 'bg-green-500/25',
  verified: 'bg-emerald-500/25',
}

function countByStatus(
  requirements: RequirementBlock[],
  overallStatus: DraftStatus
): Map<DraftStatus, number> {
  const counts = new Map<DraftStatus, number>()
  for (const block of requirements) {
    const status = block.status ?? overallStatus
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }
  return counts
}

export function DraftProgressBar({
  requirements,
  overallStatus,
}: DraftProgressBarProps): React.ReactElement {
  const counts = React.useMemo(
    () => countByStatus(requirements, overallStatus),
    [requirements, overallStatus]
  )
  const total = requirements.length

  const segments = React.useMemo(() => {
    const result: Array<{ status: DraftStatus; width: string; count: number }> = []
    for (const status of STATUS_ORDER) {
      const count = counts.get(status)
      if (count && count > 0) {
        result.push({ status, width: `${(count / total) * 100}%`, count })
      }
    }
    return result
  }, [counts, total])

  const tooltipText = segments.map((s) => `${s.count} ${STATUS_LABELS[s.status]}`).join(' / ')

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-[3px] w-full shrink-0 bg-border/20">
            {segments.map((seg) => (
              <div
                key={seg.status}
                className={SEGMENT_BG[seg.status]}
                style={{ width: seg.width }}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px]">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
