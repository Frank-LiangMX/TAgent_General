/**
 * TabBarItem — 单个标签页 UI
 *
 * 显示：入口类型 + 标题 + 流式指示器 + 关闭按钮
 * 支持：点击聚焦、中键关闭、拖拽重排
 * hover 预览面板由父级 TabBar 统一管理状态
 */

import { useAtomValue } from 'jotai'
import { ChatsCircle, Monitor, Note } from '@phosphor-icons/react'
import { X } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'

import { TabPreviewPanel } from './TabPreviewPanel'

import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import type { TabType, TabMinimapItem } from '@/atoms/tab-atoms'

import { tabMinimapCacheAtom } from '@/atoms/tab-atoms'
import { cn } from '@/lib/utils'

export interface TabBarItemProps {
  id: string
  type: TabType
  title: string
  isActive: boolean
  isStreaming: SessionIndicatorStatus
  /** 是否显示 hover 预览面板（由父级管理） */
  isHovered: boolean
  /** 预览面板是否正在退出动画 */
  isLeaving: boolean
  /** preview Tab 拖出 TabBar 转分屏时的视觉高亮 */
  isTearingOff?: boolean
  onActivate: () => void
  onClose: () => void
  onMiddleClick: () => void
  onDragStart: (e: React.PointerEvent) => void
  /** hover 进入 Tab */
  onHoverEnter: () => void
  /** hover 离开 Tab */
  onHoverLeave: () => void
  /** hover 进入面板（阻止关闭） */
  onPanelHoverEnter: () => void
  /** hover 离开面板 */
  onPanelHoverLeave: () => void
}

export function TabBarItem({
  id,
  type,
  title,
  isActive,
  isStreaming,
  isHovered,
  isLeaving,
  isTearingOff,
  onActivate,
  onClose,
  onMiddleClick,
  onDragStart,
  onHoverEnter,
  onHoverLeave,
  onPanelHoverEnter,
  onPanelHoverLeave,
}: TabBarItemProps): React.ReactElement {
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [isNarrow, setIsNarrow] = React.useState(false)
  const minimapCache = useAtomValue(tabMinimapCacheAtom)

  React.useEffect(() => {
    const el = buttonRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setIsNarrow(entry.contentRect.width < 52)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (e.button === 1) {
      e.preventDefault()
      onMiddleClick()
    }
  }

  const handleCloseClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onClose()
  }

  const isDraft = type === 'draft'
  const statusLineClass = isDraft
    ? undefined
    : isStreaming !== 'idle'
      ? isStreaming === 'completed'
        ? 'bg-emerald-500'
        : isStreaming === 'blocked'
          ? 'bg-orange-500'
          : 'tab-status-streaming'
      : undefined
  const previewItems = minimapCache.get(id) ?? []
  // 当前 active Tab 不显示预览面板
  const showPreview = isHovered && !isActive
  // P3: chat 已退役

  return (
    <div
      className={cn(
        'app-workspace-tab-shell relative z-[1] h-8 titlebar-no-drag',
        /* 原型标签更紧：max ~128，非 176 宽条 */
        isDraft
          ? 'min-w-[64px] max-w-[100px] flex-[0_1_100px]'
          : 'min-w-[72px] max-w-[128px] flex-[0_1_128px]'
      )}
      data-tab-id={id}
      data-active={isActive || undefined}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        role="tab"
        aria-selected={isActive}
        className={cn(
          'app-workspace-tab relative flex h-8 w-full items-center gap-1.5 pl-2.5 pr-6',
          'select-none cursor-pointer',
          isActive
            ? 'tab-item-selected'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
          isTearingOff && 'ring-2 ring-primary/70 ring-offset-0 bg-primary/10'
        )}
        onClick={onActivate}
        onMouseDown={handleMouseDown}
        onPointerDown={onDragStart}
      >
        <span className="app-workspace-tab__content flex min-w-0 flex-1 items-center gap-1.5 text-left">
          {type === 'agent' && (
            <ChatsCircle className="app-workspace-tab__icon" aria-hidden size={14} weight="regular" />
          )}
          {type === 'preview' && (
            <Monitor className="app-workspace-tab__icon" aria-hidden size={14} weight="regular" />
          )}
          {type === 'draft' && (
            <Note className="app-workspace-tab__icon" aria-hidden size={14} weight="regular" />
          )}
          {!isNarrow && <span className="app-workspace-tab__title">{title}</span>}
        </span>

        {statusLineClass && (
          <span
            className={cn('app-workspace-tab-status absolute rounded-full', statusLineClass)}
            aria-hidden="true"
          />
        )}
      </button>

      <button
        type="button"
        className="app-workspace-tab-close"
        aria-label={`关闭标签页：${title}`}
        tabIndex={isActive ? 0 : -1}
        onClick={handleCloseClick}
      >
        <X aria-hidden />
      </button>

      {/* 悬浮预览面板（Portal 渲染到 body） */}
      {showPreview && (
        <TabPreviewDropdown
          buttonRef={buttonRef}
          title={title}
          items={previewItems}
          isLeaving={isLeaving}
          onMouseEnter={onPanelHoverEnter}
          onMouseLeave={onPanelHoverLeave}
        />
      )}
    </div>
  )
}

/** 使用 Portal 渲染到 body，避免被容器 overflow 裁剪或被内容区遮盖 */
function TabPreviewDropdown({
  buttonRef,
  title,
  items,
  isLeaving,
  onMouseEnter,
  onMouseLeave,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>
  title: string
  items: TabMinimapItem[]
  isLeaving: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}): React.ReactElement | null {
  const panelWidth = 280
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)

  React.useLayoutEffect(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const top = rect.bottom
    let left = rect.left
    if (left + panelWidth > viewportWidth - 8) {
      left = viewportWidth - panelWidth - 8
    }
    if (left < 8) {
      left = 8
    }
    setPos({ top, left })
  }, [buttonRef])

  if (!pos) return null

  return createPortal(
    <div
      className="fixed z-[9999] pt-1"
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <TabPreviewPanel title={title} items={items} isLeaving={isLeaving} />
    </div>,
    document.body
  )
}
