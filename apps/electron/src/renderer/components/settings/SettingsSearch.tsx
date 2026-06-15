/**
 * SettingsSearch - 设置页全局搜索框
 *
 * 顶部输入框 + 实时下拉结果面板。
 * 选中结果后跳转到对应 tab，并滚动到具体设置项。
 * 快捷键：macOS ⌘K / Windows & Linux Ctrl+K（按平台自动切换）
 */

import { Search, Hash, CornerDownLeft, X } from 'lucide-react'
import * as React from 'react'

import type { SettingsTab } from '@/atoms/settings-tab'

import { searchSettings, type SearchResult } from './settingsSearchIndex'

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
    <div ref={containerRef} className={cn('relative w-full', !fullWidth && 'max-w-md')}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="搜索设置项..."
          className={cn(
            'w-full h-8 pl-9 pr-20 text-sm rounded-lg',
            'bg-muted/40 border border-border/60',
            'placeholder:text-muted-foreground/50',
            'focus:outline-none focus:bg-background focus:border-primary/40 focus:ring-1 focus:ring-primary/20',
            'transition-colors',
          )}
        />
        {query ? (
          <button
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={12} />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 h-5 rounded border border-border/60 bg-background text-[10px] text-muted-foreground font-sans">
            <span className="text-[10px]">{modKeyLabel}</span>
            <span>K</span>
          </kbd>
        )}
      </div>

      {/* 结果下拉面板 */}
      {open && query && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-1.5 z-50',
            'rounded-lg border border-border/60 bg-popover shadow-lg',
            'max-h-[60vh] overflow-y-auto',
            'scrollbar-thin',
          )}
        >
          {results.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              没有找到匹配「<span className="font-medium text-foreground">{query}</span>」的设置项
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
        'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/40',
      )}
    >
      <Hash size={12} className="text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">
          {result.item ? (
            <>
              <span className="text-muted-foreground">{result.tab.tabLabel} / </span>
              <span className="font-medium">{result.item.title}</span>
            </>
          ) : (
            <span className="font-medium">{result.tab.tabLabel}</span>
          )}
        </div>
        {result.item?.description && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {result.item.description}
          </div>
        )}
      </div>
      <CornerDownLeft size={12} className="text-muted-foreground shrink-0" />
    </button>
  )
}