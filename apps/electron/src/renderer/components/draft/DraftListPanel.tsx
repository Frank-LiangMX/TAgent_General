/**
 * DraftListPanel — 侧边栏草稿列表
 *
 * 列出 draftsAtom 中的所有草稿，按状态分组。
 * 每行：StickyNote 图标 + 标题 + 状态 Badge。
 * 点击打开/聚焦该草稿的 Tab。
 * 当前激活草稿高亮。
 */

import { useAtomValue, useStore } from 'jotai'
import { StickyNote } from 'lucide-react'
import * as React from 'react'

import type { DraftStatus, DraftDocument } from '@tagent/shared'

import { draftsAtom, currentDraftIdAtom } from '@/atoms/draft-atoms'
import {
  tabsAtom,
  activeTabIdAtom,
  createDraftTab,
  createDraftTabId,
} from '@/atoms/tab-atoms'
import { cn } from '@/lib/utils'

/** 状态颜色映射（与 DraftStatusBar 保持一致） */
const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: 'bg-foreground/12 text-foreground/55',
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

/** 状态排列顺序 */
const STATUS_ORDER: DraftStatus[] = ['draft', 'ready', 'executing', 'done', 'verified']

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
  const store = useStore()

  const groups = React.useMemo(() => groupByStatus(drafts), [drafts])

  const handleClick = (draft: DraftDocument): void => {
    const draftTabId = createDraftTabId(draft.id)
    const currentTabs = store.get(tabsAtom)
    const existingTab = currentTabs.find((t) => t.id === draftTabId)
    const draftTab = existingTab ?? createDraftTab(draft.id, draft.title)
    const otherTabs = currentTabs.filter((t) => t.id !== draftTabId)
    store.set(tabsAtom, [...otherTabs, draftTab])
    store.set(activeTabIdAtom, draftTabId)
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
