/**
 * ScrollMinimap — 消息导航迷你地图 + 滚动进度条
 *
 * 会话区右上角：
 * 1. 消息刻度条（始终可见，悬浮打开预览列表）
 * 2. 右侧可拖拽滚动 thumb（滚动/悬停时显现）
 *
 * 预览面板：无头像/名称，用户右对齐、助手左对齐气泡。
 * 必须放在 StickToBottom（Conversation）内部使用。
 */

import * as React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStickToBottomContext } from 'use-stick-to-bottom'

import { SearchInput } from '@tagent/ui'
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
/** 每条刻度视觉高度（含间距） */
const BAR_SLOT = 9
const BAR_HEIGHT = 4
const BAR_WIDTH = 10
/** 刻度条圆角（让扁条更圆润） */
const BAR_RADIUS = 2

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

export function ScrollMinimap({ items, onShortcutOpen }: ScrollMinimapProps): React.ReactElement | null {
  // getModelLogo 仍在 Props 中以兼容调用方；预览为纯气泡对齐，不再渲染头像
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
        const id = node.getAttribute('data-message-id')
        if (bottom > scrollTop && top < scrollTop + clientHeight) {
          if (id) ids.add(id)
        }
        if (centerId === undefined && top <= viewportCenter && bottom > viewportCenter) {
          centerId = id ?? undefined
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
      const scrollTarget =
        targetHeight < viewportHeight
          ? offsetTop - (viewportHeight - targetHeight) / 2
          : offsetTop - 32
      el.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' })
      setHovered(false)
    },
    [scrollRef, stopScroll, stickyState]
  )

  const scrollToGroup = React.useCallback(
    (start: number) => {
      const item = items[start]
      if (item) scrollToMessage(item.id)
    },
    [items, scrollToMessage]
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
  const bars = Array.from({ length: barCount }, (_, i) => {
    const start = Math.floor((i * items.length) / barCount)
    const end = Math.floor(((i + 1) * items.length) / barCount)
    const group = items.slice(start, end)
    return {
      index: i,
      start,
      isVisible: group.some((it) => visibleIds.has(it.id)),
      hasUser: group.some((it) => it.role === 'user'),
      hasStatus: group.some((it) => it.role === 'status'),
    }
  })

  const { scrollTop, scrollHeight, clientHeight } = scrollMetrics
  const scrollRange = scrollHeight - clientHeight
  const thumbRatio = scrollHeight > 0 ? Math.min(clientHeight / scrollHeight, 1) : 1
  const thumbHeightPct = Math.max(10, thumbRatio * 100)
  const thumbTopPct = scrollRange > 0 ? (scrollTop / scrollRange) * (100 - thumbHeightPct) : 0
  const thumbVisible = hovered || isDragging || isScrollActive || isColumnHovered

  return (
    <div
      className="absolute right-1 top-0 bottom-0 z-30 flex w-9 justify-end pointer-events-auto"
      onMouseEnter={() => setIsColumnHovered(true)}
      onMouseLeave={() => setIsColumnHovered(false)}
    >
      <div className="flex items-start h-full">
        {/* 悬浮消息预览面板 — 轻量时间线，不是侧栏列表 */}
        {hovered && (
          <div
            className={cn(
              'session-glass-surface session-glass-popover message-nav-popover mr-1.5 w-[300px] origin-top-right flex flex-col overflow-hidden pointer-events-auto',
              isLeaving ? 'message-nav-popover-exit' : 'message-nav-popover-enter'
            )}
            style={{ maxHeight: 'min(460px, 64vh)', marginTop: 10 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="message-nav-popover-header shrink-0 px-3 pt-2.5 pb-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-medium tracking-wide md-text-variant">
                  消息导航
                </span>
                <span className="text-[10px] tabular-nums md-text-faint">
                  {visibleIds.size} / {items.length}
                </span>
              </div>
              <SearchInput
                ref={searchInputRef}
                variant="plain"
                size="sm"
                containerClassName="app-search-shell app-search-shell--compact message-nav-search"
                placeholder="搜索消息…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
                  if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
                  setIsLeaving(false)
                }}
              />
            </div>

            <div
              ref={listRef}
              className="message-nav-popover-list overflow-y-auto flex-1 px-2.5 pb-2.5 pt-0.5 scrollbar-thin"
            >
              {filteredItems.length === 0 ? (
                <div className="py-10 text-center text-[11px] md-text-faint">未找到匹配消息</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredItems.map((item) => {
                    const isAnchor = item.id === anchorId
                    const isInView = visibleIds.has(item.id)
                    const isUser = item.role === 'user'
                    const isStatus = item.role === 'status'
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-minimap-visible={isAnchor ? 'true' : undefined}
                        className={cn(
                          'message-nav-row flex w-full border-0 bg-transparent p-0',
                          isUser ? 'justify-end' : 'justify-start'
                        )}
                        onClick={() => scrollToMessage(item.id)}
                      >
                        <span
                          className={cn(
                            'message-nav-bubble max-w-[88%] px-2.5 py-1.5 text-left transition-[background,box-shadow,filter] duration-150',
                            isUser && 'message-nav-bubble-user',
                            !isUser && !isStatus && 'message-nav-bubble-assistant',
                            isStatus && 'message-nav-bubble-status',
                            isAnchor && 'message-nav-bubble-anchor',
                            !isAnchor && isInView && 'message-nav-bubble-inview'
                          )}
                        >
                          <HighlightedPreview text={item.preview} query={searchQuery} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 右上角消息刻度簇 — 始终清晰可见 */}
        <div
          className="message-nav-bars relative mt-3 flex-shrink-0 pointer-events-auto"
          style={{ width: BAR_WIDTH, height: barCount * BAR_SLOT }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {bars.map((bar) => (
            <button
              key={bar.index}
              type="button"
              aria-label={`跳转到消息组 ${bar.start + 1}`}
              className={cn(
                'message-nav-bar absolute left-0 rounded-full border-0 p-0 cursor-pointer transition-colors duration-150',
                bar.isVisible && 'message-nav-bar-visible',
                bar.hasStatus && !bar.isVisible && 'message-nav-bar-status',
                bar.hasUser && !bar.isVisible && !bar.hasStatus && 'message-nav-bar-user',
                !bar.isVisible && !bar.hasUser && !bar.hasStatus && 'message-nav-bar-assistant'
              )}
              style={{
                top: bar.index * BAR_SLOT + (BAR_SLOT - BAR_HEIGHT) / 2,
                width: BAR_WIDTH,
                height: BAR_HEIGHT,
                borderRadius: BAR_RADIUS,
              }}
              onClick={() => scrollToGroup(bar.start)}
            />
          ))}
        </div>
      </div>

      {/* 滚动 thumb：滚动/悬停时显现 */}
      <div
        className={cn(
          'relative ml-1 py-3 flex-shrink-0 pointer-events-auto transition-opacity duration-200',
          thumbVisible ? 'opacity-100' : 'opacity-0'
        )}
        style={{ width: 6 }}
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
                : thumbVisible
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

function HighlightedPreview({ text, query }: { text: string; query: string }): React.ReactElement {
  if (!text) {
    return <span className="text-[11px] leading-4 md-text-faint">(空消息)</span>
  }

  if (query.trim()) {
    const escaped = escapeRegExp(query)
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    return (
      <span className="text-[11px] leading-4 md-text line-clamp-2">
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-primary/15 text-primary rounded-sm px-0.5">
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
    <div className="prose prose-sm dark:prose-invert max-w-none text-[11px] leading-4 md-text-variant prose-p:my-0 prose-headings:my-0.5 prose-headings:text-[11px] prose-li:my-0 prose-pre:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 line-clamp-2 overflow-hidden">
      <Markdown remarkPlugins={PREVIEW_REMARK_PLUGINS} components={PREVIEW_MD_COMPONENTS}>
        {text}
      </Markdown>
    </div>
  )
}
