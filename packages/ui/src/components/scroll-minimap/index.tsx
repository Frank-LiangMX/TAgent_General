/**
 * ScrollMinimap — 消息导航迷你地图 + 滚动进度条
 *
 * 在消息区域右侧显示：
 * 1. 短横杠代表每条消息的位置（迷你地图），悬浮时弹出消息预览列表
 * 2. 可拖拽的滚动进度条，提供丝滑的滚动体验
 * 必须放在 StickToBottom（Conversation）内部使用。
 */

import { AlertTriangle } from 'lucide-react'
import * as React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStickToBottomContext } from 'use-stick-to-bottom'

import { SearchInput, UserAvatar } from '@tagent/ui'
import { cn } from '../../lib/utils'

export interface MinimapItem {
  id: string
  role: 'user' | 'assistant' | 'status'
  preview: string
  avatar?: string
  model?: string
}

interface ScrollMinimapProps {
  items: MinimapItem[]
  /** 快捷键打开面板的回调（应用层注入） */
  onShortcutOpen?: () => void
  /** 获取模型 logo URL（应用层注入） */
  getModelLogo?: (model: string) => string | null
}

const MIN_ITEMS = 1
const MAX_BARS = 20

const PREVIEW_REMARK_PLUGINS = [remarkGfm]

const PREVIEW_MD_COMPONENTS = {
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="text-[11px] opacity-70 truncate">{children}</pre>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="text-[11px] bg-muted/50 px-0.5 rounded-md">{children}</code>
  ),
  img: () => null as unknown as React.ReactElement,
  a: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
} as const

function getOffsetTopRelativeTo(node: HTMLElement, container: HTMLElement): number {
  let top = 0
  let el: HTMLElement | null = node
  while (el && el !== container) {
    top += el.offsetTop
    el = el.offsetParent as HTMLElement | null
  }
  return top
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function ScrollMinimap({ items, onShortcutOpen, getModelLogo }: ScrollMinimapProps): React.ReactElement | null {
  const { scrollRef, stopScroll, state: stickyState } = useStickToBottomContext()
  const [hovered, setHovered] = React.useState(false)
  const [isLeaving, setIsLeaving] = React.useState(false)
  const [visibleIds, setVisibleIds] = React.useState<Set<string>>(new Set())
  const [centerVisibleId, setCenterVisibleId] = React.useState<string | undefined>(undefined)
  const [canScroll, setCanScroll] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isDragging, setIsDragging] = React.useState(false)
  const [isScrollActive, setIsScrollActive] = React.useState(false)
  const [isColumnHovered, setIsColumnHovered] = React.useState(false)
  const [scrollMetrics, setScrollMetrics] = React.useState({
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 1,
  })

  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const fadeTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const scrollActiveTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (scrollActiveTimerRef.current) clearTimeout(scrollActiveTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const showScrollControls = (): void => {
      setIsScrollActive(true)
      if (scrollActiveTimerRef.current) clearTimeout(scrollActiveTimerRef.current)
      scrollActiveTimerRef.current = setTimeout(() => {
        setIsScrollActive(false)
      }, 900)
    }

    const update = (activate = false): void => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setCanScroll(scrollHeight > clientHeight + 10)
      setScrollMetrics({ scrollTop, scrollHeight, clientHeight })
      if (activate) showScrollControls()
      if (scrollHeight <= 0) return

      const viewportCenter = scrollTop + clientHeight / 2
      const nodes = el.querySelectorAll<HTMLElement>('[data-message-id]')
      const ids = new Set<string>()
      let centerId: string | undefined
      for (const node of nodes) {
        const top = getOffsetTopRelativeTo(node, el)
        const bottom = top + node.offsetHeight
        if (bottom > scrollTop && top < scrollTop + clientHeight) {
          const id = node.getAttribute('data-message-id')
          if (id) ids.add(id)
        }
        if (centerId === undefined && top <= viewportCenter && bottom > viewportCenter) {
          centerId = node.getAttribute('data-message-id') ?? undefined
        }
      }
      setVisibleIds(ids)
      setCenterVisibleId(centerId)
    }

    update()
    setIsScrollActive(false)
    const handleScroll = (): void => update(true)
    el.addEventListener('scroll', handleScroll, { passive: true })
    el.addEventListener('wheel', showScrollControls, { passive: true })
    const observer = new ResizeObserver(() => update())
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', handleScroll)
      el.removeEventListener('wheel', showScrollControls)
      observer.disconnect()
    }
  }, [scrollRef])

  React.useEffect(() => {
    if (hovered && searchInputRef.current) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [hovered])

  React.useEffect(() => {
    if (!hovered) return
    const timer = setTimeout(() => {
      const list = listRef.current
      if (!list) return
      const target = list.querySelector<HTMLElement>('[data-minimap-visible="true"]')
      if (!target) return
      const listRect = list.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const offsetInList = targetRect.top - listRect.top + list.scrollTop
      const offset = offsetInList - (list.clientHeight - target.offsetHeight) / 2
      list.scrollTo({ top: Math.max(0, offset), behavior: 'auto' })
    }, 0)
    return () => clearTimeout(timer)
  }, [hovered])

  React.useEffect(() => {
    if (!hovered) setSearchQuery('')
  }, [hovered])

  const handleShortcutOpen = React.useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
    }
    setIsLeaving(false)
    setHovered(true)
  }, [])

  // 应用层注入快捷键，不再使用 useShortcut
  React.useEffect(() => {
    if (onShortcutOpen && items.length >= MIN_ITEMS && canScroll) {
      const handler = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
          e.preventDefault()
          handleShortcutOpen()
        }
      }
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }
  }, [onShortcutOpen, items.length, canScroll, handleShortcutOpen])

  const OPEN_DELAY = 180

  const handleMouseEnter = (): void => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setIsLeaving(false)
    if (hovered) return
    if (!openTimerRef.current) {
      openTimerRef.current = setTimeout(() => {
        setHovered(true)
        openTimerRef.current = undefined
      }, OPEN_DELAY)
    }
  }

  const handleMouseLeave = (): void => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
    }
    if (!hovered) return
    closeTimerRef.current = setTimeout(() => {
      setIsLeaving(true)
      fadeTimerRef.current = setTimeout(() => {
        setHovered(false)
        setIsLeaving(false)
      }, 80)
    }, 40)
  }

  const scrollToMessage = React.useCallback(
    (id: string) => {
      const el = scrollRef.current
      if (!el) return
      const target = Array.from(el.querySelectorAll<HTMLElement>('[data-message-id]')).find(
        (node) => node.getAttribute('data-message-id') === id
      )
      if (!target) return
      stopScroll()
      stickyState.animation = undefined
      stickyState.velocity = 0
      stickyState.accumulated = 0
      const offsetTop = getOffsetTopRelativeTo(target, el)
      const targetHeight = target.offsetHeight
      const viewportHeight = el.clientHeight
      const scrollTarget = targetHeight < viewportHeight
        ? offsetTop - (viewportHeight - targetHeight) / 2
        : offsetTop - 32
      el.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' })
      setHovered(false)
    },
    [scrollRef, stopScroll, stickyState]
  )

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter((item) => item.preview.toLowerCase().includes(q))
  }, [items, searchQuery])

  const anchorId = React.useMemo(() => {
    if (centerVisibleId && filteredItems.some((item) => item.id === centerVisibleId)) {
      return centerVisibleId
    }
    return filteredItems.find((item) => visibleIds.has(item.id))?.id
  }, [centerVisibleId, filteredItems, visibleIds])

  const handleThumbMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = scrollRef.current
      const track = trackRef.current
      if (!el || !track) return
      stopScroll()
      stickyState.animation = undefined
      stickyState.velocity = 0
      stickyState.accumulated = 0
      setIsDragging(true)
      const startY = e.clientY
      const startScrollTop = el.scrollTop
      const trackHeight = track.clientHeight
      const { scrollHeight, clientHeight } = el
      const scrollRange = scrollHeight - clientHeight
      const thumbHeight = Math.max(trackHeight * 0.1, (clientHeight / scrollHeight) * trackHeight)
      const scrollableTrack = trackHeight - thumbHeight
      const onMouseMove = (ev: MouseEvent): void => {
        ev.preventDefault()
        const delta = ev.clientY - startY
        const scrollDelta = scrollableTrack > 0 ? (delta / scrollableTrack) * scrollRange : 0
        el.scrollTop = Math.max(0, Math.min(scrollRange, startScrollTop + scrollDelta))
      }
      const onMouseUp = (): void => {
        setIsDragging(false)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [scrollRef, stopScroll, stickyState]
  )

  const handleTrackMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return
      const track = trackRef.current
      const el = scrollRef.current
      if (!track || !el) return
      stopScroll()
      stickyState.animation = undefined
      stickyState.velocity = 0
      stickyState.accumulated = 0
      const rect = track.getBoundingClientRect()
      const clickRatio = (e.clientY - rect.top) / rect.height
      const { scrollHeight, clientHeight } = el
      const targetTop = clickRatio * (scrollHeight - clientHeight)
      el.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    },
    [scrollRef, stopScroll, stickyState]
  )

  if (items.length < MIN_ITEMS || !canScroll) return null

  const barCount = Math.min(items.length, MAX_BARS)

  const { scrollTop, scrollHeight, clientHeight } = scrollMetrics
  const scrollRange = scrollHeight - clientHeight
  const thumbRatio = scrollHeight > 0 ? Math.min(clientHeight / scrollHeight, 1) : 1
  const thumbHeightPct = Math.max(10, thumbRatio * 100)
  const thumbTopPct = scrollRange > 0 ? (scrollTop / scrollRange) * (100 - thumbHeightPct) : 0
  const controlsVisible = hovered || isDragging || isScrollActive || isColumnHovered

  return (
    <div
      className="absolute right-1 top-0 bottom-0 z-30 flex w-8 justify-end pointer-events-auto"
      onMouseEnter={() => setIsColumnHovered(true)}
      onMouseLeave={() => setIsColumnHovered(false)}
    >
      <div className="flex items-start h-full">
        {hovered && (
          <div
            className={cn(
              'session-glass-surface session-glass-popover mr-1 w-[280px] origin-top-right flex flex-col overflow-hidden pointer-events-auto',
              isLeaving
                ? 'animate-out fade-out-0 zoom-out-95 duration-75'
                : 'animate-in fade-in-0 zoom-in-95 duration-150'
            )}
            style={{ maxHeight: 'min(420px, 60vh)', marginTop: 12 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
              <span className="text-xs font-medium text-popover-foreground/70">消息导航</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {visibleIds.size}/{items.length}
              </span>
            </div>
            <div className="px-3 py-2 border-b shrink-0">
              <SearchInput
                ref={searchInputRef}
                variant="plain"
                size="sm"
                containerClassName="app-search-shell app-search-shell--compact"
                placeholder="搜索消息..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
                  if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
                  setIsLeaving(false)
                }}
              />
            </div>
            <div ref={listRef} className="overflow-y-auto flex-1 p-2 space-y-1 scrollbar-thin">
              {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">未找到匹配消息</div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-minimap-visible={item.id === anchorId ? 'true' : undefined}
                    className={cn(
                      'flex items-start gap-2 w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent',
                      visibleIds.has(item.id) && 'bg-accent/50'
                    )}
                    onClick={() => scrollToMessage(item.id)}
                  >
                    <ItemIcon item={item} getModelLogo={getModelLogo} />
                    <div className="flex-1 min-w-0">
                      <HighlightedPreview text={item.preview} query={searchQuery} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div
          className="relative mt-3 flex-shrink-0 pointer-events-auto"
          style={{ width: 14, height: barCount * 8 }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {Array.from({ length: barCount }, (_, i) => {
            const start = Math.floor((i * items.length) / barCount)
            const end = Math.floor(((i + 1) * items.length) / barCount)
            const group = items.slice(start, end)
            const isVisible = group.some((it) => visibleIds.has(it.id))
            const hasUser = group.some((it) => it.role === 'user')
            const top = ((i + 0.5) / barCount) * 100
            return (
              <div
                key={i}
                className={cn(
                  'absolute left-0 h-[5px] w-[14px] rounded-md transition-colors',
                  isVisible
                    ? 'bg-primary dark:bg-primary/70 minimap-visible-indicator'
                    : hasUser
                      ? 'bg-primary/30 dark:bg-primary/20'
                      : 'bg-primary/50 dark:bg-primary/35'
                )}
                style={{ top: `${top}%` }}
              />
            )
          })}
        </div>
      </div>

      <div
        className={cn(
          'relative ml-[4px] py-3 flex-shrink-0 pointer-events-auto transition-opacity duration-200',
          controlsVisible ? 'opacity-100' : 'opacity-0'
        )}
        style={{ width: 7 }}
      >
        <div
          ref={trackRef}
          className="relative h-full rounded-full cursor-pointer"
          onMouseDown={handleTrackMouseDown}
        >
          <div
            className={cn(
              'absolute left-0 right-0 rounded-full transition-colors duration-100 scroll-progress-thumb',
              isDragging
                ? 'scroll-progress-thumb-active cursor-grabbing'
                : controlsVisible
                  ? 'scroll-progress-thumb-visible cursor-grab'
                  : 'cursor-grab'
            )}
            style={{
              height: `${thumbHeightPct}%`,
              top: `${thumbTopPct}%`,
            }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
      </div>
    </div>
  )
}

function ItemIcon({ item, getModelLogo }: { item: MinimapItem; getModelLogo?: (model: string) => string | null }): React.ReactElement {
  if (item.role === 'user' && item.avatar) {
    return <UserAvatar avatar={item.avatar} size={16} className="mt-0.5" />
  }
  if (item.role === 'assistant' && item.model) {
    const logoUrl = getModelLogo?.(item.model)
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt=""
          className="size-4 shrink-0 mt-0.5 rounded-[20%] object-cover"
        />
      )
    }
    return <div className="size-4 shrink-0 mt-0.5 rounded-[20%] bg-primary/10" />
  }
  if (item.role === 'status') {
    return <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
  }
  return <div className="size-4 shrink-0 mt-0.5 rounded-[20%] bg-muted" />
}

function HighlightedPreview({ text, query }: { text: string; query: string }): React.ReactElement {
  if (!text) {
    return <span className="text-xs opacity-40">(空消息)</span>
  }

  if (query.trim()) {
    const escaped = escapeRegExp(query)
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    return (
      <span className="text-xs text-popover-foreground/80 line-clamp-3">
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    )
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-popover-foreground/80 prose-p:my-0 prose-headings:my-0.5 prose-headings:text-xs prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 line-clamp-3 overflow-hidden">
      <Markdown remarkPlugins={PREVIEW_REMARK_PLUGINS} components={PREVIEW_MD_COMPONENTS}>
        {text}
      </Markdown>
    </div>
  )
}
