/**
 * TabBar — 顶部标签栏
 *
 * 显示所有打开的标签页，支持：
 * - 点击切换标签
 * - 中键关闭标签
 * - 拖拽重排序
 * - preview Tab 拖出 TabBar 转为右侧分屏
 */

import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import * as React from 'react'

import { TabBarItem } from './TabBarItem'

import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import type { TabItem } from '@/atoms/tab-atoms'

import {
  activeTabIdAtom,
  tabIndicatorMapAtom,
  tabSwitchingAtom,
  visualActiveTabIdAtom,
  visibleTabsAtom,
} from '@/atoms/tab-atoms'
import { tearOffPreviewToSplit } from '@/components/diff/preview-opener'
import { useCloseTab } from '@/hooks/useCloseTab'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { useTabSlideIndicator } from '@/hooks/useTabSlideIndicator'
import { detectIsWindows } from '@/lib/platform'
import { cn } from '@/lib/utils'

export function TabBar(): React.ReactElement {
  const tabs = useAtomValue(visibleTabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  const [visualActiveTabId, setVisualActiveTabId] = useAtom(visualActiveTabIdAtom)
  const indicatorMap = useAtomValue(tabIndicatorMapAtom)
  const store = useStore()
  const setTabSwitching = useSetAtom(tabSwitchingAtom)

  const syncSideEffects = useSyncActiveTabSideEffects()
  const { requestClose } = useCloseTab()

  // 延迟激活定时器：点击后等指示器动画（0.35s）结束才切会话，避免动画与渲染竞争主线程
  const switchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    return () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current)
    }
  }, [])

  const dragState = React.useRef<{
    dragging: boolean
    tabId: string
    startX: number
    startIndex: number
  } | null>(null)

  const handleActivate = React.useCallback(
    (tabId: string) => {
      // 1. 同步设视觉激活 tab → 指示器立即开始 0.35s 滑动动画，旧会话内容保持不动
      setVisualActiveTabId(tabId)
      // 2. 清前一次待激活的 timer（快速连点只激活最后一次）
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current)
      const tab = tabs.find((t) => t.id === tabId)
      // 3. 等指示器动画结束（350ms）才切会话 + 开蒙版，动画期间主线程只服务动画
      switchTimerRef.current = setTimeout(() => {
        switchTimerRef.current = null
        setTabSwitching(true)
        setActiveTabId(tabId)
        syncSideEffects(tab ?? null)
      }, 350)
    },
    [setVisualActiveTabId, setActiveTabId, setTabSwitching, syncSideEffects, tabs]
  )

  const handleTearOff = React.useCallback(
    (tabId: string) => {
      tearOffPreviewToSplit(store, tabId)
    },
    [store]
  )

  const handleDragStart = React.useCallback(
    (tabId: string, e: React.PointerEvent) => {
      if (e.button !== 0) return
      const idx = tabs.findIndex((t) => t.id === tabId)
      if (idx === -1) return

      dragState.current = {
        dragging: false,
        tabId,
        startX: e.clientX,
        startIndex: idx,
      }

      const handleMove = (me: PointerEvent): void => {
        if (!dragState.current) return
        const dx = Math.abs(me.clientX - dragState.current.startX)
        if (dx > 5) dragState.current.dragging = true
      }

      const handleUp = (): void => {
        document.removeEventListener('pointermove', handleMove)
        document.removeEventListener('pointerup', handleUp)
        dragState.current = null
      }

      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [tabs]
  )

  if (tabs.length === 0) {
    return <div className="h-[28px] titlebar-drag-region relative z-[10]" />
  }

  return (
    <TabBarInner
      tabs={tabs}
      activeTabId={visualActiveTabId}
      streamingMap={indicatorMap}
      onActivate={handleActivate}
      onClose={requestClose}
      onDragStart={handleDragStart}
      onTearOff={handleTearOff}
    />
  )
}

function TabBarInner({
  tabs,
  activeTabId,
  streamingMap,
  onActivate,
  onClose,
  onDragStart,
  onTearOff,
}: {
  tabs: TabItem[]
  activeTabId: string | null
  streamingMap: Map<string, SessionIndicatorStatus>
  onActivate: (tabId: string) => void
  onClose: (tabId: string) => void
  onDragStart: (tabId: string, e: React.PointerEvent) => void
  onTearOff: (tabId: string) => void
}): React.ReactElement {
  const [hoveredTabId, setHoveredTabId] = React.useState<string | null>(null)
  const [isLeaving, setIsLeaving] = React.useState(false)
  const enterTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const fadeTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const isWindows = React.useMemo(() => detectIsWindows(), [])
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const barRef = React.useRef<HTMLDivElement>(null)
  const [tearingOff, setTearingOff] = React.useState<string | null>(null)

  const { indicatorStyle } = useTabSlideIndicator(scrollRef, activeTabId)

  const handleDragStartWithTearOff = React.useCallback(
    (tabId: string, e: React.PointerEvent) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab || tab.type !== 'preview') {
        onDragStart(tabId, e)
        return
      }

      if (e.button !== 0) return
      const startX = e.clientX
      let torn = false
      let sorting = false
      const TEAR_OFF_MARGIN = 24

      const handleMove = (me: PointerEvent): void => {
        if (torn) return
        const rect = barRef.current?.getBoundingClientRect()
        const outOfBar =
          !!rect &&
          (me.clientY < rect.top - TEAR_OFF_MARGIN || me.clientY > rect.bottom + TEAR_OFF_MARGIN)
        if (outOfBar) {
          torn = true
          setTearingOff(tabId)
          document.removeEventListener('pointermove', handleMove)
          requestAnimationFrame(() => {
            onTearOff(tabId)
            setTearingOff(null)
          })
          return
        }
        const dx = Math.abs(me.clientX - startX)
        if (!sorting && dx > 5) {
          sorting = true
          onDragStart(tabId, e)
        }
      }

      const handleUp = (): void => {
        document.removeEventListener('pointermove', handleMove)
        document.removeEventListener('pointerup', handleUp)
      }

      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [tabs, onDragStart, onTearOff]
  )

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      el.scrollLeft += e.deltaY || e.deltaX
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const prevTabCount = React.useRef(tabs.length)
  React.useEffect(() => {
    if (tabs.length > prevTabCount.current && scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' })
    }
    prevTabCount.current = tabs.length
  }, [tabs.length])

  React.useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  const handleTabHoverEnter = React.useCallback(
    (tabId: string) => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      setIsLeaving(false)

      if (hoveredTabId) {
        setHoveredTabId(tabId)
      } else {
        // 首次进入悬停延迟 600ms，避免鼠标扫过时误触预览
        enterTimerRef.current = setTimeout(() => setHoveredTabId(tabId), 600)
      }
    },
    [hoveredTabId]
  )

  const handleTabHoverLeave = React.useCallback(() => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      setIsLeaving(true)
      fadeTimerRef.current = setTimeout(() => {
        setHoveredTabId(null)
        setIsLeaving(false)
      }, 80)
    }, 200)
  }, [])

  const handlePanelHoverEnter = React.useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setIsLeaving(false)
  }, [])

  return (
    <div
      ref={barRef}
      className="flex items-end h-[28px] tabbar-bg content-shell-chrome-bleed relative shrink-0"
    >
      <div
        className={cn(
          'absolute inset-0 z-[10] titlebar-drag-region pointer-events-none',
          isWindows && 'right-[126px]'
        )}
      />

      {tearingOff && (
        <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-primary/60 shadow-[0_0_8px_rgba(0,0,0,0.2)]" />
      )}

      <div
        ref={scrollRef}
        className={cn(
          'relative z-[2] flex items-end flex-1 min-w-0 overflow-x-auto scrollbar-none',
          isWindows && 'pr-[126px]'
        )}
      >
        {indicatorStyle && (
          <span
            className="absolute rounded-full bg-primary pointer-events-none"
            style={{ ...indicatorStyle, zIndex: 2 }}
            aria-hidden="true"
          />
        )}
        {tabs.map((tab) => (
          <TabBarItem
            key={tab.id}
            id={tab.id}
            type={tab.type}
            title={tab.title}
            isActive={tab.id === activeTabId}
            isStreaming={streamingMap.get(tab.id) ?? 'idle'}
            isHovered={hoveredTabId === tab.id}
            isLeaving={hoveredTabId === tab.id && isLeaving}
            isTearingOff={tearingOff === tab.id}
            onActivate={() => onActivate(tab.id)}
            onClose={() => onClose(tab.id)}
            onMiddleClick={() => onClose(tab.id)}
            onDragStart={(e) => handleDragStartWithTearOff(tab.id, e)}
            onHoverEnter={() => handleTabHoverEnter(tab.id)}
            onHoverLeave={handleTabHoverLeave}
            onPanelHoverEnter={handlePanelHoverEnter}
            onPanelHoverLeave={handleTabHoverLeave}
          />
        ))}
      </div>
    </div>
  )
}
