/**
 * Conversation - 对话容器原语
 *
 * 提供两套实现：
 * - 基于 use-stick-to-bottom 的旧版（逐步淘汰）
 * - 基于 react-virtuoso 的虚拟化新版（推荐）
 *
 * 包含：
 * - VirtualizedConversationContent — 虚拟化内容区域
 * - VirtualizedConversationScrollButton — 回底按钮（virtuoso 版）
 * - ConversationEmptyState — 空状态（共享）
 * - 旧版 Conversation / ConversationContent / ConversationScrollButton（保留兼容）
 */

import { ArrowDownIcon } from 'lucide-react'
import { useCallback, forwardRef } from 'react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'

import type { ComponentProps, ReactNode } from 'react'

import { Button } from '../button'
import { cn } from '../../lib/utils'

// ===== 旧版：基于 use-stick-to-bottom（逐步淘汰）=====

export type ConversationProps = ComponentProps<typeof StickToBottom>

export function Conversation({ className, ...props }: ConversationProps): React.ReactElement {
  return (
    <StickToBottom
      className={cn('relative flex-1 overflow-y-hidden', className)}
      initial="instant"
      resize="smooth"
      role="log"
      {...props}
    />
  )
}

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>

export function ConversationContent({
  className,
  ...props
}: ConversationContentProps): React.ReactElement {
  return (
    <StickToBottom.Content
      scrollClassName="scrollbar-none"
      className={cn('selectable-content flex flex-col gap-1 py-4 px-8', className)}
      {...props}
    />
  )
}

export type ConversationScrollButtonProps = ComponentProps<typeof Button>

export function ConversationScrollButton({
  className,
  ...props
}: ConversationScrollButtonProps): React.ReactElement | null {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom()
  }, [scrollToBottom])

  if (isAtBottom) return null

  return (
    <Button
      className={cn(
        'conversation-scroll-btn absolute bottom-[26px] left-1/2 z-10 size-9 -translate-x-1/2 rounded-full',
        'border shadow-none',
        className
      )}
      data-conversation-scroll-btn
      onClick={handleScrollToBottom}
      type="button"
      variant="ghost"
      size="icon"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  )
}

// ===== 新版：基于 react-virtuoso =====

export type { VirtuosoHandle }

export interface VirtualizedConversationContentProps<T = unknown> {
  /** 数据项数组 */
  items: T[]
  /** 渲染每个数据项 */
  renderItem: (index: number, item: T) => ReactNode
  /** 生成 item key */
  computeItemKey?: (index: number, item: T) => React.Key
  /** 自定义 className */
  className?: string
  /**
   * 是否自动跟随底部（新消息来了自动滚下去）。
   * 默认只在用户已在底部时跟随，避免打断用户阅读旧消息。
   */
  followOutput?: boolean | 'auto' | 'smooth' | ((isAtBottom: boolean) => boolean | 'smooth')
  /** 预渲染像素数 */
  overscan?: number
  /** 初始顶部对齐索引 */
  initialTopMostItemIndex?: number
  /** ref 获取 VirtuosoHandle — 已废弃，改用 virtuosoRef */
  ref?: never
  /** 获取 VirtuosoHandle 的 ref */
  virtuosoRef?: React.Ref<VirtuosoHandle>
  /** 空状态渲染 */
  emptyComponent?: ReactNode
  /** 底部内容（如加载更多） */
  footer?: ReactNode
  /** 滚动回调 */
  onScroll?: (event: { scrollTop: number }) => void
  /** 到底部状态变化回调 */
  atBottomStateChange?: (isAtBottom: boolean) => void
  /** 滚动容器 ref（供 ScrollMinimap 等外部组件使用） */
  scrollerRef?: React.RefObject<HTMLElement | null>
}

export function VirtualizedConversationContent<T = unknown>({
  items,
  renderItem,
  computeItemKey,
  className,
  followOutput,
  overscan = 200,
  initialTopMostItemIndex,
  virtuosoRef,
  emptyComponent,
  footer,
  onScroll,
  atBottomStateChange,
  scrollerRef,
}: VirtualizedConversationContentProps<T>): React.ReactElement {
  return (
    <Virtuoso
      ref={virtuosoRef}
      data={items}
      itemContent={renderItem}
      computeItemKey={computeItemKey}
      className={cn('selectable-content flex flex-col py-4 px-8', className)}
      followOutput={
        followOutput ?? ((isAtBottom: boolean) => (isAtBottom ? 'smooth' : false))
      }
      overscan={overscan}
      initialTopMostItemIndex={initialTopMostItemIndex}
      onScroll={onScroll as unknown as React.UIEventHandler<HTMLDivElement>}
      atBottomStateChange={atBottomStateChange}
      components={{
        EmptyPlaceholder: emptyComponent
          ? () => <>{emptyComponent}</>
          : undefined,
        Footer: footer ? () => <>{footer}</> : undefined,
        Scroller: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
          (props, forwardedRef) => (
            <div
              ref={(el) => {
                if (typeof forwardedRef === 'function') forwardedRef(el)
                else if (forwardedRef) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ;(forwardedRef as any).current = el
                }
                if (scrollerRef) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ;(scrollerRef as any).current = el
                }
              }}
              {...props}
            />
          )
        ),
      }}
    />
  )
}

export interface VirtualizedConversationScrollButtonProps
  extends ComponentProps<typeof Button> {
  virtuosoRef: React.RefObject<VirtuosoHandle>
  /** 是否可见（由父组件 atBottomStateChange 驱动） */
  visible?: boolean
}

export function VirtualizedConversationScrollButton({
  virtuosoRef,
  visible = false,
  className,
  ...props
}: VirtualizedConversationScrollButtonProps): React.ReactElement | null {
  const handleScrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: 'LAST',
      align: 'end',
      behavior: 'smooth',
    })
  }, [virtuosoRef])

  if (!visible) return null

  return (
    <Button
      className={cn(
        'conversation-scroll-btn absolute bottom-[26px] left-1/2 z-10 size-9 -translate-x-1/2 rounded-full',
        'border shadow-none',
        className
      )}
      data-conversation-scroll-btn
      onClick={handleScrollToBottom}
      type="button"
      variant="ghost"
      size="icon"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  )
}

// ===== 共享组件 =====

export interface ConversationEmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  className?: string
  children?: ReactNode
}

export function ConversationEmptyState({
  className,
  title = '暂无消息',
  description = '在下方输入框开始对话',
  icon,
  children,
}: ConversationEmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex size-full flex-col items-center justify-center gap-3 p-8 text-center',
        className
      )}
    >
      {children ?? (
        <>
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <div className="space-y-1">
            <h3 className="font-medium text-sm">{title}</h3>
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
        </>
      )}
    </div>
  )
}
