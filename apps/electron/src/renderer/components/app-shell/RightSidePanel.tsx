/**
 * RightSidePanel — 右侧检查器内容路由
 *
 * 根据 rightRailItemAtom 切换显示内容（镜像左侧 LeftSidebar 机制）。
 * 宽度由外层 island 统一管理，标题 chrome 由 RightInspectorFrame 提供，
 * 本层只做纯路由，不再透传 width / 包壳。
 *
 * RailItemContent 是纯内容路由，供右栏检查器（本组件）使用。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import type { RightRailItem } from '@/atoms/app-mode'

import {
  currentAgentSessionIdAtom,
  agentSessionPathMapAtom,
  agentDiffPanelTabAtom,
} from '@/atoms/agent-atoms'
import { rightRailItemAtom } from '@/atoms/app-mode'
import { BtwPanel } from '@/components/agent/BtwPanel'
import { SidePanel } from '@/components/agent/SidePanel'
import { UniversalPreviewPanel } from '@/components/agent/UniversalPreviewPanel'
import { DesignPreviewPanel } from '@/components/design-preview/DesignPreviewPanel'
import { KanbanCrewPanel } from '@/components/kanban/KanbanCrewPanel'

/** 按功能项渲染右栏内容（不带壳，铺满父容器） */
export function RailItemContent({ item }: { item: RightRailItem }): React.ReactElement {
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const sessionPathMap = useAtomValue(agentSessionPathMapAtom)
  const diffPanelTabMap = useAtomValue(agentDiffPanelTabAtom)
  const setDiffPanelTabMap = useSetAtom(agentDiffPanelTabAtom)

  const setActiveTab = React.useCallback(
    (tab: 'project' | 'activity' | 'changes') => {
      if (!currentSessionId) return
      setDiffPanelTabMap((prev) => {
        const next = new Map(prev)
        next.set(currentSessionId, tab)
        return next
      })
    },
    [currentSessionId, setDiffPanelTabMap]
  )

  const sessionPath = currentSessionId ? (sessionPathMap.get(currentSessionId) ?? null) : null
  const activeTab = currentSessionId
    ? (diffPanelTabMap.get(currentSessionId) ?? 'project')
    : 'project'

  if (item === 'btw') {
    return <BtwPanel />
  }

  if (item === 'browser') {
    return <UniversalPreviewPanel />
  }

  if (item === 'design') {
    return <DesignPreviewPanel />
  }

  if (item === 'crew') {
    return <KanbanCrewPanel />
  }

  // 默认显示文件面板
  return (
    <SidePanel
      sessionId={currentSessionId ?? ''}
      sessionPath={sessionPath}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  )
}

export function RightSidePanel(): React.ReactElement | null {
  const rightRailItem = useAtomValue(rightRailItemAtom)
  return <RailItemContent item={rightRailItem} />
}
