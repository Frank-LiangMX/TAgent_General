/**
 * MessageRenderer — 简化版消息渲染组件
 *
 * 从原有 SDKMessageRenderer 简化而来：
 * - 保留核心 Turn 分组逻辑
 * - 去掉 Jotai atoms 依赖
 * - 使用设计稿 CSS 类名
 *
 * Turn 分组规则：
 * - 用户消息后到下一条用户消息之间的所有 assistant 消息组成一个 turn
 * - user(tool_result) 消息属于当前 turn（不中断分组）
 * - system 消息独立渲染
 */

import * as React from 'react'

import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKSystemMessage,
  SDKContentBlock,
  SDKToolResultBlock,
  SDKToolUseBlock,
  SDKTextBlock,
  SDKThinkingBlock,
} from '@tagent/shared'

// ===== 类型定义 =====

export interface AssistantTurn {
  type: 'assistant-turn'
  /** 当前 turn 内所有 assistant 消息 */
  assistantMessages: SDKAssistantMessage[]
  /** 当前 turn 内所有消息（含 tool_result user 消息，供工具结果查找） */
  turnMessages: SDKMessage[]
  /** 模型名称（取首条 assistant 消息的 model） */
  model?: string
  /** 创建时间（取首条 assistant 消息的时间） */
  createdAt?: number
}

export type MessageGroup =
  | { type: 'user'; message: SDKUserMessage }
  | { type: 'system'; message: SDKSystemMessage }
  | AssistantTurn

// ===== 辅助函数 =====

interface MessageMeta {
  createdAt?: number
}

function extractMeta(message: SDKMessage): MessageMeta {
  const msg = message as Record<string, unknown>
  return {
    createdAt: typeof msg._createdAt === 'number' ? msg._createdAt : undefined,
  }
}

/** 从 user 消息中提取纯文本内容 */
export function extractUserText(message: SDKUserMessage): string | null {
  const content = message.message?.content
  if (!Array.isArray(content)) return null

  const texts: string[] = []
  for (const block of content) {
    if (block.type === 'text' && 'text' in block) {
      texts.push((block as { text: string }).text)
    }
  }

  return texts.length > 0 ? texts.join('\n') : null
}

/** 判断 user 消息是否为真正的人类用户输入（非工具结果/子代理提示） */
function isUserInputMessage(message: SDKUserMessage): boolean {
  if (message.parent_tool_use_id) return false
  // SDK 合成消息（如 Skill 展开 prompt）不是用户输入
  if (message.isSynthetic) return false
  // 包含 tool_result 块的消息是工具结果，不是用户输入
  const content = message.message?.content
  if (Array.isArray(content) && content.some((b) => b.type === 'tool_result')) return false
  return extractUserText(message) !== null
}

// ===== Turn 分组逻辑 =====

/**
 * 将 SDKMessage 列表分组为可渲染的 Turn
 *
 * 规则：
 * 1. user（真正用户输入）→ 单独的 user group
 * 2. assistant + user(tool_result) + assistant... → 合并为一个 assistant-turn
 * 3. system（compact_boundary / compacting / permission_denied）→ 独立渲染，其他归入当前 turn
 * 4. 其他类型（result, tool_progress 等）→ 归入当前 assistant-turn
 * 5. 后处理：合并相邻同模型的 assistant-turn（处理子代理切换模型导致的碎片化）
 */
export function groupIntoTurns(messages: SDKMessage[], sessionModelId?: string): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentTurn: AssistantTurn | null = null

  const flushTurn = (): void => {
    if (currentTurn && currentTurn.assistantMessages.length > 0) {
      groups.push(currentTurn)
    }
    currentTurn = null
  }

  for (const msg of messages) {
    if (msg.type === 'user') {
      const userMsg = msg as SDKUserMessage
      if (isUserInputMessage(userMsg)) {
        // 真正的用户输入 → 结束当前 turn，开始新段落
        flushTurn()
        groups.push({ type: 'user', message: userMsg })
      } else {
        // tool_result 消息 → 归入当前 turn
        if (currentTurn) {
          currentTurn.turnMessages.push(msg)
        }
      }
    } else if (msg.type === 'assistant') {
      const aMsg = msg as SDKAssistantMessage
      // 跳过重放消息
      if (aMsg.isReplay) continue

      if (!currentTurn) {
        // 开始新 turn
        const meta = extractMeta(msg)
        currentTurn = {
          type: 'assistant-turn',
          assistantMessages: [aMsg],
          turnMessages: [msg],
          model: aMsg._channelModelId || aMsg.message?.model || sessionModelId,
          createdAt: meta.createdAt,
        }
      } else {
        // 继续当前 turn
        currentTurn.assistantMessages.push(aMsg)
        currentTurn.turnMessages.push(msg)
      }
    } else if (msg.type === 'system') {
      const sysMsg = msg as SDKSystemMessage
      // 压缩 / 权限拒绝等需在时间线独立占位；init、task_* 等归入当前 turn
      if (isSdkStandaloneSystemMessage(sysMsg)) {
        flushTurn()
        groups.push({ type: 'system', message: sysMsg })
      } else if (currentTurn) {
        currentTurn.turnMessages.push(msg)
      }
    } else {
      // result, tool_progress 等 → 归入当前 turn
      // prompt_suggestion 不属于对话转录，不入 turn
      if ((msg as { type: string }).type === 'prompt_suggestion') {
        continue
      }
      if (currentTurn) {
        currentTurn.turnMessages.push(msg)
      }
    }
  }

  flushTurn()
  return mergeAdjacentSameModelTurns(groups)
}

/**
 * 后处理：合并相邻同模型的 assistant-turn
 */
function mergeAdjacentSameModelTurns(groups: MessageGroup[]): MessageGroup[] {
  if (groups.length <= 1) return groups

  const result: MessageGroup[] = []

  for (const group of groups) {
    if (group.type !== 'assistant-turn') {
      result.push(group)
      continue
    }

    // 向前查找可合并的同模型 assistant-turn
    let mergeTargetIdx = -1
    for (let i = result.length - 1; i >= 0; i--) {
      const prev = result[i]!
      if (prev.type === 'user') break // 真正的用户输入阻断合并
      if (prev.type === 'system' && isSdkStandaloneSystemMessage(prev.message as SDKSystemMessage))
        break
      if (prev.type === 'assistant-turn') {
        if (prev.model === group.model) {
          mergeTargetIdx = i
        }
        break // 遇到第一个 assistant-turn 就停止
      }
    }

    if (mergeTargetIdx >= 0) {
      const target = result[mergeTargetIdx] as AssistantTurn
      target.assistantMessages.push(...group.assistantMessages)
      target.turnMessages.push(...group.turnMessages)
    } else {
      result.push(group)
    }
  }

  return result
}

/** 判断是否为独立 system 消息 */
function isSdkStandaloneSystemMessage(message: SDKSystemMessage): boolean {
  const standaloneSubtypes = ['compact_boundary', 'compacting', 'permission_denied']
  return standaloneSubtypes.includes(message.subtype ?? '')
}

// ===== 工具结果查找 =====

/** 在 allMessages 中查找匹配 toolUseId 的工具结果 */
function findToolResult(toolUseId: string, allMessages: SDKMessage[]): string | undefined {
  for (const msg of allMessages) {
    if (msg.type !== 'user') continue
    const userMsg = msg as SDKUserMessage
    const contentBlocks = userMsg.message?.content
    if (!Array.isArray(contentBlocks)) continue

    for (const block of contentBlocks) {
      if (block.type === 'tool_result') {
        const resultBlock = block as SDKToolResultBlock
        if (resultBlock.tool_use_id === toolUseId) {
          if (typeof resultBlock.content === 'string') {
            return resultBlock.content
          } else if (Array.isArray(resultBlock.content)) {
            return (resultBlock.content as Array<{ type: string; text?: string }>)
              .filter((c) => c.type === 'text' && typeof c.text === 'string')
              .map((c) => c.text)
              .join('\n')
          }
        }
      }
    }
  }
  return undefined
}

// ===== 内容块渲染 =====

interface ContentBlockProps {
  block: SDKContentBlock
  allMessages: SDKMessage[]
  basePath?: string
  isStreaming?: boolean
}

/** 内容块渲染器 */
function ContentBlock({ block, allMessages, basePath, isStreaming }: ContentBlockProps): React.ReactElement | null {
  // text 块
  if (block.type === 'text') {
    const textBlock = block as SDKTextBlock
    if (!textBlock.text) return null
    return (
      <div className="answer-stream">
        <MarkdownContent text={textBlock.text} basePath={basePath} />
      </div>
    )
  }

  // tool_use 块
  if (block.type === 'tool_use') {
    const toolBlock = block as SDKToolUseBlock
    return (
      <ToolUseBlock
        block={toolBlock}
        allMessages={allMessages}
        isStreaming={isStreaming}
      />
    )
  }

  // thinking 块
  if (block.type === 'thinking') {
    const thinkingBlock = block as SDKThinkingBlock
    if (!thinkingBlock.thinking) return null
    return <ThinkingBlock thinking={thinkingBlock.thinking} />
  }

  return null
}

/** Markdown 内容渲染（简化版，后续可接入完整 Markdown 渲染器） */
function MarkdownContent({ text, basePath }: { text: string; basePath?: string }): React.ReactElement {
  // 简化实现：直接渲染文本，后续可接入完整 Markdown 渲染
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {text.split('\n').map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < text.split('\n').length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  )
}

/** 思考块 */
function ThinkingBlock({ thinking }: { thinking: string }): React.ReactElement {
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div className="think-block">
      <div className="think-head">
        <span className="think-badge">思考</span>
      </div>
      {expanded && (
        <div className="think-content">
          {thinking}
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
      >
        {expanded ? '收起' : '展开'}
      </button>
    </div>
  )
}

/** 工具调用块 */
interface ToolUseBlockProps {
  block: SDKToolUseBlock
  allMessages: SDKMessage[]
  isStreaming?: boolean
}

function ToolUseBlock({ block, allMessages, isStreaming }: ToolUseBlockProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const result = findToolResult(block.id, allMessages)
  const isCompleted = result !== undefined

  // 简化的工具名称显示
  const toolName = block.name
  const toolPhrase = getToolPhrase(toolName, block.input)

  return (
    <div className={`tool-row ${isCompleted ? 'is-done' : ''} ${!isCompleted && isStreaming ? 'is-running' : ''}`}>
      <button
        type="button"
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {!isCompleted && isStreaming ? (
          <span className="tool-spinner" />
        ) : (
          <span className="tool-icon">
            <ToolIcon name={toolName} />
          </span>
        )}
        <span className="tool-phrase">
          {isCompleted || !isStreaming ? toolPhrase.label : toolPhrase.loadingLabel}
        </span>
      </button>

      {expanded && result && (
        <div className="mt-2 text-sm text-muted-foreground">
          <pre className="whitespace-pre-wrap break-words text-xs">{result}</pre>
        </div>
      )}
    </div>
  )
}

/** 工具图标（简化版） */
function ToolIcon({ name }: { name: string }): React.ReactElement {
  // 简化实现：返回一个占位符
  return <span className="text-muted-foreground">🔧</span>
}

/** 工具短语生成 */
function getToolPhrase(name: string, input: Record<string, unknown>): { label: string; loadingLabel: string } {
  // 简化实现：根据工具名生成短语
  const phrases: Record<string, string> = {
    Read: '读取文件',
    Write: '写入文件',
    Edit: '编辑文件',
    Bash: '执行命令',
    Glob: '搜索文件',
    Grep: '搜索内容',
    Agent: '启动子代理',
    Task: '执行任务',
  }

  const label = phrases[name] ?? `调用 ${name}`
  return {
    label,
    loadingLabel: `正在${label}...`,
  }
}

// ===== ProcessBlockGroup =====

interface ProcessBlockGroupProps {
  blocks: SDKContentBlock[]
  isStreaming?: boolean
  children: React.ReactNode
}

/** 工具过程组 */
function ProcessBlockGroup({ blocks, isStreaming, children }: ProcessBlockGroupProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(!!isStreaming)

  const toolCount = blocks.filter((b) => b.type === 'tool_use').length
  const thinkingCount = blocks.filter((b) => b.type === 'thinking').length

  const summary = `执行过程：${toolCount} 次工具调用${thinkingCount > 0 ? `，${thinkingCount} 次思考` : ''}`

  return (
    <div className={`process-group ${expanded ? 'is-open' : ''}`}>
      <button
        type="button"
        className="process-summary"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`process-caret ${expanded ? 'rotate-45' : ''}`} />
        <span>{summary}</span>
      </button>

      {expanded && (
        <div className="process-body">
          {children}
        </div>
      )}
    </div>
  )
}

// ===== AssistantTurnRenderer =====

export interface AssistantTurnRendererProps {
  turn: AssistantTurn
  allMessages: SDKMessage[]
  basePath?: string
  isStreaming?: boolean
  streamingText?: string
  streamingThinking?: string
  stoppedByUser?: boolean
}

/** 渲染一个完整的 assistant turn */
export function AssistantTurnRenderer({
  turn,
  allMessages,
  basePath,
  isStreaming,
  streamingText,
  streamingThinking,
  stoppedByUser,
}: AssistantTurnRendererProps): React.ReactElement | null {
  // 收集所有 assistant 消息的内容块
  const enrichedBlocks: SDKContentBlock[] = []
  let hasError = false
  let errorContent: SDKAssistantMessage | null = null

  for (const aMsg of turn.assistantMessages) {
    if (aMsg.error) {
      hasError = true
      errorContent = aMsg
      continue
    }
    const blocks = aMsg.message?.content
    if (Array.isArray(blocks)) {
      enrichedBlocks.push(...blocks)
    }
  }

  // 如果只有错误消息
  if (enrichedBlocks.length === 0 && hasError && errorContent) {
    return (
      <div className="turn">
        <div className="text-destructive">
          {errorContent.error?.message ?? '未知错误'}
        </div>
      </div>
    )
  }

  // 如果没有任何内容
  if (enrichedBlocks.length === 0 && !hasError) return null

  // 流式渲染：更新末尾实时 text/thinking
  const topLevelBlocks = [...enrichedBlocks]
  if (isStreaming && streamingText) {
    // 查找最后一个 text 块并更新
    const lastTextIndex = topLevelBlocks.length - 1 - [...topLevelBlocks].reverse().findIndex((b) => b.type === 'text')
    if (lastTextIndex >= 0 && lastTextIndex < topLevelBlocks.length) {
      topLevelBlocks[lastTextIndex] = { type: 'text', text: streamingText } as SDKTextBlock
    } else {
      topLevelBlocks.push({ type: 'text', text: streamingText } as SDKTextBlock)
    }
  }
  if (isStreaming && streamingThinking) {
    topLevelBlocks.push({ type: 'thinking', thinking: streamingThinking } as SDKThinkingBlock)
  }

  // 检测是否有主要内容（text 块）
  const hasTextContent = topLevelBlocks.some(
    (b) => b.type === 'text' && 'text' in b && !!(b as { text: string }).text
  )

  // 分组：过程块（tool_use, thinking）和答案块（text）
  const processBlocks = topLevelBlocks.filter((b) => b.type === 'tool_use' || b.type === 'thinking')
  const answerBlocks = topLevelBlocks.filter((b) => b.type === 'text')

  return (
    <div className="turn">
      {/* 过程块 */}
      {processBlocks.length > 0 && (
        <ProcessBlockGroup blocks={processBlocks} isStreaming={isStreaming}>
          {processBlocks.map((block, i) => (
            <ContentBlock
              key={i}
              block={block}
              allMessages={allMessages}
              basePath={basePath}
              isStreaming={isStreaming}
            />
          ))}
        </ProcessBlockGroup>
      )}

      {/* 答案块 */}
      {answerBlocks.length > 0 && (
        <div className="answer">
          {answerBlocks.map((block, i) => (
            <ContentBlock
              key={i}
              block={block}
              allMessages={allMessages}
              basePath={basePath}
              isStreaming={isStreaming}
            />
          ))}
        </div>
      )}

      {/* 错误信息 */}
      {hasError && errorContent && (
        <div className="mt-3 text-sm text-destructive">
          {errorContent.error?.message ?? '未知错误'}
        </div>
      )}

      {/* 中断徽章 */}
      {stoppedByUser && (
        <div className="mt-2">
          <span className="running-badge">已被用户中断</span>
        </div>
      )}
    </div>
  )
}

// ===== UserInputMessage =====

interface UserInputMessageProps {
  message: SDKUserMessage
}

/** 用户输入消息 */
function UserInputMessage({ message }: UserInputMessageProps): React.ReactElement {
  const rawText = extractUserText(message) ?? ''
  const { text } = parseAttachedFiles(rawText)
  const meta = extractMeta(message as unknown as SDKMessage)

  return (
    <div className="msg-user">
      {text && <div>{text}</div>}
      {meta.createdAt && (
        <div className="mt-2 text-xs text-muted-foreground">
          {formatTime(meta.createdAt)}
        </div>
      )}
    </div>
  )
}

/** 解析附件 */
function parseAttachedFiles(content: string): { files: never[]; quotes: never[]; text: string } {
  const cleanText = content
    .replace(/<attached_files>[\s\S]*?<\/attached_files>\n*/g, '')
    .replace(/<quoted_file[^>]*>[\s\S]*?<\/quoted_file>\n*/g, '')
    .trim()
  return { files: [], quotes: [], text: cleanText }
}

/** 格式化时间 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// ===== SystemMessage =====

interface SystemMessageProps {
  message: SDKSystemMessage
}

/** System 消息渲染 */
function SystemMessage({ message }: SystemMessageProps): React.ReactElement | null {
  const subtype = message.subtype

  if (subtype === 'compact_boundary') {
    return (
      <div className="flex items-center gap-3 my-4 px-1">
        <div className="flex-1 h-px bg-border/40" />
        <span className="shrink-0 text-[11px] text-muted-foreground/60 px-2 py-0.5 rounded-full border border-border/30 bg-muted/20">
          上下文压缩
        </span>
        <div className="flex-1 h-px bg-border/40" />
      </div>
    )
  }

  if (subtype === 'permission_denied') {
    return (
      <div className="my-3 pl-[46px] pr-1">
        <div className="flex items-start gap-2.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-foreground/80">
          <span className="text-amber-500">⚠️</span>
          <div>
            <span className="font-medium text-foreground">自动审批已拒绝操作</span>
            {typeof message.message === 'string' && (
              <p className="mt-1 text-muted-foreground">{message.message}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ===== MessageGroupRenderer =====

export interface MessageGroupRendererProps {
  group: MessageGroup
  allMessages: SDKMessage[]
  basePath?: string
  isStreaming?: boolean
  streamingText?: string
  streamingThinking?: string
  stoppedByUser?: boolean
  sessionModelId?: string
}

/**
 * WeakMap 缓存：为没有 uuid 的消息生成稳定的 fallback ID
 */
const messageIdCache = new WeakMap<object, string>()
let fallbackIdCounter = 0

/** 从 MessageGroup 中提取稳定的 ID */
export function getGroupId(group: MessageGroup): string {
  if (group.type === 'user') {
    if (group.message.uuid) return group.message.uuid
    const stableKey = (group.message as unknown as Record<string, unknown>)._tagentStableKey
    if (typeof stableKey === 'string') return stableKey
    if (!messageIdCache.has(group.message)) {
      messageIdCache.set(group.message, `user-${++fallbackIdCounter}`)
    }
    return messageIdCache.get(group.message)!
  }
  if (group.type === 'system') {
    if (!messageIdCache.has(group.message)) {
      messageIdCache.set(
        group.message,
        `system-${group.message.subtype ?? 'unknown'}-${++fallbackIdCounter}`
      )
    }
    return messageIdCache.get(group.message)!
  }
  // assistant-turn：取首条 assistant 消息的 uuid
  const first = group.assistantMessages[0]
  if (first?.uuid) return first.uuid
  const stableKey = first
    ? (first as unknown as Record<string, unknown>)._tagentStableKey
    : undefined
  if (typeof stableKey === 'string') return stableKey
  if (first) {
    if (!messageIdCache.has(first)) {
      messageIdCache.set(first, `turn-${++fallbackIdCounter}`)
    }
    return messageIdCache.get(first)!
  }
  return `turn-empty-${++fallbackIdCounter}`
}

/** MessageGroup 渲染器 */
export function MessageGroupRenderer({
  group,
  allMessages,
  basePath,
  isStreaming,
  streamingText,
  streamingThinking,
  stoppedByUser,
  sessionModelId,
}: MessageGroupRendererProps): React.ReactElement | null {
  const groupId = getGroupId(group)

  if (group.type === 'user') {
    return (
      <div data-message-id={groupId} data-message-role="user">
        <UserInputMessage message={group.message} />
      </div>
    )
  }

  if (group.type === 'system') {
    return (
      <div data-message-id={groupId}>
        <SystemMessage message={group.message} />
      </div>
    )
  }

  // assistant-turn
  return (
    <div data-message-id={groupId} data-message-role="assistant">
      <AssistantTurnRenderer
        turn={group}
        allMessages={allMessages}
        basePath={basePath}
        isStreaming={isStreaming}
        streamingText={streamingText}
        streamingThinking={streamingThinking}
        stoppedByUser={stoppedByUser}
      />
    </div>
  )
}

// ===== 导出 =====

export {
  type SDKMessage,
  type SDKAssistantMessage,
  type SDKUserMessage,
  type SDKSystemMessage,
  type SDKContentBlock,
  type SDKToolResultBlock,
  type SDKToolUseBlock,
  type SDKTextBlock,
  type SDKThinkingBlock,
}
