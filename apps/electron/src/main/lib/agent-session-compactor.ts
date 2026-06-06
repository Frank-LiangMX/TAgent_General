/**
 * P1-3: Agent 会话客户端压缩工具
 *
 * 当 Claude Agent SDK 服务端 compaction 失败时（9120caac 那类情况）,
 * 由 Agent 主动调 compact_session tool 兜底压缩。
 *
 * 3 个策略:
 * - drop_old_tool_results: 最便宜, 不调 LLM, 直接丢老 tool_use/tool_result 对
 * - keep_last_n: 保留最近 N 条, 其余全丢
 * - summarize: 用 cheap LLM 总结老消息 (本期不实现)
 *
 * 详见 docs/plans/2026-06-05-tagent-fusion-design.md §8.4 P1-3
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { getAgentSessionMessagesPath } from './config-paths'
import type { CompactSessionInput, CompactSessionResult } from '@tagent/shared'

/** 压缩前的单条消息（JSONL 解析结果，结构子集，index signature 允许额外字段）*/
export interface SDKMessageRow {
  type: string
  uuid?: string
  parent_tool_use_id?: string | null
  message?: {
    role?: string
    content?: Array<{
      type: string
      text?: string
      name?: string
      id?: string
      tool_use_id?: string
      [key: string]: unknown
    }>
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * P1-3: 计算 drop_old_tool_results 策略应该丢哪些消息
 *
 * 规则:
 * - user 消息全保留
 * - assistant 消息如果**只含 tool_use 块**（无文本）→ 丢
 * - assistant 消息含 tool_use + 文本 → 保留
 * - user 消息如果**只含 tool_result 块**（无文本）→ 丢
 * - user 消息含 tool_result + 文本 → 保留
 * - 不动 system 消息
 */
export function planDropOldToolResults(messages: SDKMessageRow[]): {
  kept: SDKMessageRow[]
  dropped: SDKMessageRow[]
} {
  const kept: SDKMessageRow[] = []
  const dropped: SDKMessageRow[] = []

  for (const msg of messages) {
    if (msg.type === 'system') {
      kept.push(msg)
      continue
    }
    if (msg.type === 'user') {
      // user 消息: 仅含 tool_result 块 → 丢
      const content = msg.message?.content
      if (Array.isArray(content) && content.length > 0 && content.every((b) => b.type === 'tool_result')) {
        dropped.push(msg)
        continue
      }
      kept.push(msg)
      continue
    }
    if (msg.type === 'assistant') {
      // assistant 消息: 仅含 tool_use 块（无文本）→ 丢
      const content = msg.message?.content
      if (Array.isArray(content) && content.length > 0 && content.every((b) => b.type === 'tool_use')) {
        dropped.push(msg)
        continue
      }
      kept.push(msg)
      continue
    }
    // 其他类型: 保留（保守）
    kept.push(msg)
  }

  return { kept, dropped }
}

/**
 * P1-3: 计算 keep_last_n 策略应该丢哪些消息
 *
 * 规则: 保留最后 N 条 user+assistant 对, 其余全丢
 * system 消息**全部保留**（不能丢，会影响 Agent 行为）
 */
export function planKeepLastN(messages: SDKMessageRow[], keepLastN: number = 10): {
  kept: SDKMessageRow[]
  dropped: SDKMessageRow[]
} {
  if (keepLastN <= 0) {
    return { kept: messages.filter((m) => m.type === 'system'), dropped: messages.filter((m) => m.type !== 'system') }
  }

  const systemMsgs = messages.filter((m) => m.type === 'system')
  const nonSystemMsgs = messages.filter((m) => m.type !== 'system')
  const startIdx = Math.max(0, nonSystemMsgs.length - keepLastN)
  const keptNonSystem = nonSystemMsgs.slice(startIdx)
  const droppedNonSystem = nonSystemMsgs.slice(0, startIdx)

  return { kept: [...systemMsgs, ...keptNonSystem], dropped: droppedNonSystem }
}

/**
 * P1-3: 主入口 — 执行压缩
 *
 * @param sessionId Agent session ID
 * @param input 压缩输入
 * @returns 压缩结果
 */
export async function compactSession(
  sessionId: string,
  input: CompactSessionInput,
): Promise<CompactSessionResult> {
  const filePath = getAgentSessionMessagesPath(sessionId)

  // 文件不存在 → 跳过
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf-8')
  } catch {
    return {
      success: false,
      beforeCount: 0,
      afterCount: 0,
      droppedCount: 0,
      message: `Session ${sessionId} JSONL 不存在, 无需压缩`,
    }
  }

  // 解析 JSONL → messages
  const messages: SDKMessageRow[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      messages.push(JSON.parse(trimmed) as SDKMessageRow)
    } catch {
      // 跳过损坏行
    }
  }

  if (messages.length === 0) {
    return {
      success: false,
      beforeCount: 0,
      afterCount: 0,
      droppedCount: 0,
      message: 'Session JSONL 为空, 无需压缩',
    }
  }

  // 按策略选 plan 函数
  let plan: { kept: SDKMessageRow[]; dropped: SDKMessageRow[] } | null = null
  let strategyDesc: string | null = null
  switch (input.strategy) {
    case 'drop_old_tool_results':
      plan = planDropOldToolResults(messages)
      strategyDesc = 'drop_old_tool_results (丢老 tool_use/tool_result 对, 保留文本)'
      break
    case 'keep_last_n':
      plan = planKeepLastN(messages, input.keepLastN ?? 10)
      strategyDesc = `keep_last_n=${input.keepLastN ?? 10} (保留最近 N 条 user+assistant, 丢其余)`
      break
    case 'summarize':
      return {
        success: false,
        beforeCount: messages.length,
        afterCount: messages.length,
        droppedCount: 0,
        message: 'summarize 策略本期未实现 (M2+ 排期), 请用 drop_old_tool_results',
      }
  }

  if (!plan || !strategyDesc) {
    return {
      success: false,
      beforeCount: messages.length,
      afterCount: messages.length,
      droppedCount: 0,
      message: '未知策略, 压缩失败',
    }
  }

  // 写回 JSONL
  const newRaw = plan.kept.map((m) => JSON.stringify(m)).join('\n') + '\n'
  writeFileSync(filePath, newRaw, 'utf-8')

  return {
    success: true,
    beforeCount: messages.length,
    afterCount: plan.kept.length,
    droppedCount: plan.dropped.length,
    message: `${strategyDesc}: ${plan.dropped.length} 条已压缩`,
  }
}
