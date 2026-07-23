/**
 * MessagePartRenderer — 按 MessagePart 类型分派渲染
 *
 * 替代 SDKMessageRenderer 的 800 行 if/else，按 part 类型渲染。
 */

import * as React from 'react'
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Terminal,
  Wrench,
} from 'lucide-react'

import type {
  MessagePart,
  TextPart,
  ThinkingPart,
  ToolCallPart,
  StepGroupPart,
  SystemInfoPart,
  ErrorPart,
  ResultPart,
  ToolCallState,
} from '@/lib/streaming-message-parser'
import { MessageResponse } from '@/components/ai-elements/message'
import { cn } from '@/lib/utils'

// ===== 主分派器 =====

interface MessagePartRendererProps {
  parts: MessagePart[]
  /** 是否处于流式中 */
  isStreaming?: boolean
}

export function MessagePartRenderer({
  parts,
  isStreaming,
}: MessagePartRendererProps): React.ReactElement {
  return (
    <>
      {parts.map((part) => (
        <PartRenderer key={part.id} part={part} isStreaming={isStreaming} />
      ))}
    </>
  )
}

function PartRenderer({
  part,
  isStreaming,
}: {
  part: MessagePart
  isStreaming?: boolean
}): React.ReactElement {
  switch (part.type) {
    case 'text':
      return <TextPartRenderer part={part} />
    case 'thinking':
      return <ThinkingPartRenderer part={part} />
    case 'tool-call':
      return <ToolCallPartRenderer part={part} />
    case 'step-group':
      return <StepGroupPartRenderer part={part} isStreaming={isStreaming} />
    case 'system-info':
      return <SystemInfoPartRenderer part={part} />
    case 'error':
      return <ErrorPartRenderer part={part} />
    case 'result':
      return <ResultPartRenderer part={part} />
    default:
      return <></>
  }
}

// ===== Text Part =====

function TextPartRenderer({ part }: { part: TextPart }): React.ReactElement {
  return (
    <div className={cn('agent-turn-answer', part.isStreaming && 'animate-in fade-in duration-100')}>
      <MessageResponse>{part.text}</MessageResponse>
    </div>
  )
}

// ===== Thinking Part =====

function ThinkingPartRenderer({ part }: { part: ThinkingPart }): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="agent-thinking-body">
      <button
        type="button"
        className="agent-thinking-toggle flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span>{part.isStreaming ? '思考中…' : '思考过程'}</span>
        {part.isStreaming && <Loader2 className="size-3 animate-spin" />}
      </button>
      {expanded && (
        <div className="agent-thinking-content mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap break-words">
          {part.thinking}
        </div>
      )}
    </div>
  )
}

// ===== Tool Call Part（4 态卡片） =====

function ToolCallPartRenderer({ part }: { part: ToolCallPart }): React.ReactElement {
  const stateConfig = TOOL_CALL_STATE_CONFIG[part.state]

  return (
    <div
      className={cn(
        'agent-tool-call-card rounded-lg border p-3 transition-all duration-200',
        stateConfig.borderColor,
        stateConfig.bgColor
      )}
    >
      <div className="flex items-center gap-2">
        {stateConfig.icon}
        <span className="text-sm font-medium">{part.toolName}</span>
        <span
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
            stateConfig.badgeColor
          )}
        >
          {stateConfig.label}
        </span>
      </div>

      {/* 参数预览 */}
      {part.input != null && (
        <div className="mt-2">
          <div className="text-[10px] text-muted-foreground mb-1">参数</div>
          <pre className="text-[11px] bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
            {JSON.stringify(part.input, null, 2)}
          </pre>
        </div>
      )}

      {/* 执行结果 */}
      {part.output != null && (
        <div className="mt-2">
          <div className="text-[10px] text-muted-foreground mb-1">结果</div>
          <pre className="text-[11px] bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
            {typeof part.output === 'string' ? part.output : JSON.stringify(part.output, null, 2)}
          </pre>
        </div>
      )}

      {/* 错误信息 */}
      {part.errorText != null && (
        <div className="mt-2 text-xs text-destructive">{part.errorText}</div>
      )}

      {/* 待确认 */}
      {part.isPendingApproval && (
        <div className="mt-2 flex gap-2">
          <button type="button" className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">
            确认
          </button>
          <button type="button" className="text-xs px-2 py-1 rounded border">
            拒绝
          </button>
        </div>
      )}
    </div>
  )
}

const TOOL_CALL_STATE_CONFIG: Record<
  ToolCallState,
  {
    label: string
    icon: React.ReactElement
    borderColor: string
    bgColor: string
    badgeColor: string
  }
> = {
  'input-streaming': {
    label: '参数生成中',
    icon: <Loader2 className="size-4 animate-spin text-amber-500" />,
    borderColor: 'border-amber-200 dark:border-amber-800',
    bgColor: 'bg-amber-50/50 dark:bg-amber-950/20',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
  'input-available': {
    label: '执行中',
    icon: <Loader2 className="size-4 animate-spin text-blue-500" />,
    borderColor: 'border-blue-200 dark:border-blue-800',
    bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  'output-available': {
    label: '完成',
    icon: <CheckCircle2 className="size-4 text-green-500" />,
    borderColor: 'border-green-200 dark:border-green-800',
    bgColor: 'bg-green-50/50 dark:bg-green-950/20',
    badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  'output-error': {
    label: '失败',
    icon: <AlertCircle className="size-4 text-red-500" />,
    borderColor: 'border-red-200 dark:border-red-800',
    bgColor: 'bg-red-50/50 dark:bg-red-950/20',
    badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
}

// ===== Step Group Part =====

function StepGroupPartRenderer({
  part,
  isStreaming,
}: {
  part: StepGroupPart
  isStreaming?: boolean
}): React.ReactElement {
  // 已完成且非流式 → 默认折叠
  const [expanded, setExpanded] = React.useState(
    part.isActive || (isStreaming && !part.isCompleted)
  )

  // 当 isActive 变化时自动展开/折叠
  React.useEffect(() => {
    if (part.isActive) {
      setExpanded(true)
    } else if (part.isCompleted && !isStreaming) {
      // 延迟折叠，让用户看到完成状态
      const timer = setTimeout(() => setExpanded(false), 800)
      return () => clearTimeout(timer)
    }
  }, [part.isActive, part.isCompleted, isStreaming])

  const completedCount = part.toolCalls.filter(
    (tc) => tc.state === 'output-available' || tc.state === 'output-error'
  ).length

  return (
    <div className="agent-step-group">
      <button
        type="button"
        className="agent-step-group__header flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Wrench className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">
          {part.isActive ? '正在执行' : '已执行'} {part.toolCalls.length} 次工具调用
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {completedCount}/{part.toolCalls.length}
        </span>
      </button>

      {expanded && (
        <div className="agent-step-group__content mt-2 space-y-2">
          {part.toolCalls.map((tc) => (
            <ToolCallPartRenderer key={tc.id} part={tc} />
          ))}
        </div>
      )}
    </div>
  )
}

// ===== System Info Part =====

function SystemInfoPartRenderer({ part }: { part: SystemInfoPart }): React.ReactElement {
  if (part.subtype === 'compaction_boundary') {
    return (
      <div className="agent-compact-boundary flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>上下文压缩点</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    )
  }

  if (part.subtype === 'compacting') {
    return (
      <div className="agent-compacting-indicator flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span>正在压缩上下文…</span>
      </div>
    )
  }

  return <></>
}

// ===== Error Part =====

function ErrorPartRenderer({ part }: { part: ErrorPart }): React.ReactElement {
  return (
    <div className="agent-error-card rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4 text-red-500" />
        <span className="text-sm font-medium text-red-700 dark:text-red-300">执行出错</span>
      </div>
      <div className="mt-1 text-xs text-red-600 dark:text-red-400">{part.message}</div>
    </div>
  )
}

// ===== Result Part =====

function ResultPartRenderer({ part }: { part: ResultPart }): React.ReactElement {
  return (
    <div className="agent-result-card rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Terminal className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium">会话结束 · {part.subtype}</span>
      </div>
      {part.usage && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          输入: {part.usage.inputTokens.toLocaleString()} · 输出:{' '}
          {part.usage.outputTokens.toLocaleString()}
        </div>
      )}
    </div>
  )
}
