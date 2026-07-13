/**
 * BtwPanel - 侧面提问面板（右侧边栏版本）
 *
 * 显示 `/btw` 侧面提问的对话界面。
 * 特点：
 * - 不写入主会话历史
 * - 无工具访问（纯文本对话）
 * - 可关闭/折叠
 * - **共享主会话上下文**：从主会话拉最近 20 轮作为 LLM history（Claude Code 原生语义）
 * - **可分叉到新会话**：右上分叉按钮，把 btw Q&A 上下文注入到新 Agent 会话
 * - **右侧边栏布局**：自适应宽度，样式与文件面板统一
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Send, Loader2, MessageCircle, ArrowUpRightFromSquare, X } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { BtwMessage } from '@tagent/shared'

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import {
  btwMessagesAtom,
  btwStreamingAtom,
  btwErrorAtom,
  btwChannelIdAtom,
  btwModelIdAtom,
  btwSourceSessionIdAtom,
} from '@/atoms/btw-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { cn } from '@/lib/utils'

interface BtwPanelProps {
  /** 面板宽度（从 RightSidePanel 传入） */
  width?: number
}

export function BtwPanel({ width }: BtwPanelProps): React.ReactElement {
  const [messages, setMessages] = useAtom(btwMessagesAtom)
  const [streaming, setStreaming] = useAtom(btwStreamingAtom)
  const [error, setError] = useAtom(btwErrorAtom)
  const channelId = useAtomValue(btwChannelIdAtom)
  const modelId = useAtomValue(btwModelIdAtom)
  const sourceSessionId = useAtomValue(btwSourceSessionIdAtom)
  const openSession = useOpenSession()

  const [input, setInput] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // 分叉到新会话
  const handleFork = React.useCallback(async () => {
    if (streaming) {
      toast.warning('请等待当前回复完成')
      return
    }
    if (messages.length === 0) {
      toast.info('没有可分叉的对话')
      return
    }
    if (!channelId || !modelId) {
      toast.error('渠道或模型未配置')
      return
    }
    if (!sourceSessionId) {
      toast.error('缺少父会话 ID')
      return
    }

    try {
      const meta = await window.electronAPI.createAgentSession(
        undefined,
        channelId,
        undefined,
        'general'
      )

      const transcript = messages
        .filter((m) => !m.streaming)
        .map((m) => `**${m.role === 'user' ? 'User' : 'Assistant'}**: ${m.content}`)
        .join('\n\n')

      const forkPrompt = `以下是一次"侧面提问"（/btw）的完整 Q&A，源自会话 \`&session:${sourceSessionId}\`。请基于这个上下文继续回答我接下来的问题。\n\n<by_the_way_transcript>\n${transcript}\n</by_the_way_transcript>\n\n请继续。`

      openSession('agent', meta.id, meta.title)
      setMessages([])

      await window.electronAPI.sendAgentMessage({
        sessionId: meta.id,
        userMessage: forkPrompt,
        channelId,
        modelId,
        mentionedSessionIds: [sourceSessionId],
      })

      toast.success('已分叉到新会话', { description: meta.title })
    } catch (err) {
      console.error('[BtwPanel] 分叉失败:', err)
      toast.error('分叉失败', { description: err instanceof Error ? err.message : '未知错误' })
    }
  }, [streaming, messages, channelId, modelId, sourceSessionId, openSession, setMessages])

  // 发送消息
  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming || !channelId || !modelId) return

    const userMsg: BtwMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setError(null)
    setStreaming(true)

    const assistantMsg: BtwMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      await window.electronAPI.sendBtwMessage({
        channelId,
        modelId,
        message: text,
        messageId: assistantMsg.id,
        sourceSessionId: sourceSessionId ?? undefined,
      })
    } catch (err) {
      console.error('[BtwPanel] 发送失败:', err)
      setError(err instanceof Error ? err.message : '发送失败')
      setStreaming(false)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, streaming: false, content: '发送失败，请重试' } : m
        )
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ width }}>
      {/* Header */}
      <div className="flex items-center justify-between pl-4 pr-3 pt-3 pb-2.5 shrink-0 border-b border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center size-7 rounded-lg bg-foreground/10 text-foreground shrink-0">
            <MessageCircle size={14} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-sm leading-tight text-foreground">旁注</span>
            <span className="text-[11px] text-muted-foreground leading-tight">不进入主对话历史</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className={cn(
          'selectable-content flex-1 px-4 py-3 space-y-3 min-h-0',
          messages.length === 0 ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin'
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-1.5">
            <div className="size-10 rounded-full bg-foreground/10 flex items-center justify-center mb-1">
              <MessageCircle size={18} className="text-muted-foreground" />
            </div>
            <p className="text-sm">输入问题，获得快速回答</p>
            <p className="text-xs text-muted-foreground">回复不会进入主对话历史</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
                  msg.role === 'user'
                    ? 'bg-primary/80 text-primary-foreground rounded-br-md'
                    : 'bg-foreground/10 text-foreground rounded-bl-md'
                )}
              >
                {msg.content || (msg.streaming && <Loader2 size={14} className="animate-spin" />)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg shrink-0">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-3 shrink-0 border-t border-border/30">
        <div className="flex items-end gap-2 rounded-xl bg-background/50 border border-border/50 shadow-sm p-1.5 transition-colors focus-within:bg-background/70 focus-within:border-border/70">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题..."
            rows={1}
            className="flex-1 resize-none rounded-lg bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-h-32"
            disabled={streaming}
            onInput={(e) => {
              const target = e.currentTarget
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 128)}px`
            }}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className={cn(
              'h-8 w-8 rounded-full shrink-0',
              input.trim() && !streaming
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-foreground/10 text-muted-foreground cursor-not-allowed'
            )}
          >
            {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
          {/* 分叉按钮 — 放在输入框右侧，与发送按钮并列 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={handleFork}
                disabled={streaming || messages.length === 0}
                aria-label="分叉到新会话"
              >
                <ArrowUpRightFromSquare size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs">分叉到新会话（继承主会话上下文）</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
