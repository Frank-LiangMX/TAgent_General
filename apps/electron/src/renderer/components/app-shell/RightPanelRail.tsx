/**
 * RightPanelRail — 右侧竖向按钮列（镜像左侧 FunctionalRail）
 *
 * 包含文件面板按钮和旁注（btw）按钮。
 * 点击按钮切换 rightRailItemAtom，右侧边栏根据状态显示对应面板。
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { FolderOpen, MessageCircle, Globe2, Palette, Users, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import {
  agentDiffUnseenChangesAtom,
  agentDiffUnseenFilesAtom,
  agentSidePanelOpenAtom,
  currentAgentSessionIdAtom,
} from '@/atoms/agent-atoms'
import { btwChannelIdAtom, btwModelIdAtom, btwSourceSessionIdAtom } from '@/atoms/btw-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import { rightRailItemAtom } from '@/atoms/app-mode'
import { sessionCrewBoardIdAtomFamily, useKanbanBoardById } from '@/atoms/kanban-atoms'
import { useAgentSessionChannelModel } from '@/hooks/useAgentSessionChannelModel'
import { registerShortcut } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

interface RightPanelRailProps {
  /** 面板当前是否展开（控制 active 高亮） */
  panelOpen: boolean
  className?: string
}

const RAIL_ICON: LucideIcon = FolderOpen
const BTW_ICON: LucideIcon = MessageCircle
const BROWSER_ICON: LucideIcon = Globe2
const DESIGN_ICON: LucideIcon = Palette
const CREW_ICON: LucideIcon = Users

export function RightPanelRail({ panelOpen, className }: RightPanelRailProps): React.ReactElement {
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const setPanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const unseenChangesMap = useAtomValue(agentDiffUnseenChangesAtom)
  const unseenFilesMap = useAtomValue(agentDiffUnseenFilesAtom)

  const unseenChanges = currentSessionId ? (unseenChangesMap.get(currentSessionId) ?? false) : false
  const unseenFilesCount = currentSessionId ? (unseenFilesMap.get(currentSessionId)?.size ?? 0) : 0
  const showBadge = !panelOpen && (unseenChanges || unseenFilesCount > 0)

  // 右侧 Rail 切换逻辑（镜像左侧）
  const [rightRailItem, setRightRailItem] = useAtom(rightRailItemAtom)
  const setBtwChannelId = useSetAtom(btwChannelIdAtom)
  const setBtwModelId = useSetAtom(btwModelIdAtom)
  const setBtwSourceSessionId = useSetAtom(btwSourceSessionIdAtom)
  const channels = useAtomValue(channelsAtom)

  // 获取当前会话的渠道和模型
  const { channelId, modelId } = useAgentSessionChannelModel(currentSessionId ?? '')
  const isFilesActive = panelOpen && rightRailItem === 'files'
  const isBtwActive = panelOpen && rightRailItem === 'btw'
  const isBrowserActive = panelOpen && rightRailItem === 'browser'
  const isDesignActive = panelOpen && rightRailItem === 'design'
  const isCrewActive = panelOpen && rightRailItem === 'crew'

  // 班组角标：含工人 parentBoardId；忙碌/求助中时提示（面板已打开班组时不显示）
  const crewBoardId = useAtomValue(sessionCrewBoardIdAtomFamily(currentSessionId ?? ''))
  const { tasks: crewTasks } = useKanbanBoardById(crewBoardId)
  const showCrewBadge =
    !!crewBoardId &&
    !isCrewActive &&
    crewTasks.some((t) => t.status === 'running' || t.status === 'blocked')
  // 检查是否有可用的渠道
  const hasChannel = React.useMemo(() => {
    if (!channelId) return false
    const ch = channels.find((c) => c.id === channelId)
    return ch?.enabled && ch.models.some((m) => m.enabled)
  }, [channels, channelId])

  const togglePanel = React.useCallback(() => {
    if (panelOpen && rightRailItem === 'files') {
      // 文件面板已打开且当前是文件 → 折叠
      setPanelOpen(false)
    } else {
      // 其他情况 → 切换到文件面板并打开
      setRightRailItem('files')
      setPanelOpen(true)
    }
  }, [setPanelOpen, panelOpen, rightRailItem, setRightRailItem])

  React.useEffect(() => {
    return registerShortcut('toggle-right-panel', togglePanel)
  }, [togglePanel])

  const handleBtwClick = React.useCallback(() => {
    if (panelOpen && rightRailItem === 'btw') {
      // btw 面板已打开且当前是 btw → 折叠
      setPanelOpen(false)
    } else {
      // 其他情况 → 切换到 btw 面板并打开
      setRightRailItem('btw')
      if (channelId) setBtwChannelId(channelId)
      if (modelId) setBtwModelId(modelId)
      if (currentSessionId) setBtwSourceSessionId(currentSessionId)
      setPanelOpen(true)
    }
  }, [
    panelOpen,
    rightRailItem,
    channelId,
    modelId,
    currentSessionId,
    setRightRailItem,
    setBtwChannelId,
    setBtwModelId,
    setBtwSourceSessionId,
    setPanelOpen,
  ])

  const handleBrowserClick = React.useCallback(() => {
    if (panelOpen && rightRailItem === 'browser') {
      // 浏览器面板已打开且当前是浏览器 → 折叠
      setPanelOpen(false)
    } else {
      // 其他情况 → 切换到浏览器面板并打开
      setRightRailItem('browser')
      setPanelOpen(true)
    }
  }, [panelOpen, rightRailItem, setRightRailItem, setPanelOpen])

  const handleDesignClick = React.useCallback(() => {
    if (panelOpen && rightRailItem === 'design') {
      // Design 面板已打开且当前是 Design → 折叠
      setPanelOpen(false)
    } else {
      // 其他情况 → 切换到 Design 面板并打开
      setRightRailItem('design')
      setPanelOpen(true)
    }
  }, [panelOpen, rightRailItem, setRightRailItem, setPanelOpen])

  const handleCrewClick = React.useCallback(() => {
    if (panelOpen && rightRailItem === 'crew') {
      setPanelOpen(false)
    } else {
      setRightRailItem('crew')
      setPanelOpen(true)
    }
  }, [panelOpen, rightRailItem, setRightRailItem, setPanelOpen])

  return (
    <div
      className={cn(
        'nav-island-rail right-panel-rail relative z-[1] flex h-full shrink-0 flex-col items-center pb-2',
        !panelOpen && 'right-panel-rail--collapsed',
        !panelOpen && showBadge && 'right-panel-rail--notify',
        className
      )}
    >
      <div className="nav-island-body-start flex w-full flex-col items-center">
        <div className="rail-slide-host relative flex w-full flex-col items-center gap-1">
          {/* 文件面板按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={togglePanel}
                aria-pressed={isFilesActive}
                aria-label="文件面板"
                className={cn(
                  'rail-island-btn right-rail-btn size-8 flex items-center justify-center titlebar-no-drag relative z-[2]',
                  isFilesActive && 'rail-island-btn--active'
                )}
              >
                <RAIL_ICON size={14} strokeWidth={1.75} />
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

          {/* 旁注（btw）按钮 */}
          {hasChannel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleBtwClick}
                  aria-pressed={isBtwActive}
                  aria-label="旁注"
                  className={cn(
                    'rail-island-btn right-rail-btn size-8 flex items-center justify-center titlebar-no-drag relative z-[2]',
                    isBtwActive && 'rail-island-btn--active'
                  )}
                >
                  <BTW_ICON size={14} strokeWidth={1.75} />
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

          {/* 浏览器预览按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleBrowserClick}
                aria-pressed={isBrowserActive}
                aria-label="浏览器预览"
                className={cn(
                  'rail-island-btn right-rail-btn size-8 flex items-center justify-center titlebar-no-drag relative z-[2]',
                  isBrowserActive && 'rail-island-btn--active'
                )}
              >
                <BROWSER_ICON size={14} strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <div className="text-xs">
                <div className="font-medium">预览</div>
                <div className="text-muted-foreground">预览 WPS 文档或网页</div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Design Preview 按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleDesignClick}
                aria-pressed={isDesignActive}
                aria-label="Design Preview"
                className={cn(
                  'rail-island-btn right-rail-btn size-8 flex items-center justify-center titlebar-no-drag relative z-[2]',
                  isDesignActive && 'rail-island-btn--active'
                )}
              >
                <DESIGN_ICON size={14} strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <div className="text-xs">
                <div className="font-medium">Design Preview</div>
                <div className="text-muted-foreground">AI 生成 UI 原型的即时预览</div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* 班组墙（数字员工队列） */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleCrewClick}
                aria-pressed={isCrewActive}
                aria-label="班组"
                className={cn(
                  'rail-island-btn right-rail-btn size-8 flex items-center justify-center titlebar-no-drag relative z-[2]',
                  isCrewActive && 'rail-island-btn--active'
                )}
              >
                <CREW_ICON size={14} strokeWidth={1.75} />
                {showCrewBadge && (
                  <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber-500 ring-1 ring-background" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <div className="text-xs">
                <div className="font-medium">班组</div>
                <div className="text-muted-foreground">本会话数字员工与派活进度</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1" />
    </div>
  )
}
