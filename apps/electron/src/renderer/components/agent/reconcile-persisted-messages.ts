/**
 * 会话消息刷新时的乐观用户气泡调和
 *
 * 发送后立刻写入本地的用户消息可能尚未落盘；此时若 bumpRefresh / 切回会话
 * 用磁盘快照覆盖本地，会出现「running 动画在、用户气泡没了」。
 */

import type { SDKMessage } from '@tagent/shared'

interface OptimisticUserFields {
  type?: string
  uuid?: string
  _optimistic?: boolean
  message?: { content?: unknown }
  parent_tool_use_id?: string | null
}

function asOptimistic(message: SDKMessage): OptimisticUserFields {
  return message as unknown as OptimisticUserFields
}

/** 提取用户消息纯文本（仅 text block） */
export function extractUserMessageText(message: SDKMessage): string {
  const content = asOptimistic(message).message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (!block || typeof block !== 'object') return ''
      const record = block as { type?: unknown; text?: unknown }
      return record.type === 'text' && typeof record.text === 'string' ? record.text : ''
    })
    .join('')
}

export function isOptimisticUserMessage(message: SDKMessage): boolean {
  const record = asOptimistic(message)
  return record.type === 'user' && record._optimistic === true && record.parent_tool_use_id == null
}

function diskHasMatchingUserMessage(diskMessages: SDKMessage[], optimistic: SDKMessage): boolean {
  const opt = asOptimistic(optimistic)
  const optText = extractUserMessageText(optimistic)
  for (let i = diskMessages.length - 1; i >= 0; i--) {
    const disk = diskMessages[i]!
    const diskRecord = asOptimistic(disk)
    if (diskRecord.type !== 'user' || diskRecord.parent_tool_use_id != null) continue
    if (opt.uuid && diskRecord.uuid && opt.uuid === diskRecord.uuid) return true
    if (optText && extractUserMessageText(disk) === optText) return true
    // 只检查尾部连续用户消息；遇到非 user 就停止
    break
  }
  return false
}

/**
 * 正在运行/等待后台任务时：保留尚未出现在磁盘快照中的本地乐观用户气泡。
 * 空闲刷新时：完全信任磁盘。
 */
export function reconcilePersistedMessagesOnReload(params: {
  diskMessages: SDKMessage[]
  localMessages: SDKMessage[]
  preserveOptimistic: boolean
}): SDKMessage[] {
  const { diskMessages, localMessages, preserveOptimistic } = params
  if (!preserveOptimistic) return diskMessages

  const trailingOptimistic: SDKMessage[] = []
  for (let i = localMessages.length - 1; i >= 0; i--) {
    const message = localMessages[i]!
    if (!isOptimisticUserMessage(message)) break
    trailingOptimistic.unshift(message)
  }
  if (trailingOptimistic.length === 0) return diskMessages

  const missing = trailingOptimistic.filter(
    (message) => !diskHasMatchingUserMessage(diskMessages, message)
  )
  if (missing.length === 0) return diskMessages
  return [...diskMessages, ...missing]
}
