/**
 * RightPanelRail — 右侧竖向按钮列（镜像左侧 FunctionalRail）
 *
 * 单个文件夹图标按钮，点击切换会话面板（RightSidePanel）展开/折叠。
 * 面板内部的 tab 切换（项目文件/文件活动/代码改动）由 DiffPanelTabBar 接管。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { FolderOpen, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import {
  agentDiffUnseenChangesAtom,
  agentDiffUnseenFilesAtom,
  agentSidePanelOpenAtom,
  currentAgentSessionIdAtom,
} from '@/atoms/agent-atoms'
import { detectIsMac } from '@/lib/platform'
import { registerShortcut } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

interface RightPanelRailProps {
  /** 面板当前是否展开（控制 active 高亮） */
  panelOpen: boolean
  className?: string
}

const RAIL_ICON: LucideIcon = FolderOpen

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
        </div>
      </div>

      <div className="flex-1 min-h-0" />
    </div>
  )
}
