/**
 * RightSidePanel — 右侧边栏容器
 *
 * 在 Agent 模式下显示文件面板或 btw 面板，样式与 LeftSidebar 一致。
 * 从全局 atom 读取当前会话 ID 和路径。
 * 根据 rightRailItemAtom 切换显示内容（镜像左侧 LeftSidebar 机制）。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import {
  currentAgentSessionIdAtom,
  agentSessionPathMapAtom,
  agentDiffPanelTabAtom,
} from '@/atoms/agent-atoms'
import { appModeAtom, rightRailItemAtom } from '@/atoms/app-mode'
import { SidePanel } from '@/components/agent/SidePanel'
import { BtwPanel } from '@/components/agent/BtwPanel' // 重新使用 BtwPanel（样式已适配）
import { DesignPreviewPanel } from '@/components/design-preview/DesignPreviewPanel'
import { WpsBrowserPanel } from '@/components/agent/WpsBrowserPanel'
import { KanbanCrewPanel } from '@/components/kanban/KanbanCrewPanel'

export function RightSidePanel({ width }: { width?: number }): React.ReactElement | null {
  const appMode = useAtomValue(appModeAtom)
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const sessionPathMap = useAtomValue(agentSessionPathMapAtom)
  const diffPanelTabMap = useAtomValue(agentDiffPanelTabAtom)
  const setDiffPanelTabMap = useSetAtom(agentDiffPanelTabAtom)
  const rightRailItem = useAtomValue(rightRailItemAtom)

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

  // 根据 rightRailItem 切换显示内容
  if (rightRailItem === 'btw') {
    return <BtwPanel width={width} />
  }

  if (rightRailItem === 'browser') {
    return <WpsBrowserPanel width={width} />
  }

  if (rightRailItem === 'design') {
    return <DesignPreviewPanel width={width} />
  }

  if (rightRailItem === 'crew') {
    return <KanbanCrewPanel width={width} />
  }

  // 默认显示文件面板
  return (
    <SidePanel
      sessionId={currentSessionId ?? ''}
      sessionPath={sessionPath}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      width={width}
    />
  )
}
