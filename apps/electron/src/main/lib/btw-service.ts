/**
 * Btw Service - �������ʷ���
 *
 * ������Ȼ���� BTW ������ IPC Э�飺
 * - `text`
 * - `complete`
 * - `error`
 *
 * ���ײ㲻��ֱ�� provider SSE�����Ǹ��� Agent runtime��
 * - ����Դ�Ựʱ���� fork ������ Agent �Ự���̳� Claude Code SDK / kscc ����
 * - ����Դ�Ựʱ�˻�Ϊ��ʱ Agent �Ự
 * - ֻ�ŽӴ��ı��������͸�����ߵ��á�˼�����̵��м��¼�
 */

import { BTW_IPC_CHANNELS } from '@tagent/shared'

import type { AgentSendInput, AgentStreamPayload, ChatMessage, SDKMessage } from '@tagent/shared'
import {
  createAgentSession,
  forkAgentSession,
  getAgentSessionMeta,
  updateAgentSessionMeta,
} from './agent-session-manager'
import {
  agentEventBus,
  getMainRendererWebContents,
  runAgentHeadless,
  stopAgent,
} from './agent-service'

/** ��ǰ��Ծ�� BTW ����̬ */
interface ActiveBtwRun {
  cancelled: boolean
  forkSessionId: string
  messageId: string
  unsubscribe: () => void
}

/** ��ǰ��Ծ BTW */
let activeBtwRun: ActiveBtwRun | null = null

// ===== SDKMessage -> ChatMessage ת������������ ask-service ���ã� =====

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
      parts.push(`[thinking: ${b.thinking}]`)
    } else if (b.type === 'tool_use' && typeof b.name === 'string') {
      parts.push(`[���ù��� ${b.name}]`)
    }
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
  }
  return parts.join('\n')
}

/**
 * �����Ự SDKMessage[] ת���� ChatMessage[]����Ϊ btw ����� history��
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
    if (m.parent_tool_use_id != null) continue
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

  const merged: typeof raw = []
  for (const item of raw) {
    const last = merged[merged.length - 1]
    if (last && last.role === item.role) {
      last.content = `${last.content}\n${item.content}`
    } else {
      merged.push({ ...item })
    }
  }

  const tail = merged.slice(-maxTurns * 2)

  return tail.map((item, idx) => ({
    id: item.uuid ? `sdk-${item.uuid}` : `sdk-idx-${idx}`,
    role: item.role,
    content: item.content,
    createdAt: item.createdAt,
  }))
}

function getBtwRenderer() {
  const webContents = getMainRendererWebContents()
  if (!webContents || webContents.isDestroyed()) {
    throw new Error('�������ѹر�')
  }
  return webContents
}

function emitBtwEvent(event: Record<string, unknown>): void {
  const webContents = getBtwRenderer()
  webContents.send(BTW_IPC_CHANNELS.BTW_EVENT, event)
}

function cleanupActiveRun(run: ActiveBtwRun | null): void {
  if (!run) return
  try {
    run.unsubscribe()
  } catch {
    // ignore cleanup errors
  }
  if (activeBtwRun === run) {
    activeBtwRun = null
  }
}

async function createBtwSession(input: {
  channelId: string
  modelId: string
  sourceSessionId?: string
}): Promise<string> {
  const { channelId, modelId, sourceSessionId } = input

  if (sourceSessionId) {
    const sourceMeta = getAgentSessionMeta(sourceSessionId)
    if (!sourceMeta) {
      throw new Error(`��Դ�Ự������: ${sourceSessionId}`)
    }

    const forked = await forkAgentSession({ sessionId: sourceSessionId })
    updateAgentSessionMeta(forked.id, {
      title: `${sourceMeta.title} (btw)`,
      channelId,
      modelId,
      archived: true,
    })
    return forked.id
  }

  const temp = createAgentSession('BTW', channelId, undefined, 'general', modelId)
  updateAgentSessionMeta(temp.id, {
    channelId,
    modelId,
    archived: true,
  })
  return temp.id
}

function bridgeAgentPayloadToBtw(
  payload: AgentStreamPayload,
  messageId: string,
  run: ActiveBtwRun
): void {
  if (run.cancelled) return
  if (payload.kind !== 'stream_text_delta') return
  if (!payload.text) return

  emitBtwEvent({
    type: 'text',
    messageId,
    text: payload.text,
  })
}

/**
 * ���Ͳ�������
 */
export async function sendBtwMessage(input: {
  channelId: string
  modelId: string
  message: string
  messageId: string
  /** ���Ự ID������ fork ���Ự�����ģ� */
  sourceSessionId?: string
  /** ��������������ǰ�ӿڱ������ײ��Ѹ�Ϊ fork������ֱ�����ѣ� */
  contextTurns?: number
}): Promise<void> {
  const { channelId, modelId, message, messageId, sourceSessionId } = input

  if (activeBtwRun) {
    cancelBtw()
  }

  // ��ȷ�������ڻ����ţ����ⴴ�����¶� fork �Ự
  getBtwRenderer()

  let run: ActiveBtwRun | null = null

  try {
    const forkSessionId = await createBtwSession({ channelId, modelId, sourceSessionId })
    const sessionMeta = getAgentSessionMeta(forkSessionId)

    if (!sessionMeta) {
      throw new Error(`BTW fork �Ự������: ${forkSessionId}`)
    }

    const unsubscribe = agentEventBus.on((sessionId, payload) => {
      if (!run || sessionId !== forkSessionId) return
      bridgeAgentPayloadToBtw(payload, messageId, run)
    })

    run = {
      cancelled: false,
      forkSessionId,
      messageId,
      unsubscribe,
    }
    activeBtwRun = run

    const agentInput: AgentSendInput = {
      sessionId: forkSessionId,
      userMessage: message,
      channelId,
      modelId,
      workspaceId: sessionMeta.workspaceId,
      startedAt: Date.now(),
    }

    await runAgentHeadless(agentInput, {
      source: 'bridge',
      onTitleUpdated: () => {
        // BTW ��岻���� fork �Ự����
      },
      onError: (error) => {
        if (!run || run.cancelled) return
        emitBtwEvent({
          type: 'error',
          messageId,
          error,
        })
      },
      onComplete: () => {
        if (!run || run.cancelled) return
        emitBtwEvent({
          type: 'complete',
          messageId,
        })
      },
    })
  } catch (error) {
    if (run?.cancelled || (error as Error).name === 'AbortError') {
      return
    }

    emitBtwEvent({
      type: 'error',
      messageId,
      error: error instanceof Error ? error.message : 'δ֪����',
    })
    throw error
  } finally {
    cleanupActiveRun(run)
  }
}

/**
 * ȡ����������
 */
export function cancelBtw(): void {
  if (!activeBtwRun) return

  activeBtwRun.cancelled = true
  stopAgent(activeBtwRun.forkSessionId)
  cleanupActiveRun(activeBtwRun)
}
