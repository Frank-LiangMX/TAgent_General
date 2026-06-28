import { useAtomValue } from 'jotai'

import { resolveAgentSessionModelId } from '@tagent/shared'

import {
  agentChannelIdAtom,
  agentModelIdAtom,
  agentSessionChannelMapAtom,
  agentSessionModelMapAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/model-atoms'

import type { Channel } from '@tagent/shared'

interface AgentSessionChannelModel {
  channelId: string | null
  channel: Channel | undefined
  modelId: string | undefined
}

/** 解析 Agent 会话的渠道与模型（会话 map > 渠道默认 > 旧版全局 settings） */
export function useAgentSessionChannelModel(sessionId: string): AgentSessionChannelModel {
  const sessionChannelMap = useAtomValue(agentSessionChannelMapAtom)
  const sessionModelMap = useAtomValue(agentSessionModelMapAtom)
  const defaultChannelId = useAtomValue(agentChannelIdAtom)
  const legacyGlobalModelId = useAtomValue(agentModelIdAtom)
  const channels = useAtomValue(channelsAtom)

  const channelId = sessionChannelMap.get(sessionId) ?? defaultChannelId ?? null
  const channel = channelId
    ? channels.find((c) => c.id === channelId && c.enabled)
    : undefined
  const modelId = resolveAgentSessionModelId(
    channel,
    sessionModelMap.get(sessionId),
    legacyGlobalModelId
  )

  return { channelId, channel, modelId }
}
