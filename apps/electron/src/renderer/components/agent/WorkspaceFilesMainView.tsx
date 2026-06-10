/**
 * WorkspaceFilesMainView - 主区域的工作区文件视图
 *
 * 直接复用 Files 页的内容，但切到 main 布局，让主区更宽、更松，不像 sidebar。
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import { agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { Panel } from '@/components/app-shell/Panel'
import { WorkspaceFilesView } from '@/components/agent/WorkspaceFilesView'

export function WorkspaceFilesMainView(): React.ReactElement {
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const workspace = React.useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId],
  )

  if (!workspace) {
    return (
      <Panel variant="grow" className="bg-content-area rounded-2xl shadow-xl">
        <div className="flex h-full min-h-0 items-center justify-center p-6">
          <div className="max-w-md rounded-3xl border border-dashed border-border/70 bg-muted/20 px-8 py-10 text-center">
            <h3 className="text-base font-semibold text-foreground">选择一个工作区查看文件</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              切换到一个工作区后，这里会显示它的文件内容。
            </p>
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel variant="grow" className="bg-content-area rounded-2xl shadow-xl">
      <div className="h-full min-h-0 overflow-hidden">
        <WorkspaceFilesView workspaceKey={workspace.id} layout="main" />
      </div>
    </Panel>
  )
}
