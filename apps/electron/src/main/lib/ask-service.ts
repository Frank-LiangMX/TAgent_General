/**
 * Ask 档位流式服务（Electron 编排层）
 *
 * 与 chat-service.ts 平行，但针对 Ask 档位定制：
 * - 不写 SDK JSONL：用户消息存到 `{id}.ask.jsonl`（避免污染 SDK resume）
 * - 工具白名单严格：只放行 `suggest_agent_switch`（ask-tool-policy）
 * - 系统提示：内置 Ask 权限契约 + 主会话 SDK 历史摘要（ask-prompt-builder）
 * - 工具执行：suggest_agent_switch 解析为 STREAM_SWITCH_SUGGESTION 事件
 *
 * 复用 @tagent/core 的 Provider 适配器系统，与 chat-service 走同一条流式管线。
 */

import { randomUUID } from 'node:crypto'

import { getAdapter, streamSSE } from '@tagent/core'
import { ASK_IPC_CHANNELS, DEFAULT_COMPOSER_MODE } from '@tagent/shared'
import type {
  AskMessage,
  AskSendInput,
  AskStreamChunkEvent,
  AskStreamCompleteEvent,
  AskStreamErrorEvent,
  AskStreamReasoningEvent,
  AskStreamSwitchSuggestionEvent,
  ChatToolActivity,
  ChatMessage as SharedChatMessage,
} from '@tagent/shared'

import { getAgentSessionSDKMessages, updateAgentSessionMeta } from './agent-session-manager'
import { appendAskMessage, getAgentSessionAskMessages } from './ask-message-store'
import { buildAskSystemPrompt } from './ask-prompt-builder'
import {
  isSuggestAgentSwitchToolCall,
  SUGGEST_AGENT_SWITCH_TOOL_NAMES,
  getAskEnabledTools,
} from './ask-tool-policy'
import { convertSDKMessagesToChatHistory } from './btw-service'
import { getChannelById, decryptApiKey } from './channel-manager'
import { getFetchFn } from './proxy-fetch'
import { getEffectiveProxyUrl } from './proxy-settings-service'

import type { StreamRequestInput, ToolCall, ToolResult } from '@tagent/core'
import type { WebContents } from 'electron'

/** Ask 上下文轮数（与 BTW 对齐） */
const ASK_CONTEXT_TURNS = 20

/** 活跃的 Ask AbortController 映射（agentSessionId → controller） */
const activeControllers = new Map<string, AbortController>()

/**
 * 构建流式请求输入
 *
 * 拼装 history = (SDK 历史摘要 + 当前 Ask jsonl)，
 * 供 LLM 知道「刚才 Agent 做了什么」+「刚才 Ask 问了什么」。
 */
function buildStreamInput(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  userMessage: string,
  systemMessage: string,
  history: SharedChatMessage[]
): StreamRequestInput {
  return {
    baseUrl,
    apiKey,
    modelId,
    history,
    userMessage,
    systemMessage,
    readImageAttachments: () => [],
  }
}

/**
 * 收集 Ask 上下文历史：SDK 摘要 + 本次会话最近 Ask 消息
 */
function collectAskHistory(agentSessionId: string): SharedChatMessage[] {
  const sdkMessages = getAgentSessionSDKMessages(agentSessionId)
  const sdkHistory = convertSDKMessagesToChatHistory(sdkMessages, ASK_CONTEXT_TURNS)

  const askMessages = getAgentSessionAskMessages(agentSessionId)
  // 拼接尾部：仅取最近 1 轮 Ask（避免 history 过长，Ask 主要看当轮）
  const recentAsk = askMessages
    .filter((m) => m.content.trim() && !m.error)
    .slice(-2)
    .map<SharedChatMessage>((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      reasoning: m.reasoning,
      model: m.modelId,
      attachments: m.attachments,
    }))

  return [...sdkHistory, ...recentAsk]
}

/**
 * 执行 suggest_agent_switch 工具调用
 *
 * 实际不做事，只产出 STREAM_SWITCH_SUGGESTION 事件
 * （P1 由渲染进程根据事件切 Composer 档位 + 预填 draft）
 */
function executeSuggestAgentSwitch(toolCall: ToolCall): ToolResult {
  const reason = toolCall.arguments.reason as string | undefined
  const suggestedPrompt = toolCall.arguments.suggestedPrompt as string | undefined

  if (!reason || !suggestedPrompt) {
    return {
      toolCallId: toolCall.id,
      content: '参数缺失：reason 和 suggestedPrompt 均为必填',
      isError: true,
    }
  }

  return {
    toolCallId: toolCall.id,
    content: JSON.stringify({
      type: 'agent_switch_suggestion',
      reason,
      suggestedPrompt,
    }),
  }
}

/**
 * 发送 Ask 消息并流式返回 AI 响应
 */
export async function sendAskMessage(input: AskSendInput, webContents: WebContents): Promise<void> {
  const {
    agentSessionId,
    content,
    channelId,
    modelId,
    systemPromptOverride,
    startedAt: inputStartedAt,
  } = input

  // 1. 解析渠道
  const channel = getChannelById(channelId)
  if (!channel) {
    sendError(webContents, agentSessionId, '渠道不存在')
    return
  }

  // 2. 解密 API Key
  let apiKey: string
  try {
    apiKey = decryptApiKey(channelId)
  } catch {
    sendError(webContents, agentSessionId, '解密 API Key 失败')
    return
  }

  // 3. 构造 user 消息并持久化
  const streamStartedAt = inputStartedAt ?? Date.now()
  const userMsg: AskMessage = {
    id: randomUUID(),
    role: 'user',
    content,
    createdAt: streamStartedAt,
    channelId,
    modelId,
    attachments: input.attachments && input.attachments.length > 0 ? input.attachments : undefined,
  }
  appendAskMessage(agentSessionId, userMsg)

  // 4. 构造 assistant 消息 ID（流式开始就用最终 ID，前端保持引用稳定）
  const assistantMsgId = randomUUID()

  // 5. AbortController
  const controller = new AbortController()
  activeControllers.set(agentSessionId, controller)

  // 流式累积
  let accumulatedContent = ''
  let accumulatedReasoning = ''
  const accumulatedToolActivities: ChatToolActivity[] = []

  // 6. 上下文 history + system prompt
  const history = collectAskHistory(agentSessionId)
  const systemMessage = buildAskSystemPrompt(agentSessionId, systemPromptOverride)

  try {
    const adapter = getAdapter(channel.provider)
    const proxyUrl = await getEffectiveProxyUrl()
    const fetchFn = getFetchFn(proxyUrl)

    // 7. 工具白名单（仅 suggest_agent_switch）
    const { tools } = getAskEnabledTools()

    // 8. 构造流式请求
    const streamInput = buildStreamInput(
      channel.baseUrl ?? '',
      apiKey,
      modelId,
      content,
      systemMessage,
      history
    )

    // 9. 推 STREAM_CHUNK 起始空事件（带 messageId，前端在流式开始时就建好 bubble）
    //    — 不发单独的 "start" 事件，前端用 STREAM_CHUNK 首条到达时建 bubble

    let lastSentContent = ''
    let lastSentReasoning = ''

    /** 工具轮开始时记录 */
    const pushToolStart = (tc: ToolCall): void => {
      accumulatedToolActivities.push({
        toolCallId: tc.id,
        toolName: tc.name,
        type: 'start',
      })
    }

    /** 工具结果回传 */
    const pushToolResult = (tc: ToolCall, tr: ToolResult): void => {
      // 替换最后一个 start
      const idx = accumulatedToolActivities.findIndex(
        (a) => a.toolCallId === tc.id && a.type === 'start'
      )
      if (idx >= 0) {
        accumulatedToolActivities[idx] = {
          toolCallId: tc.id,
          toolName: tc.name,
          type: 'result',
          result: tr.content,
          isError: tr.isError,
          input: tc.arguments,
        }
      } else {
        accumulatedToolActivities.push({
          toolCallId: tc.id,
          toolName: tc.name,
          type: 'result',
          result: tr.content,
          isError: tr.isError,
          input: tc.arguments,
        })
      }
    }

    /** 文本增量推送 */
    const pushDelta = (delta: string): void => {
      if (delta) {
        const event: AskStreamChunkEvent = {
          agentSessionId,
          delta,
          messageId: assistantMsgId,
        }
        webContents.send(ASK_IPC_CHANNELS.STREAM_CHUNK, event)
      }
    }

    /** 推理增量推送 */
    const pushReasoning = (delta: string): void => {
      if (delta) {
        const event: AskStreamReasoningEvent = {
          agentSessionId,
          delta,
          messageId: assistantMsgId,
        }
        webContents.send(ASK_IPC_CHANNELS.STREAM_REASONING, event)
      }
    }

    /** 流式事件处理器 */
    const handleStreamEvent = (event: { type: string; delta?: string }): void => {
      switch (event.type) {
        case 'chunk': {
          accumulatedContent += event.delta ?? ''
          pushDelta(event.delta ?? '')
          lastSentContent = accumulatedContent
          break
        }
        case 'reasoning': {
          accumulatedReasoning += event.delta ?? ''
          pushReasoning(event.delta ?? '')
          lastSentReasoning = accumulatedReasoning
          break
        }
        // done / tool_call_start 在外部处理
      }
    }

    // 10. 启动流式
    const {
      content: finalContent,
      reasoning: finalReasoning,
      thinkingBlocks: _thinkingBlocks,
      toolCalls,
      stopReason,
    } = await streamSSE({
      request: adapter.buildStreamRequest({
        ...streamInput,
        tools,
      }),
      adapter,
      signal: controller.signal,
      fetchFn,
      onEvent: handleStreamEvent,
    })

    // 11. 处理工具调用
    if (toolCalls && toolCalls.length > 0 && stopReason === 'tool_use') {
      for (const tc of toolCalls) {
        pushToolStart(tc)

        if (isSuggestAgentSwitchToolCall(tc.name)) {
          const tr = executeSuggestAgentSwitch(tc)
          pushToolResult(tc, tr)
          // 推送升级引导事件
          if (!tr.isError && tr.content) {
            try {
              const parsed = JSON.parse(tr.content) as {
                type?: string
                reason?: string
                suggestedPrompt?: string
              }
              if (
                parsed.type === 'agent_switch_suggestion' &&
                parsed.reason &&
                parsed.suggestedPrompt
              ) {
                const event: AskStreamSwitchSuggestionEvent = {
                  agentSessionId,
                  suggestion: {
                    type: 'agent_switch_suggestion',
                    reason: parsed.reason,
                    suggestedPrompt: parsed.suggestedPrompt,
                  },
                }
                webContents.send(ASK_IPC_CHANNELS.STREAM_SWITCH_SUGGESTION, event)
              }
            } catch {
              // JSON 解析失败，忽略
            }
          }
        } else {
          // 任何非白名单工具调用 → 拒绝（理论上 ask-tool-policy 已经过滤了）
          const tr: ToolResult = {
            toolCallId: tc.id,
            content: `工具 ${tc.name} 在 Ask 档位下不可用`,
            isError: true,
          }
          pushToolResult(tc, tr)
        }
      }

      // 工具调用后追加一轮（不带 tools 强制模型产出文本）
      const followUpRequest = adapter.buildStreamRequest({
        ...streamInput,
        // 不传 tools
      })
      await streamSSE({
        request: followUpRequest,
        adapter,
        signal: controller.signal,
        fetchFn,
        onEvent: handleStreamEvent,
      })
    }

    const endedAt = Date.now()
    const durationMs = endedAt - streamStartedAt

    // 12. 保存 assistant 消息
    const trimmedContent = (finalContent || accumulatedContent).trim()
    if (trimmedContent) {
      const assistantMsg: AskMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: finalContent || accumulatedContent,
        createdAt: endedAt,
        channelId,
        modelId,
        reasoning: finalReasoning || accumulatedReasoning || undefined,
        durationMs,
      }
      appendAskMessage(agentSessionId, assistantMsg)
    }

    // 13. 更新 session updatedAt
    try {
      updateAgentSessionMeta(agentSessionId, {})
    } catch {
      // 更新失败不影响主流程
    }

    // 14. 推 STREAM_COMPLETE
    const completeEvent: AskStreamCompleteEvent = {
      agentSessionId,
      messageId: assistantMsgId,
      model: modelId,
      durationMs,
      stoppedByUser: false,
    }
    webContents.send(ASK_IPC_CHANNELS.STREAM_COMPLETE, completeEvent)
  } catch (error) {
    if (controller.signal.aborted) {
      console.log(`[Ask 服务] 会话 ${agentSessionId} 已被用户中止`)

      // 保存已累积的部分
      const endedAt = Date.now()
      if (accumulatedContent) {
        const partialMsg: AskMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: accumulatedContent,
          createdAt: endedAt,
          channelId,
          modelId,
          reasoning: accumulatedReasoning || undefined,
          partial: true,
          durationMs: endedAt - streamStartedAt,
        }
        appendAskMessage(agentSessionId, partialMsg)
      }

      const completeEvent: AskStreamCompleteEvent = {
        agentSessionId,
        messageId: assistantMsgId,
        model: modelId,
        durationMs: endedAt - streamStartedAt,
        stoppedByUser: true,
      }
      webContents.send(ASK_IPC_CHANNELS.STREAM_COMPLETE, completeEvent)
      return
    }

    const errorMessage = error instanceof Error ? error.message : '未知错误'
    console.error(`[Ask 服务] 流式请求失败:`, error)

    // 保存已累积的部分
    if (accumulatedContent) {
      const partialMsg: AskMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: accumulatedContent,
        createdAt: Date.now(),
        channelId,
        modelId,
        reasoning: accumulatedReasoning || undefined,
        partial: true,
        error: errorMessage,
      }
      appendAskMessage(agentSessionId, partialMsg)
    }

    sendError(webContents, agentSessionId, errorMessage)
  } finally {
    activeControllers.delete(agentSessionId)
  }
}

function sendError(webContents: WebContents, agentSessionId: string, error: string): void {
  const event: AskStreamErrorEvent = { agentSessionId, error }
  webContents.send(ASK_IPC_CHANNELS.STREAM_ERROR, event)
}

/**
 * 中止指定 Agent 会话的 Ask 生成
 */
export function stopAskGeneration(agentSessionId: string): void {
  const controller = activeControllers.get(agentSessionId)
  if (controller) {
    controller.abort()
    activeControllers.delete(agentSessionId)
    console.log(`[Ask 服务] 已中止会话: ${agentSessionId}`)
  }
}

/**
 * 中止所有活跃的 Ask 流（应用退出时调用）
 */
export function stopAllAskGenerations(): void {
  if (activeControllers.size === 0) return
  console.log(`[Ask 服务] 正在中止所有活跃 Ask (${activeControllers.size} 个)...`)
  for (const [agentSessionId, controller] of activeControllers) {
    controller.abort()
    console.log(`[Ask 服务] 已中止会话: ${agentSessionId}`)
  }
  activeControllers.clear()
}

/** 重新导出供 IPC 处理器使用 */
export { DEFAULT_COMPOSER_MODE }
