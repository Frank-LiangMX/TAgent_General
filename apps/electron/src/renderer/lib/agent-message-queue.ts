import type { QuotedSelection } from '@/atoms/preview-atoms'

export type QueueDropPlacement = 'before' | 'after'

export interface AgentQueuedAttachment {
  filename: string
  mediaType: string
  size: number
  targetPath: string
}

export interface AgentQueuedMessage {
  id: string
  text: string
  createdAt: number
  quotedSelection?: QuotedSelection
  fileReferenceBlock?: string
  attachments?: AgentQueuedAttachment[]
  additionalDirectories?: string[]
}

export function createAgentQueuedMessage(
  text: string,
  id: string,
  createdAt: number,
  quotedSelection?: QuotedSelection | null,
  options?: {
    fileReferenceBlock?: string
    attachments?: AgentQueuedAttachment[]
    additionalDirectories?: string[]
  }
): AgentQueuedMessage {
  const message: AgentQueuedMessage = {
    id,
    text: text.trim(),
    createdAt,
  }
  if (quotedSelection) message.quotedSelection = quotedSelection
  if (options?.fileReferenceBlock) message.fileReferenceBlock = options.fileReferenceBlock
  if (options?.attachments && options.attachments.length > 0)
    message.attachments = options.attachments
  if (options?.additionalDirectories && options.additionalDirectories.length > 0)
    message.additionalDirectories = options.additionalDirectories
  return message
}

export function removeQueuedMessage(
  queue: AgentQueuedMessage[],
  messageId: string
): AgentQueuedMessage[] {
  return queue.filter((item) => item.id !== messageId)
}

export function restoreQueuedMessageToFront(
  queue: AgentQueuedMessage[],
  message: AgentQueuedMessage
): AgentQueuedMessage[] {
  if (queue.some((item) => item.id === message.id)) return queue
  return [message, ...queue]
}

export function moveQueuedMessage(
  queue: AgentQueuedMessage[],
  sourceId: string,
  targetId: string,
  placement: QueueDropPlacement
): AgentQueuedMessage[] {
  if (sourceId === targetId) return queue
  const source = queue.find((item) => item.id === sourceId)
  if (!source) return queue
  const withoutSource = queue.filter((item) => item.id !== sourceId)
  const targetIndex = withoutSource.findIndex((item) => item.id === targetId)
  if (targetIndex === -1) return queue
  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex
  return [...withoutSource.slice(0, insertIndex), source, ...withoutSource.slice(insertIndex)]
}

const REF_PATTERN = /\/skill:(?<skill>\S+)|#mcp:(?<mcp>\S+)|&session:(?<session>\S+)/g

export interface ParsedQueuedMessageMentions {
  cleanedText: string
  mentionedSkills: string[]
  mentionedMcpServers: string[]
  mentionedSessionIds: string[]
}

export function parseQueuedMessageMentions(text: string): ParsedQueuedMessageMentions {
  const mentionedSkills: string[] = []
  const mentionedMcpServers: string[] = []
  const mentionedSessionIds: string[] = []
  for (const match of text.matchAll(REF_PATTERN)) {
    const { skill, mcp, session } = match.groups ?? {}
    if (skill) mentionedSkills.push(skill)
    else if (mcp) mentionedMcpServers.push(mcp)
    else if (session) mentionedSessionIds.push(session)
  }
  return {
    cleanedText: text.replace(REF_PATTERN, '').trim(),
    mentionedSkills,
    mentionedMcpServers,
    mentionedSessionIds,
  }
}

export interface QueuedMessageSendPayload {
  rawText: string
  sdkText: string
  mentions: ParsedQueuedMessageMentions
}

export function buildQueuedMessageSendPayload(
  message: AgentQueuedMessage,
  quotedSelectionBlock = ''
): QueuedMessageSendPayload {
  const text = message.text.trim()
  const mentions = parseQueuedMessageMentions(text)
  const contextBlocks = [message.fileReferenceBlock?.trim(), quotedSelectionBlock.trim()].filter(
    (block): block is string => Boolean(block)
  )
  const prefix = contextBlocks.length > 0 ? `${contextBlocks.join('\n\n')}\n\n` : ''
  return {
    rawText: `${prefix}${text}`.trim(),
    sdkText: `${prefix}${mentions.cleanedText}`.trim(),
    mentions,
  }
}
