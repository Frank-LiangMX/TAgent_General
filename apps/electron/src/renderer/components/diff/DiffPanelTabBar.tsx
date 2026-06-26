/**
 * DiffPanelTabBar — 右侧面板顶部 Tab 栏
 *
 * 切换「项目文件」「文件活动」「代码改动」；折叠由接缝锚点按钮统一处理。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import { agentDiffUnseenChangesAtom, currentAgentSessionIdAtom, agentDiffUnseenFilesAtom } from '@/atoms/agent-atoms'
import { cn } from '@/lib/utils'

type DiffPanelTab = 'project' | 'activity' | 'changes'

interface DiffPanelTabBarProps {
  activeTab: DiffPanelTab
  onTabChange: (tab: DiffPanelTab) => void
}

interface PrevTabState {
  sessionId: string | null
  activeTab: DiffPanelTab
}

export function DiffPanelTabBar({ activeTab, onTabChange }: DiffPanelTabBarProps): React.ReactElement {
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

  const handleChangesClick = () => {
    clearUnseen()
    if (activeTab !== 'changes') {
      onTabChange('changes')
    }
  }

  return (
    <div className="relative flex h-[44px] flex-shrink-0 items-center px-3 pt-2 titlebar-drag-region">
      <div className="relative flex h-8 flex-1 items-center rounded-full border border-border/35 bg-background/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] titlebar-no-drag">
        <button
          type="button"
          onClick={() => onTabChange('project')}
          className={cn(
            'h-6 flex-1 select-none rounded-full px-2 text-[11px] font-medium transition-all cursor-pointer',
            activeTab === 'project'
              ? 'bg-background/80 text-foreground shadow-sm shadow-black/[0.04]'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground/80'
          )}
        >
          项目文件
        </button>
        <button
          type="button"
          onClick={() => onTabChange('activity')}
          className={cn(
            'h-6 flex-1 select-none rounded-full px-2 text-[11px] font-medium transition-all cursor-pointer',
            activeTab === 'activity'
              ? 'bg-background/80 text-foreground shadow-sm shadow-black/[0.04]'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground/80'
          )}
        >
          <span className="inline-flex items-center gap-1">
            {unseenFilesCount > 0 && activeTab !== 'activity' && (
              <span className="size-2 rounded-full bg-primary ring-1 ring-background shrink-0" />
            )}
            文件活动
          </span>
        </button>
        <button
          type="button"
          onClick={handleChangesClick}
          className={cn(
            'relative h-6 flex-1 select-none rounded-full px-2 text-[11px] font-medium transition-all cursor-pointer',
            activeTab === 'changes'
              ? 'bg-background/80 text-foreground shadow-sm shadow-black/[0.04]'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground/80'
          )}
        >
          <span className="inline-flex items-center gap-1">
            {unseenChanges && activeTab !== 'changes' && (
              <span className="size-2 rounded-full bg-primary ring-1 ring-background shrink-0" />
            )}
            代码改动
          </span>
        </button>
      </div>
    </div>
  )
}
