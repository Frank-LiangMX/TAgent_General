/**
 * DraftView — 需求草稿主容器
 *
 * 挂载时设置 currentDraftIdAtom，布局为：
 * 顶部：标题（可编辑） + AI 助手开关
 * 主体：左侧编辑器 + 需求列表 / 右侧 AI 助手面板
 * 底部：状态栏
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { PencilLine, PanelRightClose, PanelRightOpen } from 'lucide-react'
import * as React from 'react'

import {
  currentDraftIdAtom,
  currentDraftAtom,
  currentDraftTitleAtom,
  loadDraftsAtom,
} from '@/atoms/draft-atoms'
import { cn } from '@/lib/utils'

import { DraftEditor } from './DraftEditor'
import { DraftStatusBar } from './DraftStatusBar'
import { DraftAssistantPanel } from './DraftAssistantPanel'

interface DraftViewProps {
  draftId: string
}

export function DraftView({ draftId }: DraftViewProps): React.ReactElement {
  const setCurrentDraftId = useSetAtom(currentDraftIdAtom)
  const loadDrafts = useSetAtom(loadDraftsAtom)
  const draft = useAtomValue(currentDraftAtom)
  const [title, setTitle] = useAtom(currentDraftTitleAtom)
  const [assistantOpen, setAssistantOpen] = React.useState(false)

  // 挂载时：设置当前草稿 ID + 加载草稿列表
  React.useEffect(() => {
    setCurrentDraftId(draftId)
    void loadDrafts()
    return () => setCurrentDraftId(null)
  }, [draftId, setCurrentDraftId, loadDrafts])

  // 编辑标题状态
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const titleInputRef = React.useRef<HTMLInputElement>(null)

  const startEditTitle = (): void => {
    setEditTitle(title)
    setEditingTitle(true)
    setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 50)
  }

  const saveTitle = (): void => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== title) {
      setTitle(trimmed)
    }
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      setEditingTitle(false)
    }
  }

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        加载草稿中…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部：标题 + AI 助手开关 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={saveTitle}
              className="text-lg font-semibold bg-transparent text-foreground outline-none border-b border-primary/50 flex-1 min-w-0"
              maxLength={100}
            />
          ) : (
            <>
              <h1
                className="text-lg font-semibold text-foreground truncate cursor-pointer hover:text-primary/80 transition-colors"
                onClick={startEditTitle}
                title="点击编辑标题"
              >
                {title || '未命名草稿'}
              </h1>
              <button
                type="button"
                onClick={startEditTitle}
                className="p-1 rounded-md text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.06] transition-colors shrink-0"
                aria-label="编辑标题"
              >
                <PencilLine size={14} />
              </button>
            </>
          )}
        </div>

        {/* AI 助手面板开关 */}
        <button
          type="button"
          onClick={() => setAssistantOpen((prev) => !prev)}
          className={cn(
            'p-2 rounded-md transition-colors shrink-0',
            assistantOpen
              ? 'text-primary bg-primary/10 hover:bg-primary/15'
              : 'text-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.06]'
          )}
          aria-label={assistantOpen ? '关闭 AI 助手' : '打开 AI 助手'}
        >
          {assistantOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>

      {/* 主体：编辑器 + 需求列表 / AI 助手面板 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 左侧：编辑器 + 需求列表 */}
        <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
          <DraftEditor />
        </div>

        {/* 右侧：AI 助手面板（可折叠） */}
        {assistantOpen && (
          <div className="w-[320px] border-l border-border/40 shrink-0 flex flex-col min-h-0 overflow-hidden">
            <DraftAssistantPanel />
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <DraftStatusBar />
    </div>
  )
}
