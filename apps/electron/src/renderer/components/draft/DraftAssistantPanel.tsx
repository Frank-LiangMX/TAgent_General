/**
 * DraftAssistantPanel — AI 助手侧边栏
 *
 * 提供 5 个框架按钮（3 组）和一个简易对话界面。
 * 点击框架按钮时，将草稿全文 + 框架指令拼接为 prompt 发送至 btw 通道。
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  Send,
  Loader2,
  Search,
  Globe,
  ListChecks,
  Pencil,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { BtwMessage } from '@tagent/shared'

import {
  currentDraftAtom,
  currentDraftContextAtom,
  currentDraftRequirementsAtom,
  currentDraftTitleAtom,
} from '@/atoms/draft-atoms'
import {
  btwOpenAtom,
  btwMessagesAtom,
  btwStreamingAtom,
  btwErrorAtom,
  btwChannelIdAtom,
  btwModelIdAtom,
} from '@/atoms/btw-atoms'
import { cn } from '@/lib/utils'

/** 框架按钮定义 */
interface FrameworkDef {
  group: string
  label: string
  icon: React.ReactNode
  instruction: string
}

const FRAMEWORKS: FrameworkDef[] = [
  {
    group: '澄清',
    label: '澄清需求',
    icon: <Search size={15} />,
    instruction:
      '请仔细阅读以下需求草稿，指出其中模糊、矛盾或缺失的地方，用提问的方式引导作者澄清。',
  },
  {
    group: '澄清',
    label: '研究',
    icon: <Globe size={15} />,
    instruction:
      '请根据以下需求草稿，从技术和产品角度进行调研：列出相关技术方案、竞品对比、潜在风险。',
  },
  {
    group: '结构',
    label: '结构化',
    icon: <ListChecks size={15} />,
    instruction:
      '请将以下需求草稿重新组织为更结构化的格式：每个需求块提炼出明确的标题、描述和验收标准。',
  },
  {
    group: '结构',
    label: '润色',
    icon: <Pencil size={15} />,
    instruction: '请对以下需求草稿进行文字润色：改善措辞、消除歧义、统一术语，保持原意不变。',
  },
  {
    group: '检查',
    label: '完整性检查',
    icon: <ShieldCheck size={15} />,
    instruction:
      '请对以下需求草稿进行完整性检查：是否缺少边界条件、异常处理、性能要求、兼容性说明等。',
  },
]

/** 将草稿全文序列化为文本 */
function serializeDraft(title: string, context: string, requirements: string): string {
  const parts: string[] = []
  if (title) parts.push(`# ${title}`)
  if (context) parts.push(`## 背景上下文\n${context}`)
  if (requirements) parts.push(`## 需求列表\n${requirements}`)
  return parts.join('\n\n')
}

export function DraftAssistantPanel(): React.ReactElement {
  const draft = useAtomValue(currentDraftAtom)
  const title = useAtomValue(currentDraftTitleAtom)
  const context = useAtomValue(currentDraftContextAtom)
  const requirements = useAtomValue(currentDraftRequirementsAtom)

  const setOpen = useSetAtom(btwOpenAtom)
  const [messages, setMessages] = useAtom(btwMessagesAtom)
  const setStreaming = useSetAtom(btwStreamingAtom)
  const setError = useSetAtom(btwErrorAtom)
  const channelId = useAtomValue(btwChannelIdAtom)
  const modelId = useAtomValue(btwModelIdAtom)

  const [input, setInput] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // 自动滚到底部
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 挂载时打开 btw 通道
  React.useEffect(() => {
    setOpen(true)
    return () => {
      setOpen(false)
      setMessages([])
    }
  }, [setOpen, setMessages])

  /** 发送框架 prompt */
  const handleFrameworkClick = (fw: FrameworkDef): void => {
    if (!channelId || !modelId) {
      toast.error('请先配置渠道和模型')
      return
    }

    const reqText = JSON.stringify(requirements, null, 2)
    const draftText = serializeDraft(title, context, reqText)
    const prompt = `${fw.instruction}\n\n---\n\n${draftText}`
    sendPrompt(prompt)
  }

  /** 发送自由对话 */
  const handleSend = (): void => {
    const text = input.trim()
    if (!text) return
    sendPrompt(text)
    setInput('')
  }

  /** 通用发送逻辑 */
  const sendPrompt = (text: string): void => {
    if (!channelId || !modelId) {
      toast.error('请先配置渠道和模型')
      return
    }

    // 添加用户消息
    const userMsg: BtwMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])

    // 添加助手占位
    const assistantMsg: BtwMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
    }
    setMessages((prev) => [...prev, assistantMsg])
    setStreaming(true)
    setError(null)

    // 通过 IPC 发送
    window.electronAPI
      .sendBtwMessage({
        channelId,
        modelId,
        message: text,
        messageId: assistantMsg.id,
        sourceSessionId: draft?.id,
      })
      .catch((err: unknown) => {
        console.error('[DraftAssistant] 发送失败:', err)
        const errMsg = err instanceof Error ? err.message : '发送失败'
        setError(errMsg)
        setStreaming(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, streaming: false, content: '发送失败，请重试' } : m
          )
        )
      })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const streaming = useAtomValue(btwStreamingAtom)

  return (
    <div className="flex flex-col h-full">
      {/* 框架按钮区 */}
      <div className="px-4 pt-4 pb-2 shrink-0 border-b border-border/30">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={13} className="text-primary/70" />
          <span className="text-xs font-medium text-foreground/60">AI 助手</span>
        </div>
        <div className="space-y-2.5">
          {['澄清', '结构', '检查'].map((group) => {
            const items = FRAMEWORKS.filter((f) => f.group === group)
            return (
              <div key={group}>
                <p className="text-[10px] text-muted-foreground/50 mb-1 uppercase tracking-wider">
                  {group}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((fw) => (
                    <button
                      key={fw.label}
                      type="button"
                      onClick={() => handleFrameworkClick(fw)}
                      disabled={streaming}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
                        'bg-primary/8 hover:bg-primary/15 text-foreground/70 hover:text-foreground',
                        'border border-border/30 hover:border-border/50',
                        'disabled:opacity-40 disabled:cursor-not-allowed'
                      )}
                    >
                      {fw.icon}
                      {fw.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 消息列表 */}
      <div
        className={cn(
          'selectable-content flex-1 px-4 py-3 space-y-3 min-h-0',
          messages.length === 0 ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin'
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-1.5 text-foreground/40">
            <p className="text-sm">点击上方按钮快速分析</p>
            <p className="text-[11px]">或在下方输入自由提问</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[90%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed break-words',
                  msg.role === 'user'
                    ? 'bg-primary/80 text-primary-foreground rounded-br-md'
                    : 'bg-muted/40 text-foreground rounded-bl-md'
                )}
              >
                {msg.content || (msg.streaming && <Loader2 size={12} className="animate-spin" />)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="p-3 shrink-0 border-t border-border/30">
        <div className="flex items-end gap-2 rounded-xl bg-background/60 border border-border/40 shadow-sm p-1.5 transition-colors focus-within:bg-background/80 focus-within:border-border/60">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题…"
            rows={1}
            className="flex-1 resize-none rounded-lg bg-transparent px-2 py-1.5 text-[13px] leading-relaxed text-foreground placeholder:text-foreground/40 outline-none max-h-24 disabled:opacity-50"
            disabled={streaming}
            onInput={(e) => {
              const target = e.currentTarget
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 96)}px`
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className={cn(
              'h-7 w-7 rounded-full shrink-0 flex items-center justify-center transition-colors',
              input.trim() && !streaming
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted/40 text-foreground/30 cursor-not-allowed'
            )}
            aria-label="发送"
          >
            {streaming ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </div>
      </div>
    </div>
  )
}
