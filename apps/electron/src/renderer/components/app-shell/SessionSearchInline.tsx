/**
 * SessionSearchInline — 侧栏内联会话搜索（无弹窗）
 *
 * 交互（与产品讨论一致）：
 * - 胶囊 SearchInput（Uiverse plastic-parrot-88 + 主题色 focus），点击即可输入
 * - Enter / 点搜索：提交（≥2 字）；内容搜走 IPC，标题本地滤
 * - 已提交搜索：结果列表覆盖下方会话列表
 * - 清空 / Esc：回到正常会话列表
 * - Agent 搜索：新开会话语义翻历史（次要入口）
 */

import { useAtomValue, useSetAtom, useAtom } from 'jotai'
import { Archive, Bot, Loader2, Search } from 'lucide-react'
import * as React from 'react'

import type { AgentMessageSearchResult } from '@tagent/shared'
import { SearchInput } from '@tagent/ui'
import { activeViewAtom } from '@/atoms/active-view'
import {
  agentSessionsAtom,
  agentWorkspacesAtom,
  agentChannelIdAtom,
  agentPendingPromptAtom,
} from '@/atoms/agent-atoms'
import { navigationSidebarOpenAtom } from '@/atoms/app-mode'
import { sessionSearchFocusTokenAtom } from '@/atoms/search-atoms'
import { useCreateSession } from '@/hooks/useCreateSession'
import { useOpenSession } from '@/hooks/useOpenSession'
import { getActiveAccelerator, getAcceleratorDisplay } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

/** 标题搜索结果 */
interface TitleResult {
  id: string
  title: string
  type: 'agent'
  archived?: boolean
  updatedAt: number
}

/** 内容搜索结果 */
interface ContentResult {
  id: string
  title: string
  type: 'agent'
  messageId: string
  snippet: string
  matchStart: number
  matchLength: number
  archived?: boolean
}

type SearchResult = TitleResult | ContentResult

function isContentResult(result: SearchResult): result is ContentResult {
  return 'snippet' in result
}

function HighlightText({ text, query }: { text: string; query: string }): React.ReactElement {
  if (!query) return <>{text}</>
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let idx = lowerText.indexOf(lowerQuery)
  while (idx !== -1) {
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx))
    parts.push(
      <mark key={idx} className="rounded-sm bg-primary/20 px-0.5 text-foreground">
        {text.slice(idx, idx + query.length)}
      </mark>
    )
    lastIndex = idx + query.length
    idx = lowerText.indexOf(lowerQuery, lastIndex)
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

function HighlightSnippet({
  snippet,
  matchStart,
  matchLength,
}: {
  snippet: string
  matchStart: number
  matchLength: number
}): React.ReactElement {
  if (matchStart < 0 || matchStart >= snippet.length) return <>{snippet}</>
  return (
    <>
      {snippet.slice(0, matchStart)}
      <mark className="rounded-sm bg-primary/20 px-0.5 text-foreground">
        {snippet.slice(matchStart, matchStart + matchLength)}
      </mark>
      {snippet.slice(matchStart + matchLength)}
    </>
  )
}

interface SessionSearchInlineProps {
  /** 未搜索时渲染的会话列表（项目手风琴等） */
  listSlot: React.ReactNode
  /** 归档 footer 等，始终在底部（搜索时也保留） */
  footerSlot?: React.ReactNode
}

export function SessionSearchInline({
  listSlot,
  footerSlot,
}: SessionSearchInlineProps): React.ReactElement {
  const agentSessions = useAtomValue(agentSessionsAtom)
  const agentWorkspaces = useAtomValue(agentWorkspacesAtom)
  const currentAgentChannelId = useAtomValue(agentChannelIdAtom)
  const focusToken = useAtomValue(sessionSearchFocusTokenAtom)
  const setAgentPendingPrompt = useSetAtom(agentPendingPromptAtom)
  const setActiveView = useSetAtom(activeViewAtom)
  const [navOpen, setNavOpen] = useAtom(navigationSidebarOpenAtom)
  const openSession = useOpenSession()
  const { createAgent } = useCreateSession()

  const [query, setQuery] = React.useState('')
  const [committedQuery, setCommittedQuery] = React.useState('')
  const [titleResults, setTitleResults] = React.useState<TitleResult[]>([])
  const [contentResults, setContentResults] = React.useState<ContentResult[]>([])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const isComposingRef = React.useRef(false)
  const searchTokenRef = React.useRef(0)

  const workspaceNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const w of agentWorkspaces) map.set(w.id, w.name)
    return map
  }, [agentWorkspaces])

  const getWorkspaceName = React.useCallback(
    (sessionId: string): string | undefined => {
      const session = agentSessions.find((s) => s.id === sessionId)
      if (!session?.workspaceId) return undefined
      return workspaceNameMap.get(session.workspaceId)
    },
    [agentSessions, workspaceNameMap]
  )

  // 快捷键 focus：展开侧栏 + 聚焦输入
  React.useEffect(() => {
    if (focusToken === 0) return
    if (!navOpen) setNavOpen(true)
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [focusToken, navOpen, setNavOpen])

  const handleClear = React.useCallback(() => {
    setQuery('')
    setCommittedQuery('')
    setTitleResults([])
    setContentResults([])
    setHasSearched(false)
    setSelectedIndex(0)
    searchTokenRef.current += 1
    setLoading(false)
    inputRef.current?.focus()
  }, [])

  const runSearch = React.useCallback(async () => {
    const q = query.trim()
    if (!q || q.length < 2) {
      setTitleResults([])
      setContentResults([])
      setHasSearched(false)
      setCommittedQuery('')
      return
    }

    const token = ++searchTokenRef.current
    setCommittedQuery(q)
    setHasSearched(true)
    setLoading(true)
    setSelectedIndex(0)

    const qLower = q.toLowerCase()
    const titles: TitleResult[] = agentSessions
      .filter((s) => s.title.toLowerCase().includes(qLower))
      .map((s) => ({
        id: s.id,
        title: s.title,
        type: 'agent' as const,
        archived: s.archived,
        updatedAt: s.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)

    setTitleResults(titles)

    try {
      const agentResults = await window.electronAPI.searchAgentSessionMessages(q)
      if (token !== searchTokenRef.current) return

      const titleIds = new Set(titles.map((t) => t.id))
      const agentContent: ContentResult[] = (agentResults as AgentMessageSearchResult[])
        .filter((r) => !titleIds.has(r.sessionId))
        .map((r) => ({
          id: r.sessionId,
          title: r.sessionTitle,
          type: 'agent' as const,
          messageId: r.messageId,
          snippet: r.snippet,
          matchStart: r.matchStart,
          matchLength: r.matchLength,
          archived: r.archived,
        }))

      setContentResults(agentContent)
    } catch (error) {
      console.error('[侧栏搜索] 内容搜索失败:', error)
      if (token === searchTokenRef.current) setContentResults([])
    } finally {
      if (token === searchTokenRef.current) setLoading(false)
    }
  }, [query, agentSessions])

  const handleAgentSearch = React.useCallback(async () => {
    const q = query.trim()
    if (!q) return

    const channelId = currentAgentChannelId ?? undefined
    const configDir = import.meta.env.DEV ? '.tagent-dev' : '.tagent'
    const prompt = `请帮我在 TAgent 的全部会话历史中搜索与以下描述相关的内容：

"${q}"

搜索范围：
- Agent 会话消息文件：~/${configDir}/agent-sessions/ 目录下所有 .jsonl 文件

要求：
1. 理解用户描述的语义，不要求关键词完全匹配，根据内容相关性判断
2. 找到相关会话后，给出会话标题、相关内容摘要，以及文件路径
3. 按相关性排序，最相关的结果排在最前面`

    const session = await createAgent({ channelId })
    if (!session) return
    setAgentPendingPrompt({ sessionId: session.id, message: prompt })
    setActiveView('conversations')
  }, [query, currentAgentChannelId, createAgent, setAgentPendingPrompt, setActiveView])

  const allResults = React.useMemo<SearchResult[]>(
    () => [...titleResults, ...contentResults],
    [titleResults, contentResults]
  )

  const navigateToResult = React.useCallback(
    (result: SearchResult) => {
      setActiveView('conversations')
      const session = agentSessions.find((s) => s.id === result.id)
      openSession('agent', result.id, session?.title ?? result.title)
      // 保留搜索态，便于连续打开多个结果
    },
    [setActiveView, openSession, agentSessions]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (hasSearched || query) {
          handleClear()
        } else {
          inputRef.current?.blur()
        }
        return
      }

      if (e.key === 'Enter') {
        if (isComposingRef.current) return
        e.preventDefault()
        const trimmed = query.trim()
        const isQueryDirty = trimmed !== committedQuery
        if (isQueryDirty || !hasSearched) {
          void runSearch()
        } else if (allResults[selectedIndex]) {
          navigateToResult(allResults[selectedIndex]!)
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(allResults.length - 1, 0)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      }
    },
    [
      hasSearched,
      query,
      handleClear,
      committedQuery,
      runSearch,
      allResults,
      selectedIndex,
      navigateToResult,
    ]
  )

  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.querySelector(`[data-index="${selectedIndex}"]`)
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const trimmedQuery = query.trim()
  const canSearch = trimmedQuery.length >= 2 && !loading
  const isQueryDirty = trimmedQuery !== committedQuery
  const showResults = hasSearched
  const shortcutLabel = getAcceleratorDisplay(getActiveAccelerator('global-search'))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        上留白：floating label 上浮到边框外；
        overflow-visible：左侧粒子可飞出不被裁切
      */}
      <div className="titlebar-no-drag relative z-[2] mx-3 mb-2.5 mt-2.5 shrink-0 overflow-visible">
        <SearchInput
          ref={inputRef}
          variant="capsule"
          value={query}
          loading={loading}
          onChange={(e) => setQuery(e.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
          }}
          onKeyDown={handleKeyDown}
          onClear={handleClear}
          placeholder="搜索会话…"
          aria-label="搜索会话"
          trailing={
            <>
              {canSearch && (isQueryDirty || !hasSearched) ? (
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-primary/80 hover:bg-primary/10"
                  aria-label="执行搜索"
                >
                  搜索
                </button>
              ) : null}
              {!query ? <kbd className="ui-search-kbd">{shortcutLabel}</kbd> : null}
            </>
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {showResults ? (
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {/* 结果 meta */}
            <div className="flex items-center justify-between gap-2 px-1 pb-1.5 pt-0.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-foreground/35">
                {loading
                  ? '搜索中…'
                  : `标题 ${titleResults.length} · 内容 ${contentResults.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleAgentSearch()}
                  disabled={trimmedQuery.length < 2}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    trimmedQuery.length >= 2
                      ? 'text-primary hover:bg-primary/10'
                      : 'cursor-not-allowed text-foreground/25'
                  )}
                  title="语义搜索：新开 Agent 翻历史"
                >
                  <Bot size={11} strokeWidth={1.75} />
                  Agent
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-full px-1.5 py-0.5 text-[10px] text-foreground/40 hover:bg-foreground/[0.05] hover:text-foreground/70"
                >
                  清空
                </button>
              </div>
            </div>

            {loading && allResults.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-foreground/40">
                <Loader2 size={14} className="animate-spin" />
                <span>正在搜索…</span>
              </div>
            )}

            {!loading && allResults.length === 0 && (
              <div className="flex flex-col items-center gap-2.5 px-3 py-10 text-center text-[12px] text-foreground/40">
                <span>未找到匹配结果</span>
                <button
                  type="button"
                  onClick={() => void handleAgentSearch()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/15"
                >
                  <Bot size={12} />
                  试试 Agent 搜索
                </button>
              </div>
            )}

            {titleResults.length > 0 && (
              <div className="pb-1">
                <div className="px-1.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.06em] text-foreground/35">
                  标题匹配
                </div>
                {titleResults.map((result, idx) => (
                  <button
                    key={`title-${result.id}`}
                    type="button"
                    data-index={idx}
                    onClick={() => navigateToResult(result)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'session-list-row flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left titlebar-no-drag',
                      selectedIndex === idx && 'session-list-item-active',
                      result.archived && 'opacity-60'
                    )}
                  >
                    <Search size={13} className="shrink-0 text-primary/70" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/85">
                      <HighlightText text={result.title} query={committedQuery} />
                    </span>
                    {getWorkspaceName(result.id) ? (
                      <span className="max-w-[64px] shrink-0 truncate text-[10px] text-foreground/35">
                        {getWorkspaceName(result.id)}
                      </span>
                    ) : null}
                    {result.archived ? (
                      <Archive size={11} className="shrink-0 text-foreground/30" />
                    ) : null}
                  </button>
                ))}
              </div>
            )}

            {contentResults.length > 0 && (
              <div className="border-t border-border/30 pb-1 pt-1">
                <div className="flex items-center gap-1.5 px-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-foreground/35">
                  <span>消息内容</span>
                  {loading ? <Loader2 size={10} className="animate-spin" /> : null}
                </div>
                {contentResults.map((result, i) => {
                  const globalIdx = titleResults.length + i
                  return (
                    <button
                      key={`content-${result.id}-${result.messageId}`}
                      type="button"
                      data-index={globalIdx}
                      onClick={() => navigateToResult(result)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={cn(
                        'session-list-row flex w-full flex-col gap-0.5 rounded-xl px-2.5 py-1.5 text-left titlebar-no-drag',
                        selectedIndex === globalIdx && 'session-list-item-active',
                        result.archived && 'opacity-60'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Search
                          size={13}
                          className="shrink-0 text-primary/70"
                          strokeWidth={1.75}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/85">
                          {result.title}
                        </span>
                        {result.archived ? (
                          <Archive size={11} className="shrink-0 text-foreground/30" />
                        ) : null}
                      </div>
                      <div className="line-clamp-2 pl-[21px] text-[11px] leading-snug text-foreground/45">
                        <HighlightSnippet
                          snippet={result.snippet}
                          matchStart={result.matchStart}
                          matchLength={result.matchLength}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {allResults.length > 0 && (
              <div className="px-1.5 pb-2 pt-1 text-[10px] text-foreground/30">
                ↵ {isQueryDirty || !hasSearched ? '搜索' : '打开'} · ↑↓ 选择 · Esc 清空
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{listSlot}</div>
        )}
      </div>

      {footerSlot}
    </div>
  )
}
