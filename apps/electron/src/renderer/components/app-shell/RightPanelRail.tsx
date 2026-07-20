/**
 * RightPanelRail — 折叠态右上角上下文胶囊内的竖向图标列
 *
 * 展开态入口迁至 RightInspectorFrame 顶栏 tabs（见 RightRailItems orientation="tabs"）。
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import { RightRailItems } from './RightRailItems'

import {
  agentDiffUnseenChangesAtom,
  agentDiffUnseenFilesAtom,
  currentAgentSessionIdAtom,
} from '@/atoms/agent-atoms'
import { cn } from '@/lib/utils'

interface RightPanelRailProps {
  /** 面板当前是否展开（控制 active 高亮；折叠态通常为 false） */
  panelOpen: boolean
  className?: string
}

export function RightPanelRail({ panelOpen, className }: RightPanelRailProps): React.ReactElement {
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const unseenChangesMap = useAtomValue(agentDiffUnseenChangesAtom)
  const unseenFilesMap = useAtomValue(agentDiffUnseenFilesAtom)

  const unseenChanges = currentSessionId ? (unseenChangesMap.get(currentSessionId) ?? false) : false
  const unseenFilesCount = currentSessionId ? (unseenFilesMap.get(currentSessionId)?.size ?? 0) : 0
  const showBadge = !panelOpen && (unseenChanges || unseenFilesCount > 0)

  return (
    <div
      className={cn(
        'right-panel-rail right-panel-rail--collapsed relative z-[1] flex h-auto shrink-0 flex-col items-center',
        showBadge && 'right-panel-rail--notify',
        className
      )}
    >
      <div className="flex w-full flex-col items-center">
        <RightRailItems panelOpen={panelOpen} orientation="vertical" />
      </div>
    </div>
  )
}
