/**
 * RightPanelRail — 右侧竖向按钮列（镜像左侧 FunctionalRail）
 *
 * 包含文件面板按钮和侧面提问（btw）按钮。
 * 点击文件按钮切换会话面板（RightSidePanel）展开/折叠。
 * 点击 btw 按钮打开侧面提问面板。
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { FolderOpen, MessageCircle, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import {
  agentDiffUnseenChangesAtom,
  agentDiffUnseenFilesAtom,
  agentSidePanelOpenAtom,
  currentAgentSessionIdAtom,
} from '@/atoms/agent-atoms'
import {
  btwOpenAtom,
  btwMessagesAtom,
  btwChannelIdAtom,
  btwModelIdAtom,
  btwSourceSessionIdAtom,
} from '@/atoms/btw-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import { useAgentSessionChannelModel } from '@/hooks/useAgentSessionChannelModel'
import { detectIsMac } from '@/lib/platform'
import { registerShortcut } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

interface RightPanelRailProps {
  /** 面板当前是否展开（控制 active 高亮） */
  panelOpen: boolean
  className?: string
}

const RAIL_ICON: LucideIcon = FolderOpen
const BTW_ICON: LucideIcon = MessageCircle

export function RightPanelRail({ panelOpen, className }: RightPanelRailProps): React.ReactElement {
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const setPanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const unseenChangesMap = useAtomValue(agentDiffUnseenChangesAtom)
  const unseenFilesMap = useAtomValue(agentDiffUnseenFilesAtom)
  const isMac = React.useMemo(() => detectIsMac(), [])

  const unseenChanges = currentSessionId ? (unseenChangesMap.get(currentSessionId) ?? false) : false
  const unseenFilesCount = currentSessionId ? (unseenFilesMap.get(currentSessionId)?.size ?? 0) : 0
  const showBadge = !panelOpen && (unseenChanges || unseenFilesCount > 0)

  const togglePanel = React.useCallback(() => {
    setPanelOpen((open) => !open)
  }, [setPanelOpen])

  React.useEffect(() => {
    return registerShortcut('toggle-right-panel', togglePanel)
  }, [togglePanel])

  // ===== BTW 按钮 =====
  const [btwOpen, setBtwOpen] = useAtom(btwOpenAtom)
  const setBtwMessages = useSetAtom(btwMessagesAtom)
  const setBtwChannelId = useSetAtom(btwChannelIdAtom)
  const setBtwModelId = useSetAtom(btwModelIdAtom)
  const setBtwSourceSessionId = useSetAtom(btwSourceSessionIdAtom)
  const channels = useAtomValue(channelsAtom)

  // 获取当前会话的渠道和模型
  const { channelId, modelId } = useAgentSessionChannelModel(currentSessionId ?? '')

  // 检查是否有可用的渠道
  const hasChannel = React.useMemo(() => {
    if (!channelId) return false
    const ch = channels.find((c) => c.id === channelId)
    return ch?.enabled && ch.models.some((m) => m.enabled)
  }, [channels, channelId])

  const handleBtwClick = React.useCallback(() => {
    setBtwMessages([])
    if (channelId) setBtwChannelId(channelId)
    if (modelId) setBtwModelId(modelId)
    if (currentSessionId) setBtwSourceSessionId(currentSessionId)
    setBtwOpen(true)
  }, [channelId, modelId, currentSessionId, setBtwMessages, setBtwChannelId, setBtwModelId, setBtwSourceSessionId, setBtwOpen])

  return (
    <div
      className={cn(
        'nav-island-rail right-panel-rail relative z-[1] h-full flex flex-col items-center px-1.5 pb-2 shrink-0',
        !panelOpen && showBadge && 'right-panel-rail--notify',
        className
      )}
    >
      {!isMac ? <div className="w-full shrink-0 h-[30px]" aria-hidden /> : null}
      <div className="nav-island-body-start w-full flex flex-col items-center">
        <div className="rail-slide-host relative flex flex-col items-center gap-1 w-full">
          {/* 文件面板按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={togglePanel}
                aria-pressed={panelOpen}
                aria-label="文件面板"
                className={cn(
                  'rail-island-btn size-8 flex items-center justify-center rounded-[9px] titlebar-no-drag relative z-[2]',
                  panelOpen && 'rail-island-btn--active rail-island-btn--ghost'
                )}
              >
                <RAIL_ICON size={12} strokeWidth={1.75} />
                {showBadge && (
                  <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-primary ring-1 ring-background" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <div className="text-xs">
                <div className="font-medium">文件面板</div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* 侧面提问（btw）按钮 */}
          {hasChannel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleBtwClick}
                  aria-pressed={btwOpen}
                  aria-label="侧面提问"
                  className={cn(
                    'rail-island-btn size-8 flex items-center justify-center rounded-[9px] titlebar-no-drag relative z-[2]',
                    btwOpen && 'rail-island-btn--active rail-island-btn--ghost'
                  )}
                >
                  <BTW_ICON size={12} strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <div className="text-xs">
                  <div className="font-medium">旁注</div>
                  <div className="text-muted-foreground">快速提问，不进入主对话历史</div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0" />
    </div>
  )
}
