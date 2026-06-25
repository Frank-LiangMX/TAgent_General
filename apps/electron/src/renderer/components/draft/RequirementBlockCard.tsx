/**
 * RequirementBlockCard — 单个需求块卡片
 *
 * 展示：R-n 标签（彩色 Badge） + 标题（可编辑输入） + 描述（可折叠文本域） + 验收标准（复选列表 + 增删）
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { ChevronDown, ChevronRight, Plus, X, Check } from 'lucide-react'
import * as React from 'react'

import type { RequirementBlock, AcceptanceCriterion, DraftStatus } from '@tagent/shared'

import { currentDraftRequirementsAtom, currentDraftAtom } from '@/atoms/draft-atoms'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface RequirementBlockCardProps {
  block: RequirementBlock
  index: number
}

/** 状态对应的颜色 */
const STATUS_COLORS: Record<DraftStatus, string> = {
  draft: 'bg-foreground/15 text-foreground/60',
  ready: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  executing: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
  verified: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
}

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: '草稿',
  ready: '就绪',
  executing: '执行中',
  done: '完成',
  verified: '已验证',
}

export function RequirementBlockCard({ block, index }: RequirementBlockCardProps): React.ReactElement {
  const setRequirements = useSetAtom(currentDraftRequirementsAtom)
  const draft = useAtomValue(currentDraftAtom)

  // 块级状态覆盖：优先用 block.status，否则用 draft 全局状态
  const status: DraftStatus = block.status ?? draft?.status ?? 'draft'

  // 描述折叠
  const [descExpanded, setDescExpanded] = React.useState(false)

  // ---- 标题编辑 ----
  const updateField = <K extends keyof RequirementBlock>(key: K, value: RequirementBlock[K]): void => {
    setRequirements((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    )
  }

  // ---- 验收标准 ----
  const addCriterion = (): void => {
    const newCriterion: AcceptanceCriterion = {
      id: crypto.randomUUID(),
      text: '',
      checked: false,
    }
    setRequirements((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, acceptanceCriteria: [...r.acceptanceCriteria, newCriterion] }
          : r
      )
    )
  }

  const removeCriterion = (criterionId: string): void => {
    setRequirements((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, acceptanceCriteria: r.acceptanceCriteria.filter((c) => c.id !== criterionId) }
          : r
      )
    )
  }

  const updateCriterion = (criterionId: string, updates: Partial<AcceptanceCriterion>): void => {
    setRequirements((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              acceptanceCriteria: r.acceptanceCriteria.map((c) =>
                c.id === criterionId ? { ...c, ...updates } : c
              ),
            }
          : r
      )
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] overflow-hidden">
      {/* 卡片头部：标签 + 标题 + 状态 */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30">
        <Badge
          variant="secondary"
          className={cn('text-[10px] font-semibold tracking-wide px-1.5 py-0.5', STATUS_COLORS[status])}
        >
          {block.label}
        </Badge>

        <input
          value={block.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="需求标题"
          className="flex-1 min-w-0 text-sm font-medium text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
        />

        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0.5 border-0 shrink-0', STATUS_COLORS[status])}
        >
          {STATUS_LABELS[status]}
        </Badge>
      </div>

      {/* 描述区域（可折叠） */}
      <div className="px-4 py-2">
        <button
          type="button"
          onClick={() => setDescExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-[12px] text-foreground/50 hover:text-foreground/70 transition-colors mb-1"
        >
          {descExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>描述</span>
        </button>

        {descExpanded && (
          <textarea
            value={block.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="详细描述这个需求…"
            rows={3}
            className="w-full text-sm text-foreground/80 bg-muted/30 rounded-lg px-3 py-2 outline-none resize-y min-h-[60px] placeholder:text-muted-foreground/40 focus:bg-muted/40 transition-colors"
          />
        )}
      </div>

      {/* 验收标准 */}
      {block.acceptanceCriteria.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-[11px] font-medium text-foreground/50 mb-1.5">验收标准</p>
          <div className="space-y-1">
            {block.acceptanceCriteria.map((criterion) => (
              <div key={criterion.id} className="flex items-center gap-2 group">
                <button
                  type="button"
                  onClick={() => updateCriterion(criterion.id, { checked: !criterion.checked })}
                  className={cn(
                    'size-4 rounded-[4px] border shrink-0 flex items-center justify-center transition-colors',
                    criterion.checked
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border/60 hover:border-primary/50'
                  )}
                  aria-label={criterion.checked ? '取消完成' : '标记完成'}
                >
                  {criterion.checked && <Check size={10} strokeWidth={3} />}
                </button>

                <input
                  value={criterion.text}
                  onChange={(e) => updateCriterion(criterion.id, { text: e.target.value })}
                  placeholder="验收条件…"
                  className={cn(
                    'flex-1 min-w-0 text-[13px] bg-transparent outline-none',
                    criterion.checked ? 'text-muted-foreground/50 line-through' : 'text-foreground/80'
                  )}
                />

                <button
                  type="button"
                  onClick={() => removeCriterion(criterion.id)}
                  className="p-0.5 rounded text-foreground/25 hover:text-destructive/70 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  aria-label="删除标准"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 添加验收标准按钮 */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={addCriterion}
          className="flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors"
        >
          <Plus size={11} />
          <span>添加验收标准</span>
        </button>
      </div>
    </div>
  )
}
