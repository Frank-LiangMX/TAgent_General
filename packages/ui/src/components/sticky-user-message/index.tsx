/**
 * StickyUserMessage — 用户消息悬浮置顶条
 *
 * 当任意用户消息完全滚出 Conversation 视口顶部时，
 * 在顶部显示该消息的精简版悬浮条，点击可回滚到原始消息位置。
 * 必须放在 StickToBottom（Conversation）内部使用。
 */

import { FileText, FileImage, ChevronUp } from 'lucide-react'
import * as React from 'react'
import { useStickToBottomContext } from 'use-stick-to-bottom'

import { MessageResponse } from '../message'
import { remarkMentions } from '../message'
import type { RemarkPluginFn } from '../message'
import { cn } from '../../lib/utils'

/** 悬浮条专用 remark 插件（仅 mention，不保留换行） */
const STICKY_REMARK_PLUGINS: RemarkPluginFn[] = [remarkMentions]

/** 去除 fenced code block，替换为 [code] 占位符 */
function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, ' [code] ')
}

interface StickyAttachment {
  filename: string
  isImage: boolean
}

interface UserMessageData {
  id: string | null
  text: string
  attachments: StickyAttachment[]
}

interface StickyUserMessageProps {
  userMessages: UserMessageData[]
  /** 是否启用悬浮置顶功能 */
  enabled?: boolean
}

export function StickyUserMessage({
  userMessages,
  enabled = true,
}: StickyUserMessageProps): React.ReactElement {
  const { scrollRef, stopScroll, state: stickyState } = useStickToBottomContext()

  const [stickyMessage, setStickyMessage] = React.useState<UserMessageData | null>(null)

  const messageMap = React.useMemo(() => {
    const map = new Map<string, UserMessageData>()
    for (const msg of userMessages) {
      if (msg.id) map.set(msg.id, msg)
    }
    return map
  }, [userMessages])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el || userMessages.length === 0 || !enabled) {
      setStickyMessage(null)
      return
    }

    const check = () => {
      const containerRect = el.getBoundingClientRect()
      const nodes = el.querySelectorAll<HTMLElement>('[data-message-role="user"]')

      let found: UserMessageData | null = null
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i]!
        const nodeRect = node.getBoundingClientRect()
        if (nodeRect.bottom < containerRect.top) {
          const msgId = node.getAttribute('data-message-id')
          if (msgId) {
            found = messageMap.get(msgId) ?? null
          }
          break
        }
      }
      setStickyMessage((prev) => {
        const prevId = prev?.id ?? null
        const foundId = found?.id ?? null
        if (prevId === foundId) return prev
        return found
      })
    }

    let rafId: number | null = null
    const scheduleCheck = (): void => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        check()
      })
    }

    el.addEventListener('scroll', check, { passive: true })

    const resizeObserver = new ResizeObserver(scheduleCheck)
    resizeObserver.observe(el)

    const contentEl = el.firstElementChild as HTMLElement | null
    if (contentEl) {
      resizeObserver.observe(contentEl)
    }

    const initialRafId = requestAnimationFrame(check)

    return () => {
      el.removeEventListener('scroll', check)
      resizeObserver.disconnect()
      cancelAnimationFrame(initialRafId)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [scrollRef, userMessages, messageMap, enabled])

  const scrollToOriginal = React.useCallback(() => {
    const el = scrollRef.current
    if (!el || !stickyMessage?.id) return

    const target = Array.from(el.querySelectorAll<HTMLElement>('[data-message-id]')).find(
      (node) => node.getAttribute('data-message-id') === stickyMessage.id
    )
    if (!target) return

    stopScroll()
    stickyState.animation = undefined
    stickyState.velocity = 0
    stickyState.accumulated = 0

    const containerRect = el.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const targetScrollTop = el.scrollTop + (targetRect.top - containerRect.top)
    el.scrollTo({ top: Math.max(0, targetScrollTop - 24), behavior: 'smooth' })
  }, [scrollRef, stopScroll, stickyState, stickyMessage])

  const isSticky = stickyMessage !== null
  const hasContent = stickyMessage && (stickyMessage.text || stickyMessage.attachments.length > 0)

  if (!enabled) return <></>
  if (!hasContent && !isSticky) return <></>

  return (
    <div
      className={cn(
        'absolute left-0 right-0 top-0 z-20 transition-all duration-150 ease-out',
        isSticky
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 -translate-y-2 pointer-events-none'
      )}
    >
      <div className="mx-8 px-2.5 pt-2 flex justify-center">
        <div
          className="session-glass session-glass-sticky w-full cursor-pointer"
          onClick={scrollToOriginal}
        >
          <div className="px-3.5 py-2.5">
            {stickyMessage?.text && (
              <div className="flex items-start gap-2">
                <ChevronUp
                  className="size-3 text-muted-foreground mt-1.5 shrink-0 cursor-pointer hover:text-foreground/70 transition-colors"
                  onClick={scrollToOriginal}
                />
                <div className="text-xs text-foreground/80 line-clamp-2 leading-relaxed flex-1 min-w-0">
                  <MessageResponse
                    className="prose-p:my-0 prose-p:inline prose-headings:my-0 prose-headings:text-sm prose-pre:hidden prose-ul:my-0 prose-ol:my-0 prose-li:my-0"
                    remarkPlugins={STICKY_REMARK_PLUGINS}
                  >
                    {stripCodeBlocks(stickyMessage.text)}
                  </MessageResponse>
                </div>
              </div>
            )}

            {stickyMessage && stickyMessage.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {stickyMessage.attachments.map((att) => {
                  const Icon = att.isImage ? FileImage : FileText
                  return (
                    <div
                      key={att.filename}
                      className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      <Icon className="size-3 shrink-0" />
                      <span className="truncate max-w-[150px]">{att.filename}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
