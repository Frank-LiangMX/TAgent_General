/**
 * WorkspaceFileDropSurface — 工作区文件页拖放容器（左栏 / 右栏通用）
 */

import * as React from 'react'

import {
  useWorkspaceFileDrop,
  type UseWorkspaceFileDropResult,
} from '@/hooks/use-workspace-file-drop'
import { cn } from '@/lib/utils'

const WorkspaceFileDropContext = React.createContext<UseWorkspaceFileDropResult | null>(null)

/** 子组件读取拖放动作（须在 WorkspaceFileDropSurface 内使用） */
export function useWorkspaceFileDropActions(): UseWorkspaceFileDropResult {
  const ctx = React.useContext(WorkspaceFileDropContext)
  if (!ctx) {
    throw new Error('useWorkspaceFileDropActions 须在 WorkspaceFileDropSurface 内使用')
  }
  return ctx
}

interface WorkspaceFileDropSurfaceProps {
  className?: string
  children: React.ReactNode
}

export function WorkspaceFileDropSurface({
  className,
  children,
}: WorkspaceFileDropSurfaceProps): React.ReactElement {
  const drop = useWorkspaceFileDrop()

  return (
    <WorkspaceFileDropContext.Provider value={drop}>
      <div
        className={cn(
          'relative min-h-0',
          drop.isDragOver && 'bg-primary/[0.04] ring-2 ring-inset ring-primary/30',
          className
        )}
        {...drop.dropZoneProps}
      >
        {drop.isDragOver ? (
          <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/[0.06]">
            <p className="px-4 text-center text-xs font-medium text-primary/80">
              松开以添加文件到工作区，或附加文件夹
            </p>
          </div>
        ) : null}
        {children}
      </div>
    </WorkspaceFileDropContext.Provider>
  )
}
