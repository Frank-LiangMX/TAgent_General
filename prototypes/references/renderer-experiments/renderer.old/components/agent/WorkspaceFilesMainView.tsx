/**
 * WorkspaceFilesMainView - 文件功能区主区（Inspector）
 */

import * as React from 'react'

import { WorkspaceFileDropSurface } from '@/components/agent/WorkspaceFileDropSurface'
import { WorkspaceFileInspector } from '@/components/agent/WorkspaceFileInspector'
import { Panel } from '@/components/app-shell/Panel'
import { ContentWindowDragBand } from '@/components/app-shell/WindowDragStrip'

export function WorkspaceFilesMainView(): React.ReactElement {
  return (
    <Panel variant="grow" className="content-glass relative">
      <ContentWindowDragBand />
      <WorkspaceFileDropSurface className="relative z-[1] flex h-full min-h-0 flex-col overflow-hidden">
        <WorkspaceFileInspector />
      </WorkspaceFileDropSurface>
    </Panel>
  )
}
