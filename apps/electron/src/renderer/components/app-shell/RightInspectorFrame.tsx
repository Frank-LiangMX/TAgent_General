/**
 * RightInspectorFrame — 展开态上下文检查器
 *
 * 结构对齐 layout-direction-study：
 * header（CONTEXT + 标题 + 浮层/占位切换 + 关闭）→ 顶栏 tabs → body
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { PanelRight, PictureInPicture2, X } from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'

import { RightRailItems } from './RightRailItems'
import { RightSidePanel } from './RightSidePanel'

import { agentSidePanelOpenAtom, agentSidePanelPlacementAtom } from '@/atoms/agent-atoms'
import { rightRailItemAtom, type RightRailItem } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

const INSPECTOR_TITLES: Record<RightRailItem, string> = {
  files: '项目文件',
  btw: '旁注',
  browser: '预览',
  design: 'Design Preview',
  crew: '班组',
}

export const RightInspectorFrame = React.memo(function RightInspectorFrame({
  width,
}: {
  width: number
}): React.ReactElement {
  const activeItem = useAtomValue(rightRailItemAtom)
  const setPanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const [placement, setPlacement] = useAtom(agentSidePanelPlacementAtom)
  const isDock = placement === 'dock'

  return (
    <div className="app-inspector-frame" style={{ width }}>
      <header className="app-inspector-header titlebar-no-drag">
        <div className="app-inspector-heading">
          <span className="app-inspector-kicker">CONTEXT</span>
          <h2 className="app-inspector-title">{INSPECTOR_TITLES[activeItem]}</h2>
        </div>
        <div className="app-inspector-header-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn('app-inspector-close', isDock && 'app-inspector-close--active')}
                aria-pressed={isDock}
                aria-label={
                  isDock
                    ? '当前占位模式，点击切换为浮层'
                    : '当前浮层模式，点击切换为占位'
                }
                onClick={() => setPlacement(isDock ? 'float' : 'dock')}
              >
                {/*
                  图标表示「当前模式」而不是「点了变什么」：
                  - PanelRight：侧栏占列（主区让宽、常驻）
                  - PictureInPicture2：浮在内容上（可点外关闭）
                */}
                {isDock ? (
                  <PanelRight size={15} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <PictureInPicture2 size={15} strokeWidth={1.5} aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="text-xs">
                <div className="font-medium">{isDock ? '占位 · 常驻' : '浮层 · 点外关闭'}</div>
                <div className="text-muted-foreground">
                  {isDock
                    ? '侧栏占列，主区让宽。点击改为浮在主区上'
                    : '浮在主区上，点外部收起。点击改为占列常驻'}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            className="app-inspector-close"
            onClick={() => setPanelOpen(false)}
            aria-label="折叠检查器"
          >
            <X size={15} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </header>

      <RightRailItems panelOpen orientation="tabs" />

      <div className="app-inspector-body">
        <RightSidePanel width={width} />
      </div>
    </div>
  )
})
