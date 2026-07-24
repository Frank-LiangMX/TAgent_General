/**
 * TerminalMainView — 内置终端 rail 主区
 *
 * 仿 KanbanMainView，用 Panel variant="grow" 包 TerminalPanel。
 * cwd 取当前 Agent 工作区的 projectDirectory，无则 undefined（主进程回退 home）。
 *
 * 顶部不再画独立「终端」标题块：终端 tab 栏直接顶到 Panel 顶部，对齐会话 TabBar
 * 的位置与拖拽语义（tab 栏层可拖窗、tab 按钮不拖）。位置/留白由 TerminalPanel 的
 * app-workspace-tab-strip 承担（与会话 TabBar 同一套 CSS，自带 margin-top + 底线）。
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'

import { agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { Panel } from '@/components/app-shell/Panel'
import { TerminalPanel } from '@/components/terminal/TerminalPanel'

export function TerminalMainView(): React.ReactElement {
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null
  const cwd = workspace?.projectDirectory ?? ''

  return (
    <Panel variant="grow" className="content-glass">
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <TerminalPanel workspaceRoot={cwd} />
      </div>
    </Panel>
  )
}
