/**
 * 虚拟化滚动位置记忆 — 切换对话/会话时保存并恢复滚动位置
 *
 * 适配 react-virtuoso 的滚动容器。
 *
 * 原理：
 * - scroll 事件持续保存 scrollTop 到模块级 Map
 * - 切换对话时 ready=false → 消息列表隐藏
 * - ready=true 时：有保存位置 → scrollTo 恢复；无保存 → scrollToIndex LAST
 */

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'

/** 模块级缓存：对话/会话 ID → scrollTop */
const scrollPositionCache = new Map<string, number>()

interface VirtualizedScrollPositionManagerProps {
  /** 当前会话/对话 ID */
  id: string
  /** 消息列表是否已准备好显示 */
  ready: boolean
  /** virtuoso ref */
  virtuosoRef: React.RefObject<VirtuosoHandle>
}

/**
 * VirtualizedScrollPositionManager — 放在 VirtualizedConversationContent 的父组件内
 *
 * 监听 scroll 事件保存位置，ready 变化时恢复。
 */
export function VirtualizedScrollPositionManager({
  id,
  ready,
  virtuosoRef,
}: VirtualizedScrollPositionManagerProps): null {
  const restoredRef = useRef(false)
  const prevIdRef = useRef(id)

  // id 变化时重置恢复标记
  useEffect(() => {
    if (id !== prevIdRef.current) {
      prevIdRef.current = id
      restoredRef.current = false
    }
  }, [id])

  // ready 后恢复位置
  useLayoutEffect(() => {
    if (!ready || restoredRef.current) return
    restoredRef.current = true

    const savedScrollTop = scrollPositionCache.get(id)
    const v = virtuosoRef.current
    if (!v) return

    if (savedScrollTop != null && savedScrollTop > 5) {
      // 有保存的非底部位置：恢复
      v.scrollTo({ top: savedScrollTop, behavior: 'auto' })
    } else {
      // 无保存位置或在底部：直接跳到底部（无动画）
      v.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' })
    }
  }, [ready, id, virtuosoRef])

  return null
}

/**
 * 保存滚动位置的回调，传给 Virtuoso 的 onScroll
 */
export function createScrollPositionSaver(id: string) {
  return ({ scrollTop }: { scrollTop: number }): void => {
    scrollPositionCache.set(id, scrollTop)
  }
}
