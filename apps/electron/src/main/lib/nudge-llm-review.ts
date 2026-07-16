/**
 * Nudge LLM review 调用（P2.1，借鉴 Hermes Turn-based Nudge）
 *
 * 复用 reflect-service 的 callLLM 模式（主会话默认渠道 + 模型），
 * kscc 渠道不支持 SSE，抛错由上层回退。
 *
 * 详见 docs/plans/2026-07-06-silent-memory-research/TAgent_Memory_Master_Design.md §3.2
 */

import { getAdapter, getTAgentUserAgent } from '@tagent/core'
import type { StreamRequestInput } from '@tagent/core'

import { getChannelById, decryptApiKey } from './channel-manager'
import { getFetchFn } from './proxy-fetch'
import { getSettings } from './settings-service'

export interface NudgeReviewResult {
  action: 'nothing' | 'save'
  items?: Array<{
    type: 'fact' | 'behavior' | 'correction'
    content: string
    targetLayer: 'L0' | 'L2' | 'L3'
  }>
}

/**
 * 调 LLM 做 nudge review
 *
 * 复用主会话默认渠道 + 模型。kscc 渠道走 CLI 不支持 SSE，抛错由上层回退。
 * 失败抛错，调用方负责 catch。
 */
export async function callLLMForNudgeReview(
  systemPrompt: string,
  userPrompt: string
): Promise<NudgeReviewResult> {
  const settings = getSettings()
  const channelId = settings.agentChannelId
  const modelId = settings.agentModelId || 'claude-sonnet-4-6'
  if (!channelId) {
    throw new Error('未配置默认渠道')
  }

  const channel = getChannelById(channelId)
  if (!channel) {
    throw new Error(`渠道不存在: ${channelId}`)
  }
  if (channel.provider === 'kscc-internal') {
    throw new Error('kscc 渠道不支持 SSE，跳过 LLM review')
  }

  const apiKey = decryptApiKey(channelId)
  if (!apiKey) {
    throw new Error('无法解密 API Key')
  }

  const adapter = getAdapter(channel.provider)
  const fetchFn = getFetchFn()

  const streamInput: StreamRequestInput = {
    modelId,
    history: [
      { id: 'nudge-review-system', role: 'system', content: systemPrompt, createdAt: Date.now() },
    ],
    userMessage: userPrompt,
    apiKey,
    baseUrl: channel.baseUrl,
    readImageAttachments: () => [],
  }

  const request = adapter.buildStreamRequest(streamInput)

  const response = await fetchFn(request.url, {
    method: 'POST',
    headers: { ...request.headers, 'User-Agent': getTAgentUserAgent() },
    body: request.body,
  })

  if (!response.ok) {
    throw new Error(`LLM 请求失败: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法获取响应流')
  }

  const decoder = new TextDecoder()
  let accumulatedText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr || jsonStr === '[DONE]') continue

      try {
        const json = JSON.parse(jsonStr)
        const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? ''
        if (delta) {
          accumulatedText += delta
        }
      } catch {
        // 单行 JSON 解析失败继续读下一行
      }
    }
  }

  // 解析 LLM 输出的 JSON
  return parseReviewResult(accumulatedText)
}

/**
 * 解析 LLM 输出的 JSON
 *
 * 容错策略：
 * 1. 尝试直接 JSON.parse
 * 2. 失败则提取第一个 {...} 块再 parse
 * 3. 都失败则返回 nothing（保守，不误写）
 */
function parseReviewResult(text: string): NudgeReviewResult {
  const trimmed = text.trim()

  // 直接 parse
  try {
    return validateResult(JSON.parse(trimmed))
  } catch {
    // 继续尝试提取
  }

  // 提取第一个 {...} 块
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return validateResult(JSON.parse(match[0]))
    } catch {
      // 继续失败
    }
  }

  // 都失败 → nothing
  console.warn(`[Nudge LLM review] JSON 解析失败，回退 nothing: ${trimmed.slice(0, 200)}`)
  return { action: 'nothing' }
}

/**
 * 校验 LLM 输出格式
 */
function validateResult(raw: unknown): NudgeReviewResult {
  if (typeof raw !== 'object' || raw === null) {
    return { action: 'nothing' }
  }
  const obj = raw as Record<string, unknown>
  if (obj.action === 'nothing') {
    return { action: 'nothing' }
  }
  if (obj.action !== 'save') {
    return { action: 'nothing' }
  }
  if (!Array.isArray(obj.items)) {
    return { action: 'nothing' }
  }

  const validTypes = new Set(['fact', 'behavior', 'correction'])
  const validLayers = new Set(['L0', 'L2', 'L3'])

  const items = obj.items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .filter((item) => typeof item.content === 'string' && item.content.trim())
    .filter((item) => validTypes.has(item.type as string))
    .filter((item) => validLayers.has(item.targetLayer as string))
    .map((item) => ({
      type: item.type as 'fact' | 'behavior' | 'correction',
      content: (item.content as string).trim(),
      targetLayer: item.targetLayer as 'L0' | 'L2' | 'L3',
    }))

  if (items.length === 0) {
    return { action: 'nothing' }
  }

  return { action: 'save', items }
}
