/**
 * BtwFloatingTrigger - 侧面提问悬浮触发按钮
 *
 * 嵌在主输入框右上角，绝对定位浮出。
 * 主输入框获取焦点时按钮淡出让位（不打扰打字）。
 *
 * 使用方式：作为 AgentView 主输入框容器的子元素渲染，
 * 父容器需要 `position: relative`。
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { MessageCircle } from 'lucide-react'
import * as React from 'react'

import {
  btwOpenAtom,
  btwMessagesAtom,
  btwChannelIdAtom,
  btwModelIdAtom,
  btwSourceSessionIdAtom,
} from '@/atoms/btw-atoms'
import {
  agentChannelIdAtom,
  agentModelIdAtom,
  agentSessionChannelMapAtom,
  agentSessionModelMapAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface BtwFloatingTriggerProps {
  /** 当前会话 ID */
  sessionId: string
  /** 是否正在流式输出（保留参数以备未来用） */
  streaming: boolean
}

export function BtwFloatingTrigger({
  sessionId,
}: BtwFloatingTriggerProps): React.ReactElement | null {
  const [open, setOpen] = useAtom(btwOpenAtom)
  const setMessages = useSetAtom(btwMessagesAtom)
  const setBtwChannelId = useSetAtom(btwChannelIdAtom)
  const setBtwModelId = useSetAtom(btwModelIdAtom)
  const setBtwSourceSessionId = useSetAtom(btwSourceSessionIdAtom)

  // 获取当前会话的渠道和模型
  const sessionChannelMap = useAtomValue(agentSessionChannelMapAtom)
  const sessionModelMap = useAtomValue(agentSessionModelMapAtom)
  const defaultChannelId = useAtomValue(agentChannelIdAtom)
  const defaultModelId = useAtomValue(agentModelIdAtom)
  const channels = useAtomValue(channelsAtom)

  const channelId = sessionChannelMap.get(sessionId) ?? defaultChannelId
  const modelId = sessionModelMap.get(sessionId) ?? defaultModelId

  // 检查是否有可用的渠道
  const hasChannel = React.useMemo(() => {
    if (!channelId) return false
    const ch = channels.find((c) => c.id === channelId)
    return ch?.enabled && ch.models.some((m) => m.enabled)
  }, [channels, channelId])

  // 不显示条件：面板已打开 / 无渠道
  if (open) return null
  if (!hasChannel) return null

  const handleClick = () => {
    setMessages([])
    if (channelId) setBtwChannelId(channelId)
    if (modelId) setBtwModelId(modelId)
    setBtwSourceSessionId(sessionId)
    setOpen(true)
  }

  return (
    <div
      className={cn(
        'transition-all duration-300',
        open && 'opacity-0 scale-90 pointer-events-none'  /* 面板打开时缩小淡出 */
      )}
      style={{
        transitionTimingFunction: open ? 'cubic-bezier(0.4, 0, 0.2, 1)' : 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            className={cn(
              'gap-1.5 h-6 px-2.5 rounded-md',
              'session-glass session-glass-chip session-glass-chip-dashed',
              'text-foreground/55 dark:text-foreground/68 hover:text-primary',
              'shadow-none hover:shadow-sm',
              'transition-all duration-200'
            )}
          >
            <MessageCircle size={12} />
            <span className="text-[11px]">旁注</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="text-xs">
            快速提问，不进入主对话历史
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}