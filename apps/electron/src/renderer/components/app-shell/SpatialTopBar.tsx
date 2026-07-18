/**
 * SpatialTopBar — operating-system chrome for the main application window.
 *
 * Product navigation belongs to the rail and workspace tab strip. This layer
 * stays intentionally quiet so canvas and Office scenes do not inherit a
 * second, competing mode navigation.
 */

import { useSetAtom } from 'jotai'
import { ChevronDown } from 'lucide-react'
import * as React from 'react'

import { WindowControls } from '@/components/WindowControls'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import { useWorkspaceActions } from '@/hooks/useWorkspaceActions'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

export function SpatialTopBar(): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])
  const { workspaces, currentWorkspaceId } = useWorkspaceActions()
  const setWorkspaceManagerOpen = useSetAtom(workspaceManagerOpenAtom)

  const workspaceName =
    workspaces.find((workspace) => workspace.id === currentWorkspaceId)?.name ?? '默认工作区'

  return (
    <header
      className={cn('app-spatial-topbar titlebar-drag-region', isMac && 'app-spatial-topbar--mac')}
    >
      <button
        type="button"
        className="app-workspace-switcher titlebar-no-drag"
        onClick={() => setWorkspaceManagerOpen(true)}
        aria-label={`切换工作区，当前为 ${workspaceName}`}
      >
        <span className="app-workspace-glyph" aria-hidden="true">
          TG
        </span>
        <span className="app-workspace-name">{workspaceName}</span>
        <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <span className="app-spatial-topbar-brand" aria-hidden="true">
        TAGENT
      </span>

      <WindowControls />
    </header>
  )
}
