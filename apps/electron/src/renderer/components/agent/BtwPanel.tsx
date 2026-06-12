/**
 * BtwPanel - 侧面提问面板
 *
 * 显示 `/btw` 侧面提问的对话界面。
 * 特点：
 * - 不写入主会话历史
 * - 无工具访问（纯文本对话）
 * - 可关闭/折叠
 * - **共享主会话上下文**：从主会话拉最近 20 轮作为 LLM history（Claude Code 原生语义）
 * - **可分叉到新会话**：右上分叉按钮，把 btw Q&A 上下文注入到新 Agent 会话
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Send, Loader2, MessageCircle, ArrowUpRightFromSquare, ChevronDown } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { BtwMessage } from '@tagent/shared'

import {
  btwOpenAtom,
  btwMessagesAtom,
  btwStreamingAtom,
  btwErrorAtom,
  btwChannelIdAtom,
  btwModelIdAtom,
  btwSourceSessionIdAtom,
} from '@/atoms/btw-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function BtwPanel(): React.ReactElement | null {
  const [open, setOpen] = useAtom(btwOpenAtom)
  const [messages, setMessages] = useAtom(btwMessagesAtom)
  const [streaming, setStreaming] = useAtom(btwStreamingAtom)
  const [error, setError] = useAtom(btwErrorAtom)
  const channelId = useAtomValue(btwChannelIdAtom)
  const modelId = useAtomValue(btwModelIdAtom)
  const sourceSessionId = useAtomValue(btwSourceSessionIdAtom)
  const openSession = useOpenSession()

  const [input, setInput] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const [isClosing, setIsClosing] = React.useState(false)

  // 自动滚动到底部
  React.useEffect(() => {
    if (!open) return
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  // 关闭面板 — 带动画
  const handleClose = () => {
    setIsClosing(true)
    // 等待收缩动画完成后再真正关闭
    setTimeout(() => {
      setOpen(false)
      setIsClosing(false)
    }, 280) // 与 btw-panel-collapse 动画时长一致
  }

  // 分叉到新会话：把当前 btw Q&A 作为新 Agent 会话的第一组消息
  // 父会话的 20 轮上下文由新会话通过 mentionedSessionIds 自动继承
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
      // 1. 创建新 Agent 会话
      const meta = await window.electronAPI.createAgentSession(
        undefined, channelId, undefined, 'general',
      )

      // 2. 拼装分叉 prompt：把 btw Q&A 作为新会话的 initial user 消息
      //    mention 父会话 ID，agent-orchestrator 会自动注入父会话 20 轮摘要
      const transcript = messages
        .filter((m) => !m.streaming)
        .map((m) => `**${m.role === 'user' ? 'User' : 'Assistant'}**: ${m.content}`)
        .join('\n\n')

      const forkPrompt = `以下是一次"侧面提问"（/btw）的完整 Q&A，源自会话 \`&session:${sourceSessionId}\`。请基于这个上下文继续回答我接下来的问题。\n\n<by_the_way_transcript>\n${transcript}\n</by_the_way_transcript>\n\n请继续。`

      // 3. 切到新会话
      openSession('agent', meta.id, meta.title)
      setOpen(false)
      setMessages([])

      // 4. 发送分叉 prompt
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
  }, [streaming, messages, channelId, modelId, sourceSessionId, openSession, setOpen, setMessages])

  // 不显示条件：open=false 直接返回 null（必须在所有 Hook 调用之后）
  if (!open && !isClosing) return null

  // 发送消息
  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming || !channelId || !modelId) return

    // 添加用户消息
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

    // 添加助手消息占位
    const assistantMsg: BtwMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      // 发送到后端（带 sourceSessionId 让主进程拉主会话 20 轮上下文）
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

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={cn(
        'btw-panel-glass',
        'absolute w-[360px] max-h-[min(70vh,520px)] flex flex-col overflow-hidden z-50',
        'bottom-full right-0 mb-2',
        isClosing ? 'btw-panel-exit' : 'btw-panel-enter'
      )}
    >
        {/* Header */}
        <div className="flex items-center justify-between pl-4 pr-3 pt-3 pb-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center size-7 rounded-lg bg-white/20 dark:bg-white/10 text-foreground shrink-0">
              <MessageCircle size={14} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-sm leading-tight text-foreground/90">侧面提问</span>
              <span className="text-[11px] text-foreground/50 leading-tight">不进入主对话历史</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* 关闭按钮 — 向下箭头，点击收缩关闭 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7 rounded-lg text-foreground/50 hover:text-foreground',
                    'hover:bg-white/20 dark:hover:bg-white/10',
                    'transition-all duration-200',
                    'group'
                  )}
                  onClick={handleClose}
                  aria-label="关闭面板"
                >
                  <ChevronDown
                    size={16}
                    className="transition-transform duration-200 group-hover:translate-y-0.5"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">关闭</p>
              </TooltipContent>
            </Tooltip>
            {/* 分叉按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-foreground/60 hover:text-foreground hover:bg-white/20 dark:hover:bg-white/10"
                  onClick={handleFork}
                  disabled={streaming || messages.length === 0}
                  aria-label="分叉到新会话"
                >
                  <ArrowUpRightFromSquare size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs">分叉到新会话（继承主会话上下文）</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Messages — 有内容时才显示滚动条 */}
        <div
          className={cn(
            'flex-1 px-4 py-3 space-y-3 min-h-0',
            messages.length === 0 ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin'
          )}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-foreground/50 gap-1.5">
              <div className="size-10 rounded-full bg-white/20 dark:bg-white/10 flex items-center justify-center mb-1">
                <MessageCircle size={18} className="text-foreground/40" />
              </div>
              <p className="text-sm">输入问题，获得快速回答</p>
              <p className="text-xs text-foreground/40">回复不会进入主对话历史</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
                    msg.role === 'user'
                      ? 'bg-primary/80 text-primary-foreground rounded-br-md'
                      : 'bg-white/30 dark:bg-white/15 text-foreground rounded-bl-md'
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
          <div className="mx-4 mb-2 px-3 py-2 text-xs text-destructive bg-destructive/20 border border-destructive/30 rounded-lg shrink-0">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="p-3 shrink-0">
          <div className="btw-input-glass flex items-end gap-2 rounded-xl bg-background/35 dark:bg-background/25 backdrop-blur-sm border border-border/50 shadow-sm p-1.5 transition-colors focus-within:bg-background/45 dark:focus-within:bg-background/34 focus-within:border-border/70">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题..."
              rows={1}
              className="flex-1 resize-none rounded-lg bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground placeholder:text-foreground/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-h-32"
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
                  : 'bg-white/30 dark:bg-white/15 text-foreground/40 cursor-not-allowed'
              )}
            >
              {streaming ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </Button>
          </div>
        </div>
    </div>
  )
}
