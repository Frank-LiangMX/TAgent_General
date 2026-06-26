/**
 * RequirementList — 需求块容器
 *
 * 遍历当前草稿需求列表渲染 RequirementBlockCard，底部提供"添加需求"按钮。
 */

import { useSetAtom } from 'jotai'
import { Plus } from 'lucide-react'
import * as React from 'react'

import type { RequirementBlock } from '@tagent/shared'

import { currentDraftRequirementsAtom } from '@/atoms/draft-atoms'

import { RequirementBlockCard } from './RequirementBlockCard'

interface RequirementListProps {
  requirements: RequirementBlock[]
}

/** 自动递增 label：找到最大数字，+1 */
function nextLabel(requirements: RequirementBlock[]): string {
  const nums = requirements
    .map((r) => {
      const m = /^R-(\d+)$/.exec(r.label)
      return m?.[1] ? parseInt(m[1], 10) : 0
    })
    .filter((n) => n > 0)
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `R-${max + 1}`
}

export function RequirementList({ requirements }: RequirementListProps): React.ReactElement {
  const setRequirements = useSetAtom(currentDraftRequirementsAtom)

  const addRequirement = (): void => {
    const newBlock: RequirementBlock = {
      id: crypto.randomUUID(),
      label: nextLabel(requirements),
      title: '',
      description: '',
      acceptanceCriteria: [],
    }
    setRequirements((prev) => [...prev, newBlock])
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-foreground/70">需求列表</h2>

      {requirements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 bg-muted/20 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground/50 mb-1">暂无需求块</p>
          <p className="text-[11px] text-muted-foreground/40">点击下方按钮添加第一个需求</p>
        </div>
      ) : (
        requirements.map((block, index) => (
          <RequirementBlockCard key={block.id} block={block} index={index} />
        ))
      )}

      {/* 添加需求按钮 */}
      <button
        type="button"
        onClick={addRequirement}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border/40 text-[12px] text-foreground/40 hover:text-foreground/60 hover:border-border/60 hover:bg-muted/10 transition-colors"
      >
        <Plus size={14} />
        <span>添加需求</span>
      </button>
    </div>
  )
}
