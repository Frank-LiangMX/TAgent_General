/**
 * RightSidePanel — 右侧边栏容器
 *
 * 在 Agent 模式下显示文件面板，样式与 LeftSidebar 一致。
 * 从全局 atom 读取当前会话 ID 和路径。
 * 管理「项目文件 / 文件活动 / 代码改动」Tab 切换。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import {
  currentAgentSessionIdAtom,
  agentSessionPathMapAtom,
  agentDiffPanelTabAtom,
} from '@/atoms/agent-atoms'
import { appModeAtom } from '@/atoms/app-mode'
import { SidePanel } from '@/components/agent/SidePanel'

export function RightSidePanel({ width }: { width?: number }): React.ReactElement | null {
  const appMode = useAtomValue(appModeAtom)
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
