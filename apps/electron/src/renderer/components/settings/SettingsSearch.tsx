/**
 * SettingsSearch - 设置页全局搜索框
 *
 * 顶部输入框 + 实时下拉结果面板。
 * 选中结果后跳转到对应 tab，并滚动到具体设置项。
 * 快捷键：macOS ⌘K / Windows & Linux Ctrl+K（按平台自动切换）
 */

import { Hash, CornerDownLeft, Search, X } from 'lucide-react'
import * as React from 'react'

import { searchSettings, type SearchResult } from './settingsSearchIndex'

import type { SettingsTab } from '@/atoms/settings-tab'

import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

interface SettingsSearchProps {
  /** 跳转到指定 tab 并高亮设置项 */
  onNavigate: (tab: SettingsTab, itemId?: string) => void
  /** 铺满父容器（用于整行搜索栏） */
  fullWidth?: boolean
}

export function SettingsSearch({ onNavigate, fullWidth }: SettingsSearchProps): React.ReactElement {
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // 平台感知快捷键
  const isMac = React.useMemo(() => detectIsMac(), [])
  const modKeyLabel = isMac ? '⌘' : 'Ctrl'

  const results = React.useMemo(() => searchSettings(query), [query])

  // 焦点离开关闭下拉
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 全局 Cmd/Ctrl+K 快捷键（按平台判定，避免 mac 上误触 Ctrl+K）
  React.useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const modPressed = isMac ? e.metaKey : e.ctrlKey
      if (modPressed && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [open, isMac])

  // 重置 activeIndex
  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleSelect = (result: SearchResult): void => {
    onNavigate(result.tab.tabId, result.item?.id)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const result = results[activeIndex]
      if (result) handleSelect(result)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative', fullWidth ? 'w-full max-w-[280px]' : 'w-[min(100%,280px)]')}
    >
      <div className="settings-search-shell">
        <Search className="settings-search-icon" strokeWidth={2} aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="搜索设置…"
          aria-label="搜索设置"
          className="settings-search-field"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="settings-search-clear"
            aria-label="清空搜索"
          >
            <X size={12} strokeWidth={2} />
          </button>
        ) : (
          <kbd className="settings-search-kbd hidden sm:inline-flex font-sans" aria-hidden>
            <span>{modKeyLabel}</span>
            <span>K</span>
          </kbd>
        )}
      </div>

      {/* 结果下拉面板 */}
      {open && query && (
        <div
          className={cn(
            'settings-search-results session-glass-surface session-glass-popover',
            'absolute top-full left-0 right-0 mt-1.5 z-50',
            'max-h-[min(360px,50vh)] overflow-y-auto',
            'scrollbar-thin'
          )}
        >
          {results.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs md-text-faint">
              没有找到匹配「<span className="md-text font-medium">{query}</span>」的设置项
            </div>
          ) : (
            <div className="p-1">
              {results.slice(0, 30).map((result, idx) => (
                <SearchResultItem
                  key={`${result.tab.tabId}:${result.item?.id ?? ''}:${idx}`}
                  result={result}
                  active={idx === activeIndex}
                  onClick={() => handleSelect(result)}
                  onHover={() => setActiveIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SearchResultItem({
  result,
  active,
  onClick,
  onHover,
}: {
  result: SearchResult
  active: boolean
  onClick: () => void
  onHover: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        'settings-search-result-item w-full flex items-center gap-2 px-2 py-1.5 rounded-glass-popover text-left transition-colors',
        active
          ? 'settings-search-result-item--active'
          : 'md-text hover:bg-[var(--hover-fill,hsl(var(--accent)))]'
      )}
    >
      <Hash size={11} className="md-text-faint shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <div className="text-xs truncate leading-snug">
          {result.item ? (
            <>
              <span className="md-text-faint">{result.tab.tabLabel} / </span>
              <span className="font-medium">{result.item.title}</span>
            </>
          ) : (
            <span className="font-medium">{result.tab.tabLabel}</span>
          )}
        </div>
        {result.item?.description && (
          <div className="text-[11px] md-text-faint truncate mt-0.5 leading-snug">
            {result.item.description}
          </div>
        )}
      </div>
      {active && <CornerDownLeft size={11} className="md-text-faint shrink-0 opacity-70" />}
    </button>
  )
}
