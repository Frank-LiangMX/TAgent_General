/**
 * RightPanelRail — 右侧竖向按钮列（参考 Kun WorkbenchSideRail）
 *
 * 永远可见的细条按钮列，点击切换右侧面板内容：
 * - 项目文件 / 文件活动 / 代码改动
 * - 点同一按钮再点收起面板，按钮列保留
 * - active 高亮 + 未读 badge
 *
 * 替代原 RightPanelToggle（顶部小按钮）+ DiffPanelTabBar（面板内 tab 栏）。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { FolderOpen, Activity, FileEdit } from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import {
  agentDiffUnseenChangesAtom,
  agentDiffUnseenFilesAtom,
  agentSidePanelOpenAtom,
  currentAgentSessionIdAtom,
  agentDiffPanelTabAtom,
} from '@/atoms/agent-atoms'
import { registerShortcut } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

type RailTab = 'project' | 'activity' | 'changes'

interface RailItem {
  tab: RailTab
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const RAIL_ITEMS: readonly RailItem[] = [
  { tab: 'project', label: '项目文件', Icon: FolderOpen },
  { tab: 'activity', label: '文件活动', Icon: Activity },
  { tab: 'changes', label: '代码改动', Icon: FileEdit },
]

interface RightPanelRailProps {
  /** 面板当前是否展开（控制 active 高亮） */
  panelOpen: boolean
  className?: string
}

export function RightPanelRail({ panelOpen, className }: RightPanelRailProps): React.ReactElement {
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const diffPanelTabMap = useAtomValue(agentDiffPanelTabAtom)
  const setDiffPanelTabMap = useSetAtom(agentDiffPanelTabAtom)
  const setPanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const unseenChangesMap = useAtomValue(agentDiffUnseenChangesAtom)
  const unseenFilesMap = useAtomValue(agentDiffUnseenFilesAtom)

  const activeTab = currentSessionId
    ? (diffPanelTabMap.get(currentSessionId) ?? 'project')
    : 'project'

  const unseenChanges = currentSessionId ? (unseenChangesMap.get(currentSessionId) ?? false) : false
  const unseenFilesCount = currentSessionId ? (unseenFilesMap.get(currentSessionId)?.size ?? 0) : 0

  const setTab = React.useCallback(
    (tab: RailTab) => {
      if (!currentSessionId) return
      // 同 tab 再点 → 收起面板；不同 tab → 切换 + 确保面板展开
      const isSameTabAndOpen = panelOpen && activeTab === tab
      if (isSameTabAndOpen) {
        setPanelOpen(false)
        return
      }
      setDiffPanelTabMap((prev) => {
        const next = new Map(prev)
        next.set(currentSessionId, tab)
        return next
      })
      setPanelOpen(true)
    },
    [currentSessionId, panelOpen, activeTab, setDiffPanelTabMap, setPanelOpen]
  )

  // ⌘⇧B / Ctrl+Shift+B 快捷键：切换项目文件面板（沿用原 RightPanelToggle 行为）
  const toggleProject = React.useCallback(() => {
    setTab('project')
  }, [setTab])

  React.useEffect(() => {
    return registerShortcut('toggle-right-panel', toggleProject)
  }, [toggleProject])

  return (
    <div
      className={cn(
        'right-panel-rail nav-island-glass nav-island-glass--float',
        'flex flex-col items-center gap-1 px-1 py-2',
        'titlebar-no-drag shrink-0',
        className
      )}
    >
      {RAIL_ITEMS.map(({ tab, label, Icon }) => {
        const isActive = panelOpen && activeTab === tab
        const showBadge =
          tab === 'activity' && unseenFilesCount > 0 && !isActive
            ? true
            : tab === 'changes' && unseenChanges && !isActive
        return (
          <Tooltip key={tab}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setTab(tab)}
                aria-pressed={isActive}
                aria-label={label}
                title={label}
                className={cn(
                  'relative size-8 rounded-[10px] flex items-center justify-center transition-colors',
                  isActive
                    ? 'bg-foreground/[0.08] text-foreground'
                    : 'text-foreground/55 hover:text-foreground hover:bg-foreground/[0.04]'
                )}
              >
                <Icon className="size-4" />
                {showBadge && (
                  <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-1 ring-background" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
