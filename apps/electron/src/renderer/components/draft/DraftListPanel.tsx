/**
 * DraftListPanel — 侧边栏草稿列表
 *
 * 列出 draftsAtom 中的所有草稿，按状态分组。
 * 点击使用 useOpenSession 打开/聚焦草稿 Tab。
 * 右键菜单支持删除。
 */

import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { StickyNote, Trash2 } from 'lucide-react'
import * as React from 'react'

import type { DraftStatus, DraftDocument } from '@tagent/shared'

import { draftsAtom, currentDraftIdAtom, deleteDraftAtom } from '@/atoms/draft-atoms'
import { tabsAtom, activeTabIdAtom, closeTab, createDraftTabId } from '@/atoms/tab-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  const deleteDraft = useSetAtom(deleteDraftAtom)
  const store = useStore()

  const groups = React.useMemo(() => groupByStatus(drafts), [drafts])

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)

  const handleClick = (draft: DraftDocument): void => {
    openSession('draft', draft.id, draft.title)
  }

  const handleRequestDelete = (draftId: string): void => {
    setPendingDeleteId(draftId)
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (!pendingDeleteId) return

    // 关闭对应 Tab
    const draftTabId = createDraftTabId(pendingDeleteId)
    const currentTabs = store.get(tabsAtom)
    const currentActive = store.get(activeTabIdAtom)
    if (currentTabs.some((t) => t.id === draftTabId)) {
      const tabResult = closeTab(currentTabs, currentActive, draftTabId)
      store.set(tabsAtom, tabResult.tabs)
      store.set(activeTabIdAtom, tabResult.activeTabId)
    }

    // 删除草稿
    await deleteDraft(pendingDeleteId)
    setPendingDeleteId(null)
  }

  if (drafts.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[12px] text-foreground/30">
        暂无需求草稿
      </div>
    )
  }

  return (
    <>
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
                  <ContextMenu key={draft.id}>
                    <ContextMenuTrigger asChild>
                      <button
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
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-36">
                      <ContextMenuItem
                        className="text-destructive/80 focus:text-destructive"
                        onClick={() => handleRequestDelete(draft.id)}
                      >
                        <Trash2 size={13} className="mr-2" />
                        删除草稿
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
      >
        <AlertDialogContent
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleConfirmDelete()
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除草稿</AlertDialogTitle>
            <AlertDialogDescription>删除后将无法恢复，确定要删除这个草稿吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
