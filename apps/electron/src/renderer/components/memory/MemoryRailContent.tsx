/**
 * MemoryRailContent - 记忆页左栏（会话搜索 + 列表）
 *
 * 设计原则：左栏做「会话级入口」，主区做「层级别监控」，避免重复。
 * - 搜索框：调 FTS5 全文搜索 L4 sessions.db
 * - 会话列表：默认显示最近会话，搜索时显示结果
 * - 点击会话：通知主区滚动到 L4 卡片并展开高亮该会话
 *
 * 不重复主区内容：
 * - Reflect 状态 → 主区工具栏
 * - L0-L5 层级导航 → 主区时间线卡片
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { Search, X, History } from 'lucide-react'
import * as React from 'react'

import { topLevelModeAtom } from '@/atoms/app-mode'
import { memorySelectedSessionAtom } from '@/atoms/memory-atoms'
import { cn } from '@/lib/utils'

interface RailSessionItem {
  id: number
  session_slug: string
  title: string
  summary: string
  created_at: number
}

export function MemoryRailContent(): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const mode = topLevelMode === 'ta' ? 'ta' : 'general'
  const selectedSessionId = useAtomValue(memorySelectedSessionAtom)
  const setSelectedSessionId = useSetAtom(memorySelectedSessionAtom)

  const [query, setQuery] = React.useState('')
  const [sessions, setSessions] = React.useState<RailSessionItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [isSearching, setIsSearching] = React.useState(false)

  // 初始加载最近会话
  const loadRecent = React.useCallback(async () => {
    setLoading(true)
    try {
      await window.electronAPI.initMemoryLayers()
      const recent = await window.electronAPI.listRecentMemorySessions(mode, 50)
      setSessions(recent as RailSessionItem[])
    } catch {
      // 静默失败，主区会显示完整错误
    } finally {
      setLoading(false)
    }
  }, [mode])

  // 搜索（防抖 300ms）
  React.useEffect(() => {
    if (!query.trim()) {
      setIsSearching(false)
      loadRecent()
      return
    }
    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const results = await window.electronAPI.searchMemorySessions(mode, query.trim(), 50)
        setSessions(results as RailSessionItem[])
      } catch {
        setSessions([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, mode, loadRecent])

  React.useEffect(() => {
    loadRecent()
  }, [loadRecent])

  const handleSessionClick = React.useCallback(
    (sessionId: number) => {
      // 切换选中：再点一次取消
      setSelectedSessionId(selectedSessionId === sessionId ? null : sessionId)
    },
    [selectedSessionId, setSelectedSessionId]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      {/* 搜索框 */}
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索会话..."
          className="h-8 w-full rounded-xl border border-border/40 bg-background/40 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-border/60 focus:outline-none focus:ring-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* 列表标题 */}
      <div className="flex shrink-0 items-center justify-between px-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {query ? `搜索结果 (${sessions.length})` : '最近会话'}
        </span>
        {isSearching && (
          <span className="text-[10px] text-muted-foreground/60">搜索中…</span>
        )}
      </div>

      {/* 会话列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="px-2 py-4 text-center text-[11px] text-muted-foreground/60">加载中…</div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-center text-[11px] text-muted-foreground/60">
            <History className="size-5 text-muted-foreground/30" />
            <span>{query ? '无匹配会话' : '暂无会话记录'}</span>
            {query && (
              <span className="text-[10px] text-muted-foreground/50">试试更短的关键词</span>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((s) => {
              const isActive = selectedSessionId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSessionClick(s.id)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 rounded-xl px-2.5 py-1.5 text-left transition-colors',
                    isActive ? 'session-list-item-active' : 'hover:bg-muted/40'
                  )}
                >
                  <div className="truncate text-[11px] font-medium text-foreground/90">
                    {s.title || '（无标题）'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                    <span className="shrink-0 tabular-nums">
                      {new Date(s.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {s.summary && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="truncate">{s.summary.slice(0, 50)}</span>
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="shrink-0 border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground/60">
        点击会话 → 主区 L4 高亮
      </div>
    </div>
  )
}
