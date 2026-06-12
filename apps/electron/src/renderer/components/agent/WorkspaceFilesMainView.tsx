/**
 * WorkspaceFilesMainView - 文件功能区主区（Inspector）
 */

import * as React from 'react'

import { WorkspaceFileInspector } from '@/components/agent/WorkspaceFileInspector'
import { Panel } from '@/components/app-shell/Panel'

export function WorkspaceFilesMainView(): React.ReactElement {
  return (
    <Panel variant="grow" className="content-glass">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <WorkspaceFileInspector />
      </div>
    </Panel>
  )
}
