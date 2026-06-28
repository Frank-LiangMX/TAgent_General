/**
 * DiffPanelTabBar — 右侧面板顶部 Tab 栏
 *
 * 切换「项目文件」「文件活动」「代码改动」；折叠由接缝锚点按钮统一处理。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import {
  agentDiffUnseenChangesAtom,
  currentAgentSessionIdAtom,
  agentDiffUnseenFilesAtom,
} from '@/atoms/agent-atoms'
import { SegmentedTabs, SegmentedTabsItem } from '@/components/ui/segmented-tabs'

type DiffPanelTab = 'project' | 'activity' | 'changes'

interface DiffPanelTabBarProps {
  activeTab: DiffPanelTab
  onTabChange: (tab: DiffPanelTab) => void
}

interface PrevTabState {
  sessionId: string | null
  activeTab: DiffPanelTab
}

export function DiffPanelTabBar({
  activeTab,
  onTabChange,
}: DiffPanelTabBarProps): React.ReactElement {
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const unseenChangesMap = useAtomValue(agentDiffUnseenChangesAtom)
  const unseenFilesMap = useAtomValue(agentDiffUnseenFilesAtom)
  const unseenChanges = currentSessionId ? (unseenChangesMap.get(currentSessionId) ?? false) : false

  const unseenFilesCount = currentSessionId ? (unseenFilesMap.get(currentSessionId)?.size ?? 0) : 0
  const setUnseenMap = useSetAtom(agentDiffUnseenFilesAtom)

  const prevTabStateRef = React.useRef<PrevTabState>({ sessionId: null, activeTab: 'project' })

  const clearUnseen = React.useCallback(
    (sid = currentSessionId) => {
      if (!sid) return
      setUnseenMap((prev) => {
        const m = new Map(prev)
        m.delete(sid)
        return m
      })
    },
    [currentSessionId, setUnseenMap]
  )

  // 同一会话内，从「代码改动」切走时，说明用户已经看过当前改动。
  React.useEffect(() => {
    const previous = prevTabStateRef.current
    if (
      previous.sessionId === currentSessionId &&
      previous.activeTab === 'changes' &&
      activeTab !== 'changes'
    ) {
      clearUnseen(currentSessionId)
    }
    prevTabStateRef.current = { sessionId: currentSessionId, activeTab }
  }, [activeTab, currentSessionId, clearUnseen])

  const handleTabChange = (tab: string): void => {
    const next = tab as DiffPanelTab
    if (next === 'changes') {
      clearUnseen()
    }
    if (next !== activeTab) {
      onTabChange(next)
    }
  }

  return (
    <div className="relative flex h-[44px] flex-shrink-0 items-center px-3 pt-2 titlebar-drag-region">
      <SegmentedTabs
        className="titlebar-no-drag flex-1"
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <SegmentedTabsItem value="project">项目文件</SegmentedTabsItem>
        <SegmentedTabsItem value="activity" className="gap-1">
          {unseenFilesCount > 0 && activeTab !== 'activity' && (
            <span className="size-2 shrink-0 rounded-full bg-primary ring-1 ring-background" />
          )}
          文件活动
        </SegmentedTabsItem>
        <SegmentedTabsItem value="changes" className="gap-1">
          {unseenChanges && activeTab !== 'changes' && (
            <span className="size-2 shrink-0 rounded-full bg-primary ring-1 ring-background" />
          )}
          代码改动
        </SegmentedTabsItem>
      </SegmentedTabs>
    </div>
  )
}
