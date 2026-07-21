/**
 * DraftListPanel — 侧边栏草稿列表
 *
 * 列出 draftsAtom 中的所有草稿，按状态分组。
 * 行布局 / 选中态与会话列表对齐（session-row-shell + session-list-item-active），
 * 避免图标+徽章占满横向导致标题几乎不可见。
 * 交互：点击选中、右键菜单、三点下拉、双击重命名。
 */

import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { Trash2, MoreVertical, Pencil } from 'lucide-react'
import * as React from 'react'

import type { DraftStatus, DraftDocument } from '@tagent/shared'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@tagent/ui'
import { STATUS_LABELS, STATUS_ORDER } from './draft-status-styles'
import { useOpenSession } from '@/hooks/useOpenSession'
import { tabsAtom, activeTabIdAtom, closeTab, createDraftTabId } from '@/atoms/tab-atoms'
import {
  draftsAtom,
  currentDraftIdAtom,
  deleteDraftAtom,
  draftsLoadedAtom,
  loadDraftsAtom,
} from '@/atoms/draft-atoms'
import { cn } from '@/lib/utils'

function groupByStatus(
  drafts: DraftDocument[]
): Array<{ status: DraftStatus; items: DraftDocument[] }> {
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
          data-draft-list-id={draft.id}
          data-actions-open={menuOpen ? '' : undefined}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(draft)}
          onDoubleClick={(e) => {
            e.stopPropagation()
            startEdit()
          }}
          className={cn(
            'session-list-row session-row-shell group relative w-full min-w-0 titlebar-no-drag text-left',
            active ? 'session-list-item-active' : undefined
          )}
        >
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
                  'session-row-actions-pad truncate text-[13px] leading-5 flex items-center gap-1.5 transition-[padding] duration-150 pr-1',
                  'group-hover:pr-4',
                  !active && 'text-foreground/80'
                )}
              >
                <span className={cn('truncate flex-1 min-w-0', active && 'session-row-title')}>
                  {draft.title || '未命名草稿'}
                </span>
                <span
                  className={cn(
                    'flex-shrink-0 text-[9px] tabular-nums',
                    active ? 'session-row-meta' : 'md-text-faint'
                  )}
                >
                  {formatDraftTime(draft.updatedAt)}
                </span>
              </div>
            )}
          </div>

          {/* 三点菜单：绝对定位，不占标题横向空间（与会话行一致） */}
          {!editing && (
            <div
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'p-1 rounded-md text-foreground/30 hover:bg-foreground/[0.08] hover:text-foreground/60 transition-colors',
                      'opacity-0 pointer-events-none',
                      'group-hover:opacity-100 group-hover:pointer-events-auto',
                      'data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto'
                    )}
                  >
                    <MoreVertical size={14} />
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

  const listRef = React.useRef<HTMLDivElement>(null)

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
      <div className="list-well flex-1 min-h-0 titlebar-no-drag">
        <div className="session-scroll scrollbar-thin flex items-center justify-center">
          <p className="px-4 py-6 text-center text-[12px] text-foreground/30">暂无需求草稿</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="list-well flex-1 min-h-0 titlebar-no-drag">
        <div ref={listRef} className="session-scroll scrollbar-thin min-h-0 relative">
          {groups.map(({ status, items }) => (
            <div key={status} className="session-group">
              <div className="group-label">
                <span>{STATUS_LABELS[status]}</span>
              </div>
              <div className="flex flex-col">
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
            <AlertDialogDescription>
              删除后将无法恢复，确定要删除这个草稿吗？
            </AlertDialogDescription>
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
