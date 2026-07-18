/** Shared Spatial frame for every contextual inspector surface. */

import { useAtomValue, useSetAtom } from 'jotai'
import { X } from 'lucide-react'
import * as React from 'react'

import { RightSidePanel } from './RightSidePanel'

import { agentSidePanelOpenAtom } from '@/atoms/agent-atoms'
import { rightRailItemAtom, type RightRailItem } from '@/atoms/app-mode'

const INSPECTOR_TITLES: Record<RightRailItem, string> = {
  files: '项目文件',
  btw: '旁注',
  browser: '预览',
  design: 'Design Preview',
  crew: '班组',
}

export function RightInspectorFrame({ width }: { width: number }): React.ReactElement {
  const activeItem = useAtomValue(rightRailItemAtom)
  const setPanelOpen = useSetAtom(agentSidePanelOpenAtom)

  return (
    <div className="app-inspector-frame" style={{ width }}>
      <header className="app-inspector-header titlebar-no-drag">
        <div className="app-inspector-heading">
          <span className="app-inspector-kicker">CONTEXT</span>
          <h2 className="app-inspector-title">{INSPECTOR_TITLES[activeItem]}</h2>
        </div>
        <button
          type="button"
          className="app-inspector-close"
          onClick={() => setPanelOpen(false)}
          aria-label="折叠检查器"
        >
          <X size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      <div className="app-inspector-body">
        <RightSidePanel width={width} />
      </div>
    </div>
  )
}
