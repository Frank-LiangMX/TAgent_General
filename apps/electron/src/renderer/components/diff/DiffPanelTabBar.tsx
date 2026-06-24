/**
 * DiffPanelTabBar — 右侧面板顶部 Tab 栏
 *
 * 切换「会话文件」与「代码改动」；折叠由接缝锚点按钮统一处理。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import { agentDiffUnseenChangesAtom, currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { cn } from '@/lib/utils'

type DiffPanelTab = 'session' | 'changes'

interface DiffPanelTabBarProps {
  activeTab: DiffPanelTab
  onTabChange: (tab: DiffPanelTab) => void
}

interface PreviousTabState {
  sessionId: string | null
  activeTab: DiffPanelTab
}

export function DiffPanelTabBar({
  activeTab,
  onTabChange,
}: DiffPanelTabBarProps): React.ReactElement {
  const unseenMap = useAtomValue(agentDiffUnseenChangesAtom)
  const setUnseenMap = useSetAtom(agentDiffUnseenChangesAtom)
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const unseenChanges = unseenMap.get(currentSessionId ?? '') ?? false
  const prevTabStateRef = React.useRef<PreviousTabState>({ sessionId: currentSessionId, activeTab })

  const clearUnseen = React.useCallback(
    (sessionId = currentSessionId) => {
      if (!sessionId) return
      setUnseenMap((prev) => {
        if (prev.get(sessionId) === false) return prev
        const m = new Map(prev)
        m.set(sessionId, false)
        return m
      })
    },
    [currentSessionId, setUnseenMap]
  )

  // 同一会话内，从「文件改动」切走时，说明用户已经看过当前改动。
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
          onClick={() => onTabChange('session')}
          className={cn(
            'h-6 flex-1 select-none rounded-full px-2 text-[11px] font-medium transition-all cursor-pointer',
            activeTab === 'session'
              ? 'bg-background/80 text-foreground shadow-sm shadow-black/[0.04]'
              : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground/80'
          )}
        >
          会话文件
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
            文件改动
          </span>
        </button>
      </div>
    </div>
  )
}
