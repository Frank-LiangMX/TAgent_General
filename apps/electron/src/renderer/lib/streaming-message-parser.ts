/**
 * Streaming Message Parser — 流式消息状态机
 *
 * 将 SDKMessage[] 解析为 MessagePart[]，按 part 类型分派渲染。
 * 纯函数，无副作用，可独立测试。
 *
 * 核心设计：
 * - 每个 MessagePart 是渲染的最小单元，有唯一 id 和明确类型
 * - ToolCallPart 有 4 态生命周期：input-streaming → input-available → output-available → output-error
 * - 连续的 tool_use 被分组为 StepGroupPart，当前 step 展开、已完成 step 折叠
 * - 支持流式增量更新（liveMessages 与 persistedMessages 合并）
 */

import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKContentBlock,
  SDKToolUseBlock,
  SDKToolResultBlock,
  SDKSystemMessage,
  SDKResultMessage,
} from '@tagent/shared'

// ===== MessagePart 联合类型 =====

export type MessagePart =
  | TextPart
  | ThinkingPart
  | ToolCallPart
  | StepGroupPart
  | SystemInfoPart
  | ErrorPart
  | ResultPart

/** 纯文本 */
export interface TextPart {
  type: 'text'
  id: string
  text: string
  /** 流式中：文本还在生成 */
  isStreaming?: boolean
}

/** 思考/推理块 */
export interface ThinkingPart {
  type: 'thinking'
  id: string
  thinking: string
  /** 流式中：思考还在生成 */
  isStreaming?: boolean
}

/** 工具调用 — 4 态模型 */
export interface ToolCallPart {
  type: 'tool-call'
  id: string
  /** tool_use.id */
  toolUseId: string
  /** 工具名称 */
  toolName: string
  /** 4 态生命周期 */
  state: ToolCallState
  /** 工具参数（input-available / output-* 时有） */
  input?: Record<string, unknown>
  /** 执行结果（output-available 时有） */
  output?: unknown
  /** 错误信息（output-error 时有） */
  errorText?: string
  /** 是否需要用户确认（input-available 时可能为 true） */
  isPendingApproval?: boolean
  /** 运行耗时（ms） */
  durationMs?: number
}

export type ToolCallState =
  | 'input-streaming' // 参数正在生成（部分 JSON）
  | 'input-available' // 参数完整，等待/正在执行
  | 'output-available' // 执行成功
  | 'output-error' // 执行失败

/** 步骤组：连续的 tool_call 被分组 */
export interface StepGroupPart {
  type: 'step-group'
  id: string
  /** 组内工具调用 */
  toolCalls: ToolCallPart[]
  /** 该步骤是否活跃（正在运行） */
  isActive: boolean
  /** 该步骤是否已完成（所有工具都有结果） */
  isCompleted: boolean
  /** 步骤内是否有流式中的工具 */
  hasStreamingTool: boolean
}

/** 系统信息 */
export interface SystemInfoPart {
  type: 'system-info'
  id: string
  subtype: string
  content: unknown
  /** 是否需要在时间线中独立占位 */
  isStandalone: boolean
}

/** 错误信息 */
export interface ErrorPart {
  type: 'error'
  id: string
  message: string
  errorType?: string
}

/** 结果消息（查询结束） */
export interface ResultPart {
  type: 'result'
  id: string
  subtype: string
  usage?: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
  }
  totalCostUsd?: number
  terminalReason?: string
}

// ===== 辅助类型 =====

interface ParsedTurn {
  parts: MessagePart[]
  assistantMessages: SDKAssistantMessage[]
  turnMessages: SDKMessage[]
  model?: string
}

// ===== 纯函数解析器 =====

let _idCounter = 0
function nextId(prefix: string): string {
  return `${prefix}:${++_idCounter}:${Date.now()}`
}

/**
 * 主入口：将 SDKMessage[] 解析为 MessagePart[]
 *
 * @param messages — 完整消息列表（已合并 persisted + live）
 * @param options — 解析选项
 * @returns MessagePart[] — 按渲染顺序排列的 part 列表
 */
export function parseSDKMessagesToParts(
  messages: SDKMessage[],
  options: {
    /** 当前是否处于流式中 */
    isStreaming?: boolean
    /** 流式文本（smooth stream 后的显示文本） */
    streamingText?: string
    /** 流式思考文本 */
    streamingThinking?: string
    /** 会话模型 ID（用于 fallback） */
    sessionModelId?: string
  } = {}
): MessagePart[] {
  const { isStreaming = false, streamingText, streamingThinking, sessionModelId } = options

  // 1. 按 turn 分组
  const turns = groupMessagesIntoTurns(messages, sessionModelId)

  // 2. 构建 tool_result 查找表
  const toolResultMap = buildToolResultMap(messages)

  // 3. 解析每个 turn
  const allParts: MessagePart[] = []
  for (const turn of turns) {
    const turnParts = parseTurnToParts(turn, toolResultMap, {
      isStreaming,
      streamingText,
      streamingThinking,
    })
    allParts.push(...turnParts)
  }

  return allParts
}

// ===== Turn 分组（简化版，替代 groupIntoTurns） =====

interface Turn {
  type: 'user' | 'assistant' | 'system'
  messages: SDKMessage[]
  model?: string
}

function groupMessagesIntoTurns(
  messages: SDKMessage[],
  sessionModelId?: string
): Turn[] {
  const turns: Turn[] = []
  let currentAssistantMsgs: SDKMessage[] = []

  const flushAssistant = (): void => {
    if (currentAssistantMsgs.length > 0) {
      const firstAssistant = currentAssistantMsgs.find(
        (m) => m.type === 'assistant'
      ) as SDKAssistantMessage | undefined
      turns.push({
        type: 'assistant',
        messages: [...currentAssistantMsgs],
        model:
          firstAssistant?._channelModelId ||
          firstAssistant?.message?.model ||
          sessionModelId,
      })
      currentAssistantMsgs = []
    }
  }

  for (const msg of messages) {
    if (msg.type === 'user') {
      const userMsg = msg as SDKUserMessage
      // 真正的用户输入（非 tool_result）→ 结束当前 assistant turn
      if (isUserInputMessage(userMsg)) {
        flushAssistant()
        turns.push({ type: 'user', messages: [msg] })
      } else {
        // tool_result → 归入当前 assistant turn
        currentAssistantMsgs.push(msg)
      }
    } else if (msg.type === 'assistant') {
      const aMsg = msg as SDKAssistantMessage
      if (aMsg.isReplay) continue
      currentAssistantMsgs.push(msg)
    } else if (msg.type === 'system') {
      const sysMsg = msg as SDKSystemMessage
      if (isStandaloneSystem(sysMsg)) {
        flushAssistant()
        turns.push({ type: 'system', messages: [msg] })
      } else {
        currentAssistantMsgs.push(msg)
      }
    } else {
      // result, tool_progress, prompt_suggestion 等
      if ((msg as { type: string }).type === 'prompt_suggestion') continue
      currentAssistantMsgs.push(msg)
    }
  }

  flushAssistant()
  return turns
}

function isUserInputMessage(msg: SDKUserMessage): boolean {
  const content = msg.message?.content
  if (!Array.isArray(content)) return true
  // 如果 content 只有 tool_result，不是用户输入
  const hasNonToolResult = content.some((b) => b.type !== 'tool_result')
  return hasNonToolResult
}

function isStandaloneSystem(msg: SDKSystemMessage): boolean {
  const standaloneSubtypes = [
    'compacting',
    'compaction_boundary',
    'permission_denied',
    'init',
  ]
  return standaloneSubtypes.includes(msg.subtype ?? '')
}

// ===== Tool Result 查找表 =====

function buildToolResultMap(
  messages: SDKMessage[]
): Map<string, SDKToolResultBlock & { durationMs?: number }> {
  const map = new Map<string, SDKToolResultBlock & { durationMs?: number }>()

  for (const msg of messages) {
    if (msg.type !== 'user') continue
    const userMsg = msg as SDKUserMessage
    const content = userMsg.message?.content
    if (!Array.isArray(content)) continue

    for (const block of content) {
      if (block.type === 'tool_result') {
        const tr = block as SDKToolResultBlock
        map.set(tr.tool_use_id, tr)
      }
    }
  }

  return map
}

// ===== Turn → Parts 解析 =====

interface ParseTurnOptions {
  isStreaming: boolean
  streamingText?: string
  streamingThinking?: string
}

function parseTurnToParts(
  turn: Turn,
  toolResultMap: Map<string, SDKToolResultBlock & { durationMs?: number }>,
  options: ParseTurnOptions
): MessagePart[] {
  if (turn.type === 'user') {
    // 用户 turn → 由上层 AgentMessages 用 AskMessageItem 渲染
    return []
  }

  if (turn.type === 'system') {
    const sysMsg = turn.messages[0] as SDKSystemMessage
    return [
      {
        type: 'system-info',
        id: nextId('sys'),
        subtype: sysMsg.subtype ?? 'unknown',
        content: sysMsg,
        isStandalone: true,
      },
    ]
  }

  // assistant turn
  const parts: MessagePart[] = []
  const assistantMsgs = turn.messages.filter(
    (m): m is SDKAssistantMessage => m.type === 'assistant'
  )

  // 收集所有 content blocks
  let allBlocks: SDKContentBlock[] = []
  for (const msg of assistantMsgs) {
    const blocks = msg.message?.content ?? []
    allBlocks.push(...blocks)
  }

  // 合并流式内容
  if (options.isStreaming && (options.streamingText || options.streamingThinking)) {
    allBlocks = mergeStreamingBlocks(allBlocks, options)
  }

  // 解析 blocks 为 parts
  const { textParts, thinkingParts, stepGroups } = parseContentBlocks(
    allBlocks,
    toolResultMap,
    options.isStreaming
  )

  // 组装 parts：answer 文本 + 过程组 + 思考块
  // 顺序：思考块(流式中) → 过程组 → 回答文本
  parts.push(...thinkingParts)
  parts.push(...stepGroups)
  parts.push(...textParts)

  // 添加 result 消息（如果有）
  const resultMsg = turn.messages.find(
    (m): m is SDKResultMessage => m.type === 'result'
  )
  if (resultMsg) {
    parts.push({
      type: 'result',
      id: nextId('result'),
      subtype: resultMsg.subtype,
      usage: resultMsg.usage
        ? {
            inputTokens: resultMsg.usage.input_tokens,
            outputTokens: resultMsg.usage.output_tokens,
            cacheReadTokens: resultMsg.usage.cache_read_input_tokens,
            cacheCreationTokens: resultMsg.usage.cache_creation_input_tokens,
          }
        : undefined,
      totalCostUsd: resultMsg.total_cost_usd,
      terminalReason: resultMsg.terminal_reason,
    })
  }

  // 添加 assistant error
  const errorMsg = assistantMsgs.find((m) => m.error)
  if (errorMsg?.error) {
    parts.push({
      type: 'error',
      id: nextId('error'),
      message: errorMsg.error.message,
      errorType: errorMsg.error.errorType,
    })
  }

  return parts
}

// ===== Content Blocks → Parts =====

function parseContentBlocks(
  blocks: SDKContentBlock[],
  toolResultMap: Map<string, SDKToolResultBlock & { durationMs?: number }>,
  isStreaming: boolean
): {
  textParts: TextPart[]
  thinkingParts: ThinkingPart[]
  stepGroups: StepGroupPart[]
} {
  const textParts: TextPart[] = []
  const thinkingParts: ThinkingPart[] = []
  const stepGroups: StepGroupPart[] = []

  let currentToolCalls: ToolCallPart[] = []

  const flushStepGroup = (): void => {
    if (currentToolCalls.length === 0) return

    const isCompleted = currentToolCalls.every(
      (tc) => tc.state === 'output-available' || tc.state === 'output-error'
    )
    const hasStreamingTool = currentToolCalls.some((tc) => tc.state === 'input-streaming')

    stepGroups.push({
      type: 'step-group',
      id: nextId('step'),
      toolCalls: currentToolCalls,
      isActive: !isCompleted || hasStreamingTool,
      isCompleted,
      hasStreamingTool,
    })
    currentToolCalls = []
  }

  for (const block of blocks) {
    switch (block.type) {
      case 'text': {
        flushStepGroup()
        const text = (block as { text?: string }).text ?? ''
        if (text.trim()) {
          textParts.push({
            type: 'text',
            id: nextId('text'),
            text,
            isStreaming,
          })
        }
        break
      }

      case 'thinking': {
        // 思考块可以出现在过程组内或外，这里简化处理：单独列出
        const thinking = (block as { thinking?: string }).thinking ?? ''
        if (thinking.trim()) {
          thinkingParts.push({
            type: 'thinking',
            id: nextId('think'),
            thinking,
            isStreaming,
          })
        }
        break
      }

      case 'tool_use': {
        const toolBlock = block as SDKToolUseBlock
        const toolResult = toolResultMap.get(toolBlock.id)
        const state = determineToolCallState(toolBlock, toolResult, isStreaming)

        currentToolCalls.push({
          type: 'tool-call',
          id: nextId('tool'),
          toolUseId: toolBlock.id,
          toolName: toolBlock.name,
          state,
          input: toolBlock.input,
          output: toolResult?.content,
          errorText: toolResult?.is_error ? String(toolResult.content ?? '未知错误') : undefined,
          isPendingApproval: state === 'input-available' && !toolResult,
        })
        break
      }

      default:
        // 未知类型：如果是文本就当文本处理
        if ('text' in block && typeof (block as { text: string }).text === 'string') {
          flushStepGroup()
          textParts.push({
            type: 'text',
            id: nextId('text'),
            text: (block as { text: string }).text,
            isStreaming,
          })
        }
    }
  }

  flushStepGroup()

  return { textParts, thinkingParts, stepGroups }
}

function determineToolCallState(
  toolBlock: SDKToolUseBlock,
  toolResult: (SDKToolResultBlock & { durationMs?: number }) | undefined,
  isStreaming: boolean
): ToolCallState {
  if (toolResult) {
    return toolResult.is_error ? 'output-error' : 'output-available'
  }
  // 没有 tool_result：如果还在流式中，可能是 input-streaming 或 input-available
  // SDK 目前不提供部分 input，所以完整 input 视为 input-available
  if (isStreaming) {
    // 流式中且没有结果 → 正在执行中
    return 'input-available'
  }
  // 非流式且没有结果 → 可能执行中或等待确认
  return 'input-available'
}

// ===== 流式内容合并 =====

function mergeStreamingBlocks(
  blocks: SDKContentBlock[],
  options: { streamingText?: string; streamingThinking?: string }
): SDKContentBlock[] {
  const { streamingText, streamingThinking } = options
  const result = [...blocks]

  // 合并流式思考
  if (streamingThinking?.trim()) {
    const lastThinkingIndex = result.findLastIndex((b) => b.type === 'thinking')
    if (lastThinkingIndex >= 0) {
      result[lastThinkingIndex] = {
        type: 'thinking',
        thinking: streamingThinking,
      } as SDKContentBlock
    } else {
      result.push({ type: 'thinking', thinking: streamingThinking } as SDKContentBlock)
    }
  }

  // 合并流式文本
  if (streamingText?.trim()) {
    const lastTextIndex = result.findLastIndex((b) => b.type === 'text')
    if (lastTextIndex >= 0) {
      result[lastTextIndex] = { type: 'text', text: streamingText } as SDKContentBlock
    } else {
      result.push({ type: 'text', text: streamingText } as SDKContentBlock)
    }
  }

  return result
}

// ===== 重新计算 step 活跃状态（用于响应式更新） =====

/**
 * 根据当前流式状态重新计算 step 的 isActive
 * 用于：当流式结束时，将正在运行的 step 标记为已完成
 */
export function recalculateStepStates(
  parts: MessagePart[],
  isStreaming: boolean
): MessagePart[] {
  return parts.map((part) => {
    if (part.type !== 'step-group') return part

    const allCompleted = part.toolCalls.every(
      (tc) => tc.state === 'output-available' || tc.state === 'output-error'
    )

    return {
      ...part,
      isActive: isStreaming ? !allCompleted : false,
      isCompleted: allCompleted,
      hasStreamingTool: isStreaming && part.toolCalls.some((tc) => tc.state === 'input-streaming'),
    }
  })
}
