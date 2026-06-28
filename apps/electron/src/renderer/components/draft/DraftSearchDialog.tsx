/**
 * DraftSearchDialog — 草稿搜索面板
 *
 * 纯内存搜索（无 IPC），按标题和上下文文本匹配。
 * 点击结果打开/聚焦草稿 Tab。
 */

import { useAtom, useAtomValue } from 'jotai'
import { StickyNote } from 'lucide-react'
import * as React from 'react'

import type { DraftDocument } from '@tagent/shared'

import { draftsAtom, draftSearchOpenAtom } from '@/atoms/draft-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'
import { STATUS_STYLES, STATUS_LABELS } from './draft-status-styles'

/** 简单的 HTML → 纯文本提取（复用 draft-prompt-builder 的逻辑） */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function matchDraft(draft: DraftDocument, query: string): boolean {
  const q = query.toLowerCase()
  if (draft.title.toLowerCase().includes(q)) return true
  if (stripHtml(draft.context).toLowerCase().includes(q)) return true
  for (const req of draft.requirements) {
    if (req.title.toLowerCase().includes(q)) return true
    if (req.description.toLowerCase().includes(q)) return true
    for (const ac of req.acceptanceCriteria) {
      if (ac.text.toLowerCase().includes(q)) return true
    }
  }
  return false
}

export function DraftSearchDialog(): React.ReactElement {
  const [open, setOpen] = useAtom(draftSearchOpenAtom)
  const drafts = useAtomValue(draftsAtom)
  const openSession = useOpenSession()

  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const inputRef = React.useRef<HTMLInputElement>(null)

  const results = React.useMemo(() => {
    if (!query.trim()) return drafts
    return drafts.filter((d) => matchDraft(d, query))
  }, [drafts, query])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSelect = (draft: DraftDocument): void => {
    openSession('draft', draft.id, draft.title)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex]!)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[15%] translate-y-0 max-w-lg p-0 gap-0">
        <DialogTitle className="sr-only">搜索草稿</DialogTitle>
        <div className="border-b border-border/40 px-4 py-2">
          <SearchInput
            ref={inputRef}
            variant="plain"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索草稿标题或内容..."
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-muted-foreground/40">
              {query.trim() ? '未找到匹配的草稿' : '暂无草稿'}
            </div>
          ) : (
            results.map((draft, i) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => handleSelect(draft)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors text-[13px]',
                  i === selectedIndex
                    ? 'bg-primary/8 text-foreground'
                    : 'text-foreground/60 hover:bg-primary/4'
                )}
              >
                <StickyNote size={13} className="shrink-0 text-foreground/30" />
                <span className="truncate flex-1 min-w-0">{draft.title || '未命名草稿'}</span>
                <span
                  className={cn(
                    'inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium shrink-0',
                    STATUS_STYLES[draft.status]
                  )}
                >
                  {STATUS_LABELS[draft.status]}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
