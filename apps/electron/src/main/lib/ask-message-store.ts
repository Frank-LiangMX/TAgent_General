/**
 * Ask 消息存储
 *
 * Ask 消息持久化到 `{agentSessionId}.ask.jsonl`，与 SDK JSONL 并列。
 * - 不参与 SDK resume（resume 只读 SDK JSONL）
 * - 不被 SDK orchestrator 看到
 * - UI 渲染层按 `createdAt` 与 SDK 消息合并展示
 *
 * 照搬 agent-session-manager 的 JSONL 模式，简化版。
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, unlinkSync } from 'node:fs'

import { getAgentSessionAskMessagesPath } from './config-paths'

import type { AskMessage } from '@tagent/shared'

/**
 * 读取会话的所有 Ask 消息
 */
export function getAgentSessionAskMessages(agentSessionId: string): AskMessage[] {
  const filePath = getAgentSessionAskMessagesPath(agentSessionId)

  if (!existsSync(filePath)) {
    return []
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const lines = raw.split('\n').filter((line) => line.trim())
    return lines.map((line) => JSON.parse(line) as AskMessage)
  } catch (error) {
    console.error(`[Ask 消息] 读取失败 (${agentSessionId}):`, error)
    return []
  }
}

/**
 * 追加一条 Ask 消息到 JSONL 文件
 */
export function appendAskMessage(agentSessionId: string, message: AskMessage): void {
  const filePath = getAgentSessionAskMessagesPath(agentSessionId)

  try {
    const line = JSON.stringify(message) + '\n'
    appendFileSync(filePath, line, 'utf-8')
  } catch (error) {
    console.error(`[Ask 消息] 追加失败 (${agentSessionId}):`, error)
    throw new Error('追加 Ask 消息失败')
  }
}

/**
 * 覆盖式重写整条 JSONL（用于删除/截断场景，P1 用）
 */
export function rewriteAskMessages(agentSessionId: string, messages: AskMessage[]): void {
  const filePath = getAgentSessionAskMessagesPath(agentSessionId)
  const content = messages.length > 0
    ? messages.map((m) => JSON.stringify(m)).join('\n') + '\n'
    : ''

  try {
    writeFileSync(filePath, content, 'utf-8')
  } catch (error) {
    console.error(`[Ask 消息] 重写失败 (${agentSessionId}):`, error)
    throw new Error('重写 Ask 消息失败')
  }
}

/**
 * 删除单条 Ask 消息（P1 留位）
 *
 * 浅拷贝 messages → 过滤掉目标 id → 写回。
 */
export function deleteAskMessage(agentSessionId: string, messageId: string): AskMessage[] {
  const all = getAgentSessionAskMessages(agentSessionId)
  const next = all.filter((m) => m.id !== messageId)
  if (next.length !== all.length) {
    rewriteAskMessages(agentSessionId, next)
  }
  return next
}

/**
 * 删除会话的 Ask 消息文件（删除 Agent 会话时清理）
 */
export function deleteAskMessagesFile(agentSessionId: string): void {
  const filePath = getAgentSessionAskMessagesPath(agentSessionId)
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch (error) {
      console.warn(`[Ask 消息] 删除文件失败 (${agentSessionId}):`, error)
    }
  }
}
