/**
 * DraftListPanel — 侧边栏草稿列表
 *
 * 列出 draftsAtom 中的所有草稿，按状态分组。
 * 交互与会话列表一致：点击选中、右键菜单、三点下拉、双击重命名。
 */

import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { StickyNote, Trash2, MoreHorizontal, Pencil } from 'lucide-react'
import * as React from 'react'

import type { DraftStatus, DraftDocument } from '@tagent/shared'

import { draftsAtom, currentDraftIdAtom, deleteDraftAtom, draftsLoadedAtom, loadDraftsAtom } from '@/atoms/draft-atoms'
import { tabsAtom, activeTabIdAtom, closeTab, createDraftTabId } from '@/atoms/tab-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

function formatDraftTime(updatedAt: number): string {
  const date = new Date(updatedAt)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const pad = (n: number): string => n.toString().padStart(2, '0')
  if (updatedAt >= todayStart) {
    return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  if (updatedAt >= yesterdayStart) {
    return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ---- 单行组件 ----

interface DraftItemProps {
  draft: DraftDocument
  active: boolean
  onSelect: (draft: DraftDocument) => void
  onRequestDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => void
}

const DraftItem = React.memo(function DraftItem({
  draft,
  active,
  onSelect,
  onRequestDelete,
  onRename,
}: DraftItemProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const [menuOpen, setMenuOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)

  const startEdit = (): void => {
    setEditTitle(draft.title)
    setEditing(true)
    justStartedEditing.current = true
    setTimeout(() => {
      justStartedEditing.current = false
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 300)
  }

  const saveTitle = async (): Promise<void> => {
    if (justStartedEditing.current) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === draft.title) {
      setEditing(false)
      return
    }
    await onRename(draft.id, trimmed)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  const menuItems = (
    MenuItem: typeof ContextMenuItem | typeof DropdownMenuItem,
    MenuSeparator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
  ) => (
    <>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={startEdit}>
        <Pencil size={14} />
        重命名
      </MenuItem>
      <MenuSeparator className="my-0.5" />
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5 text-destructive"
        onSelect={() => onRequestDelete(draft.id)}
      >
        <Trash2 size={14} />
        删除草稿
      </MenuItem>
    </>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(draft)}
          onDoubleClick={(e) => {
            e.stopPropagation()
            startEdit()
          }}
          className={cn(
            'group relative w-full flex items-center gap-2 px-3 py-[7px] transition-colors duration-150 titlebar-no-drag text-left',
            active
              ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] rounded-[10px]'
              : 'rounded-md hover:bg-primary/5'
          )}
        >
          <StickyNote
            size={14}
            className={cn('flex-shrink-0', active ? 'text-primary/60' : 'text-foreground/30')}
          />

          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={saveTitle}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent text-[13px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0"
                maxLength={100}
              />
            ) : (
              <div
                className={cn(
                  'truncate text-[13px] leading-5 flex items-center gap-1.5',
                  active ? 'text-foreground' : 'text-foreground/80'
                )}
              >
                <span className="truncate flex-1 min-w-0">{draft.title || '未命名草稿'}</span>
                <span className="flex-shrink-0 text-[10px] text-foreground/35 tabular-nums">
                  {formatDraftTime(draft.updatedAt)}
                </span>
              </div>
            )}
          </div>

          {/* 状态徽章 */}
          {!editing && (
            <span
              className={cn(
                'inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium shrink-0',
                STATUS_STYLES[draft.status]
              )}
            >
              {STATUS_LABELS[draft.status]}
            </span>
          )}

          {/* 三点菜单按钮（hover 时可见） */}
          {!editing && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'p-1 rounded-md text-foreground/30 hover:bg-foreground/[0.08] hover:text-foreground/60 transition-colors',
                      'opacity-0 pointer-events-none',
                      'group-hover:opacity-100 group-hover:pointer-events-auto',
                      'data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto'
                    )}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36 z-[9999] min-w-0 p-0.5">
                  {menuItems(DropdownMenuItem, DropdownMenuSeparator)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36 z-[9999] min-w-0 p-0.5">
        {menuItems(ContextMenuItem, ContextMenuSeparator)}
      </ContextMenuContent>
    </ContextMenu>
  )
})

// ---- 列表面板 ----

export function DraftListPanel(): React.ReactElement {
  const drafts = useAtomValue(draftsAtom)
  const currentDraftId = useAtomValue(currentDraftIdAtom)
  const draftsLoaded = useAtomValue(draftsLoadedAtom)
  const loadDrafts = useSetAtom(loadDraftsAtom)
  const openSession = useOpenSession()
  const deleteDraft = useSetAtom(deleteDraftAtom)
  const store = useStore()

  // 首次挂载时加载草稿列表
  React.useEffect(() => {
    if (!draftsLoaded) void loadDrafts()
  }, [draftsLoaded, loadDrafts])

  const groups = React.useMemo(() => groupByStatus(drafts), [drafts])

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)

  const handleClick = (draft: DraftDocument): void => {
    openSession('draft', draft.id, draft.title)
  }

  const handleRequestDelete = (id: string): void => {
    setPendingDeleteId(id)
  }

  const handleRename = async (id: string, newTitle: string): Promise<void> => {
    const draft = drafts.find((d) => d.id === id)
    if (!draft || newTitle === draft.title) return
    await window.electronAPI.draft.update(id, { title: newTitle })
    // 刷新列表
    const updated = await window.electronAPI.draft.list()
    store.set(draftsAtom, updated)
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
              {items.map((draft) => (
                <DraftItem
                  key={draft.id}
                  draft={draft}
                  active={draft.id === currentDraftId}
                  onSelect={handleClick}
                  onRequestDelete={handleRequestDelete}
                  onRename={handleRename}
                />
              ))}
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
