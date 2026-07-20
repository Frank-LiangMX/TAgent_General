/**
 * TASidebar — TA 模式 LeftSidebar 主内容容器
 *
 * 根据 activeRailItem 渲染对应模块概览：
 * - assets / review / pipeline / config
 *
 * 选中『会话』由 LeftSidebar 路由到 SessionsRailContent。
 * memory 为 rail-only，不经过本组件。
 */

import * as React from 'react'

import { TASidebarAssets } from './TASidebar.Assets'
import { TASidebarConfig } from './TASidebar.Config'
import { TASidebarPipeline } from './TASidebar.Pipeline'
import { TASidebarReview } from './TASidebar.Review'

import type { TARailItem } from '@/atoms/app-mode'

const TITLES: Record<TARailItem | 'skills' | 'draft', string> = {
  sessions: '会话',
  assets: '资产库',
  review: '审核',
  pipeline: '流水线',
  memory: '记忆',
  config: '配置',
  skills: '技能',
  draft: '草稿',
  kanban: '看板',
}

interface TASidebarProps {
  activeRailItem: TARailItem
}

export function TASidebar({ activeRailItem }: TASidebarProps): React.ReactElement {
  const title = TITLES[activeRailItem] ?? 'TA'

  return (
    <div className="flex flex-col h-full">
      <div className="titlebar-drag-region flex items-center px-3 h-8 flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {activeRailItem === 'assets' && <TASidebarAssets />}
        {activeRailItem === 'review' && <TASidebarReview />}
        {activeRailItem === 'pipeline' && <TASidebarPipeline />}
        {activeRailItem === 'config' && <TASidebarConfig />}
      </div>
    </div>
  )
}
