/**
 * DraftListPanel — 侧边栏草稿列表
 *
 * 列出 draftsAtom 中的所有草稿，按状态分组。
 * 点击使用 useOpenSession 打开/聚焦草稿 Tab。
 */

import { useAtomValue } from 'jotai'
import { StickyNote } from 'lucide-react'
import * as React from 'react'

import type { DraftStatus, DraftDocument } from '@tagent/shared'

import { draftsAtom, currentDraftIdAtom } from '@/atoms/draft-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { STATUS_STYLES, STATUS_LABELS, STATUS_ORDER } from './draft-status-styles'
import { cn } from '@/lib/utils'

function groupByStatus(drafts: DraftDocument[]): Array<{ status: DraftStatus; items: DraftDocument[] }> {
  const groups = new Map<DraftStatus, DraftDocument[]>()
  for (const d of drafts) {
    const list = groups.get(d.status) ?? []
    list.push(d)
    groups.set(d.status, list)
  }
  const result: Array<{ status: DraftStatus; items: DraftDocument[] }> = []
  for (const s of STATUS_ORDER) {
    const items = groups.get(s)
    if (items && items.length > 0) {
      result.push({ status: s, items })
    }
  }
  return result
}

export function DraftListPanel(): React.ReactElement {
  const drafts = useAtomValue(draftsAtom)
  const currentDraftId = useAtomValue(currentDraftIdAtom)
  const openSession = useOpenSession()

  const groups = React.useMemo(() => groupByStatus(drafts), [drafts])

  const handleClick = (draft: DraftDocument): void => {
    openSession('draft', draft.id, draft.title)
  }

  if (drafts.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[12px] text-foreground/30">
        暂无需求草稿
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
      {groups.map(({ status, items }) => (
        <div key={status} className="mb-3 last:mb-0">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1 px-1">
            {STATUS_LABELS[status]}
          </p>
          <div className="flex flex-col gap-0.5">
            {items.map((draft) => {
              const isActive = draft.id === currentDraftId
              return (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => handleClick(draft)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-[7px] rounded-md text-left transition-colors duration-100',
                    isActive
                      ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                      : 'text-foreground/60 hover:bg-primary/5 hover:text-foreground'
                  )}
                >
                  <StickyNote size={14} className={cn('shrink-0', isActive ? 'text-primary/70' : 'text-foreground/35')} />
                  <span className="text-[13px] truncate flex-1 min-w-0">{draft.title || '未命名草稿'}</span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium shrink-0',
                      STATUS_STYLES[draft.status]
                    )}
                  >
                    {STATUS_LABELS[draft.status]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
