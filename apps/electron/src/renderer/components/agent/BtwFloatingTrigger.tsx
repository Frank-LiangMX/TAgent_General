/**
 * BtwFloatingTrigger - 侧面提问悬浮触发按钮
 *
 * 嵌在主输入框右上角，绝对定位浮出。
 * Normal 状态：圆形图标按钮；Hover 状态：展开显示"旁注"文字。
 *
 * 使用方式：作为 AgentView 主输入框容器的子元素渲染，
 * 父容器需要 `position: relative`。
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { MessageCircle } from 'lucide-react'
import * as React from 'react'

import { useAgentSessionChannelModel } from '@/hooks/useAgentSessionChannelModel'
import {
  btwOpenAtom,
  btwMessagesAtom,
  btwChannelIdAtom,
  btwModelIdAtom,
  btwSourceSessionIdAtom,
} from '@/atoms/btw-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface BtwFloatingTriggerProps {
  /** 当前会话 ID */
  sessionId: string
  /** 是否正在流式输出 */
  streaming?: boolean
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
  const { channelId, modelId } = useAgentSessionChannelModel(sessionId)
  const channels = useAtomValue(channelsAtom)

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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'group inline-flex items-center justify-center rounded-full shrink-0',
            'bg-muted/50 hover:bg-muted/70',
            'text-foreground/50 hover:text-foreground/70',
            'transition-all duration-200 ease-out',
            // 默认圆形仅图标；hover 展开文字（文字用 hidden 避免挤偏图标居中）
            'size-[28px] hover:w-auto hover:min-w-[28px] hover:justify-start hover:px-2 hover:gap-1.5'
          )}
        >
          <MessageCircle size={14} className="shrink-0" aria-hidden />
          <span className="hidden text-[11px] leading-none whitespace-nowrap group-hover:inline">
            旁注
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px]">旁注：快速提问，不进入主对话历史</TooltipContent>
    </Tooltip>
  )
}
