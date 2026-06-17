/**
 * Btw Service - 侧面提问服务
 *
 * 处理 `/btw` 侧面提问的后端逻辑。
 * 特点：
 * - 不写入会话历史
 * - 纯文本对话（无工具）
 * - 流式输出
 * - **共享主会话上下文**（Claude Code 原生语义）：从主会话 SDKMessage 抽取最近 N 轮文本
 *   作为 LLM history 传入，让 LLM 知道"刚才发生了什么"
 */

import { getAdapter, getTAgentUserAgent } from '@tagent/core'
import { BTW_IPC_CHANNELS } from '@tagent/shared'
import { BrowserWindow } from 'electron'

import { getAgentSessionSDKMessages } from './agent-session-manager'
import { getChannelById, decryptApiKey } from './channel-manager'
import { getFetchFn } from './proxy-fetch'

import type { StreamRequestInput } from '@tagent/core'
import type { ChatMessage, SDKMessage } from '@tagent/shared'

/** 当前活跃的 BTW 请求 AbortController */
let activeBtwController: AbortController | null = null

/** btw 上下文共享：默认传给 LLM 的最近 user-assistant 轮数（每轮 = 1 user + 1 assistant） */
const DEFAULT_BTW_CONTEXT_TURNS = 20

// ===== SDKMessage → ChatMessage 转换器 =====

interface ContentBlockShape {
  type?: string
  text?: string
  thinking?: string
  name?: string
  tool_use_id?: string
  is_error?: boolean
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractTextBlocks(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (!isRecord(block)) continue
    const b = block as ContentBlockShape
    if (b.type === 'text' && typeof b.text === 'string') {
      parts.push(b.text)
    } else if (b.type === 'thinking' && typeof b.thinking === 'string') {
      // 思考块保留为引用方块，便于 LLM 理解"模型当时想了什么"
      parts.push(`[thinking: ${b.thinking}]`)
    } else if (b.type === 'tool_use' && typeof b.name === 'string') {
      // 工具调用降级为文字摘要（btw 无工具，但需要让 LLM 知道工具被调用过）
      parts.push(`[调用工具 ${b.name}]`)
    }
    // tool_result 块（user 消息内的）跳过 — btw 无工具，这些上下文对回答 btw 问题无意义
  }
  return parts.join('\n')
}

function extractUserText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (!isRecord(block)) continue
    const b = block as ContentBlockShape
    if (b.type === 'text' && typeof b.text === 'string') {
      parts.push(b.text)
    }
    // 跳过 tool_result（btw 不关心工具结果原文）
  }
  return parts.join('\n')
}

/**
 * 把主会话 SDKMessage[] 转换成 ChatMessage[]，作为 btw 请求的 history。
 *
 * 规则：
 * 1. 过滤掉非 user/assistant 类型（system / result / tool_progress / thinking_tokens / prompt_suggestion / tool_use_summary）
 * 2. 跳过 parent_tool_use_id 非空（subagent 过程）和 isSynthetic（Skill 展开）
 * 3. user 取 text block；assistant 取 text + thinking 摘要 + tool_use 摘要
 * 4. 合并连续同角色消息
 * 5. 取尾部最近 N 个 user-assistant 对（= N 轮对话）
 */
export function convertSDKMessagesToChatHistory(
  sdkMessages: SDKMessage[],
  maxTurns: number
): ChatMessage[] {
  const raw: Array<{
    role: 'user' | 'assistant'
    content: string
    createdAt: number
    uuid?: string
  }> = []

  for (const msg of sdkMessages) {
    if (!isRecord(msg)) continue
    const m = msg as Record<string, unknown>
    const type = m.type
    if (type !== 'user' && type !== 'assistant') continue
    // 跳过 subagent 过程
    if (m.parent_tool_use_id != null) continue
    // 跳过合成消息（Skill 展开等）
    if (m.isSynthetic === true) continue

    const message = m.message as { content?: unknown } | undefined
    const content = message?.content
    const text = type === 'user' ? extractUserText(content) : extractTextBlocks(content)
    if (!text.trim()) continue

    raw.push({
      role: type,
      content: text,
      createdAt: typeof m._createdAt === 'number' ? (m._createdAt as number) : Date.now(),
      uuid: typeof m.uuid === 'string' ? (m.uuid as string) : undefined,
    })
  }

  // 合并连续同角色（SDK 中 user 文本可能因 attachments 被分成多 user 消息）
  const merged: typeof raw = []
  for (const item of raw) {
    const last = merged[merged.length - 1]
    if (last && last.role === item.role) {
      last.content = `${last.content}\n${item.content}`
    } else {
      merged.push({ ...item })
    }
  }

  // 取尾部 maxTurns 个 user-assistant 对 = 2*maxTurns 条
  const tail = merged.slice(-maxTurns * 2)

  return tail.map((item, idx) => ({
    id: item.uuid ? `sdk-${item.uuid}` : `sdk-idx-${idx}`,
    role: item.role,
    content: item.content,
    createdAt: item.createdAt,
  }))
}

/**
 * 发送侧面提问
 */
export async function sendBtwMessage(input: {
  channelId: string
  modelId: string
  message: string
  messageId: string
  /** 父会话 ID（用于拉取主会话上下文） */
  sourceSessionId?: string
  /** 上下文轮数（默认 20） */
  contextTurns?: number
}): Promise<void> {
  const { channelId, modelId, message, messageId, sourceSessionId, contextTurns } = input

  // 获取渠道配置
  const channel = getChannelById(channelId)
  if (!channel) {
    throw new Error(`渠道不存在: ${channelId}`)
  }

  // 解密 API Key（decryptApiKey 接收 channelId，内部查找渠道并解密 apiKey）
  const apiKey = decryptApiKey(channelId)
  if (!apiKey) {
    throw new Error('无法解密 API Key')
  }

  // 取消之前的请求
  if (activeBtwController) {
    activeBtwController.abort()
  }
  activeBtwController = new AbortController()

  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) {
    throw new Error('窗口已关闭')
  }

  try {
    // 获取适配器
    const adapter = getAdapter(channel.provider)
    const fetchFn = getFetchFn()

    // ===== 上下文共享：从主会话拉 SDKMessage，转换成 ChatMessage history =====
    let history: ChatMessage[] = []
    if (sourceSessionId) {
      try {
        const sdkMessages = getAgentSessionSDKMessages(sourceSessionId)
        const turns = contextTurns ?? DEFAULT_BTW_CONTEXT_TURNS
        history = convertSDKMessagesToChatHistory(sdkMessages, turns)
        console.log(`[btw-service] 上下文注入: ${history.length} 条 (${turns} 轮)`)
      } catch (err) {
        console.warn('[btw-service] 读取主会话上下文失败,使用空 history:', err)
      }
    }

    // 构建流式请求输入（不传 tools，btw 无工具访问）
    const streamInput: StreamRequestInput = {
      modelId,
      history,
      userMessage: message,
      apiKey,
      baseUrl: channel.baseUrl,
      readImageAttachments: () => [], // 无附件
    }

    // 构建请求
    const request = adapter.buildStreamRequest(streamInput)

    // 发送请求
    const response = await fetchFn(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: activeBtwController.signal,
    })

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    // 处理流式响应
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let accumulatedText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (activeBtwController?.signal.aborted) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr || jsonStr === '[DONE]') continue

        try {
          const json = JSON.parse(jsonStr)
          // 提取文本内容（兼容不同供应商格式）
          const text =
            json.choices?.[0]?.delta?.content || json.delta?.text || json.message?.content || ''

          if (text) {
            accumulatedText += text
            win.webContents.send(BTW_IPC_CHANNELS.BTW_EVENT, {
              type: 'text',
              messageId,
              text,
            })
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 发送完成事件
    win.webContents.send(BTW_IPC_CHANNELS.BTW_EVENT, {
      type: 'complete',
      messageId,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // 请求被取消，不报错
      return
    }
    win.webContents.send(BTW_IPC_CHANNELS.BTW_EVENT, {
      type: 'error',
      messageId,
      error: error instanceof Error ? error.message : '未知错误',
    })
    throw error
  } finally {
    activeBtwController = null
  }
}

/**
 * 取消侧面提问
 */
export function cancelBtw(): void {
  if (activeBtwController) {
    activeBtwController.abort()
    activeBtwController = null
  }
}
