/**
 * DraftAssistantPanel — AI 助手侧边栏
 *
 * 提供智能分析和对话功能：
 * - 内置迷你模型选择器，用户可切换渠道/模型
 * - 支持自由对话追问
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Send, Loader2, Sparkles, Wand2, MessageCircle, ChevronDown } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { BtwMessage, Channel, ModelOption } from '@tagent/shared'
import { isAgentCompatibleProvider } from '@tagent/shared'

import {
  currentDraftAtom,
  currentDraftContextAtom,
  currentDraftRequirementsAtom,
  currentDraftTitleAtom,
} from '@/atoms/draft-atoms'
import { btwOpenAtom, btwMessagesAtom, btwStreamingAtom, btwErrorAtom } from '@/atoms/btw-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import { Popover, PopoverContent, PopoverTrigger } from '@tagent/ui'
import { getModelLogo, DefaultLogo } from '@/lib/model-logo'
import { cn } from '@/lib/utils'

/** 分析类型 */
type AnalysisType = 'clarify' | 'structure' | 'check'

/** 分析按钮定义 */
const ANALYSIS_ACTIONS: Array<{
  id: AnalysisType
  label: string
  description: string
  icon: React.ReactNode
  instruction: string
}> = [
  {
    id: 'clarify',
    label: '澄清需求',
    description: '找出模糊、矛盾或缺失的地方',
    icon: <Wand2 size={14} />,
    instruction:
      '请仔细阅读以下需求草稿，指出其中模糊、矛盾或缺失的地方，用提问的方式引导作者澄清。',
  },
  {
    id: 'structure',
    label: '结构优化',
    description: '重新组织为更清晰的格式',
    icon: <Sparkles size={14} />,
    instruction:
      '请将以下需求草稿重新组织为更结构化的格式：每个需求块提炼出明确的标题、描述和验收标准。',
  },
  {
    id: 'check',
    label: '完整性检查',
    description: '检查边界条件、异常处理等',
    icon: <MessageCircle size={14} />,
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

/** 判断草稿状态并推荐分析类型 */
function suggestAnalysis(
  context: string,
  requirements: unknown[]
): { type: AnalysisType; reason: string } {
  if (!context.trim() && requirements.length === 0) {
    return { type: 'clarify', reason: '草稿为空，建议先明确需求背景' }
  }
  if (!context.trim()) {
    return { type: 'clarify', reason: '缺少背景上下文，建议补充' }
  }
  if (requirements.length === 0) {
    return { type: 'structure', reason: '建议将需求拆分为具体任务块' }
  }
  if (requirements.length < 3) {
    return { type: 'check', reason: '需求块较少，建议检查是否遗漏' }
  }
  return { type: 'check', reason: '可以进行完整性检查' }
}

/** 从渠道列表构建模型选项（排除 kscc） */
function buildModelOptions(channels: Channel[]): ModelOption[] {
  const options: ModelOption[] = []
  for (const channel of channels) {
    if (!channel.enabled) continue
    // 排除 kscc（使用 CLI，不支持 HTTP API）
    if (channel.provider === 'kscc-internal') continue
    // 只保留 Agent 兼容渠道
    if (!isAgentCompatibleProvider(channel.provider)) continue
    for (const model of channel.models) {
      if (!model.enabled) continue
      options.push({
        channelId: channel.id,
        channelName: channel.name,
        provider: channel.provider,
        modelId: model.id,
        modelName: model.name,
      })
    }
  }
  return options
}

/** 迷你模型选择器 */
function MiniModelSelector({
  channelId,
  modelId,
  channels,
  onSelect,
}: {
  channelId: string | null
  modelId: string | null
  channels: Channel[]
  onSelect: (channelId: string, modelId: string) => void
}): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const modelOptions = React.useMemo(() => buildModelOptions(channels), [channels])

  // 当前选中的模型信息
  const currentModel = React.useMemo(
    () => modelOptions.find((o) => o.channelId === channelId && o.modelId === modelId),
    [modelOptions, channelId, modelId]
  )

  const logoSrc = currentModel
    ? getModelLogo(currentModel.modelId, currentModel.provider)
    : DefaultLogo

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors',
            currentModel
              ? 'bg-primary/10 text-primary hover:bg-primary/15'
              : 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/15'
          )}
        >
          <img src={logoSrc} alt="" className="size-3.5 rounded object-cover" />
          <span className="max-w-[100px] truncate">
            {currentModel ? currentModel.modelName : '选择模型'}
          </span>
          <ChevronDown size={12} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 max-h-64 overflow-y-auto scrollbar-thin">
        {modelOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            暂无可用渠道，请先在设置中配置
          </p>
        ) : (
          <div className="space-y-1">
            {modelOptions.map((opt) => {
              const optLogoSrc = getModelLogo(opt.modelId, opt.provider)
              const isSelected = opt.channelId === channelId && opt.modelId === modelId
              return (
                <button
                  key={`${opt.channelId}-${opt.modelId}`}
                  type="button"
                  onClick={() => {
                    onSelect(opt.channelId, opt.modelId)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                  )}
                >
                  <img src={optLogoSrc} alt="" className="size-3.5 rounded object-cover" />
                  <span className="truncate">{opt.modelName}</span>
                  <span className="text-muted-foreground ml-auto truncate max-w-[60px]">
                    {opt.channelName}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function DraftAssistantPanel(): React.ReactElement {
  const draft = useAtomValue(currentDraftAtom)
  const title = useAtomValue(currentDraftTitleAtom)
  const context = useAtomValue(currentDraftContextAtom)
  const requirements = useAtomValue(currentDraftRequirementsAtom)
  const channels = useAtomValue(channelsAtom)

  // 内置模型选择（不依赖全局 atom）
  const [channelId, setChannelId] = React.useState<string | null>(null)
  const [modelId, setModelId] = React.useState<string | null>(null)

  const setOpen = useSetAtom(btwOpenAtom)
  const [messages, setMessages] = useAtom(btwMessagesAtom)
  const setStreaming = useSetAtom(btwStreamingAtom)
  const setError = useSetAtom(btwErrorAtom)

  const [input, setInput] = React.useState('')
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  // 是否已选择模型
  const isConfigured = !!(channelId && modelId)

  // 推荐分析类型
  const suggestion = React.useMemo(
    () => suggestAnalysis(context, requirements),
    [context, requirements]
  )

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

  /** 发送分析请求 */
  const handleAnalysis = (action: (typeof ANALYSIS_ACTIONS)[number]): void => {
    if (!channelId || !modelId) {
      toast.error('请先选择模型')
      return
    }

    const reqText = JSON.stringify(requirements, null, 2)
    const draftText = serializeDraft(title, context, reqText)
    const prompt = `${action.instruction}\n\n---\n\n${draftText}`
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
      toast.error('请先选择模型')
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
      {/* 顶部：模型选择器 */}
      <div className="px-4 pt-3 pb-2 shrink-0 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-primary/70" />
            <span className="text-xs font-medium text-foreground/60">AI 助手</span>
          </div>
          <MiniModelSelector
            channelId={channelId}
            modelId={modelId}
            channels={channels}
            onSelect={(chId, mId) => {
              setChannelId(chId)
              setModelId(mId)
            }}
          />
        </div>
      </div>

      {/* 分析按钮区 */}
      <div className="px-4 pt-3 pb-3 shrink-0">
        {/* 已配置：显示推荐提示 */}
        {isConfigured && (
          <div className="mb-2.5 px-2.5 py-1.5 rounded-glass-popover bg-primary/5 border border-primary/10">
            <p className="text-[11px] text-primary/80">💡 {suggestion.reason}</p>
          </div>
        )}

        {/* 分析按钮 */}
        <div className="flex flex-wrap gap-1.5">
          {ANALYSIS_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAnalysis(action)}
              disabled={streaming || !isConfigured}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-glass-popover text-[11px] font-medium transition-colors',
                action.id === suggestion.type && isConfigured
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'bg-muted/30 hover:bg-muted/50 text-foreground/70 hover:text-foreground border border-border/30',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
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
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-foreground/40 px-4">
            <p className="text-sm">
              {isConfigured ? '点击上方按钮分析草稿' : '选择模型后即可使用'}
            </p>
            {isConfigured && (
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                AI 会帮你找出需求中的问题，并提供改进建议
              </p>
            )}
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
            placeholder={isConfigured ? '追问或补充…' : '请先选择模型'}
            rows={1}
            className="flex-1 resize-none rounded-glass-popover bg-transparent px-2 py-1.5 text-[13px] leading-relaxed text-foreground placeholder:text-foreground/40 outline-none max-h-24 disabled:opacity-50"
            disabled={streaming || !isConfigured}
            onInput={(e) => {
              const target = e.currentTarget
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 96)}px`
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || streaming || !isConfigured}
            className={cn(
              'h-7 w-7 rounded-full shrink-0 flex items-center justify-center transition-colors',
              input.trim() && !streaming && isConfigured
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
