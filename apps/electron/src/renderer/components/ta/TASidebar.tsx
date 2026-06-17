/**
 * TASidebar — TA 模式 LeftSidebar 主内容容器（仅 5 个模块面板）
 *
 * 根据 activeRailItem（来自 FunctionalRail 图标点击）渲染对应模块的概览面板：
 * - assets   → TASidebarAssets（资产库概览）
 * - review   → TASidebarReview（审核队列概览）
 * - pipeline → TASidebarPipeline（流水线概览）
 * - memory   → TASidebarMemory（记忆 5 层概览）
 * - config   → TASidebarConfig（配置概览）
 *
 * 选中『会话』由 LeftSidebar 路由到 SessionsRailContent（沿用通用模式完整布局，
 *  数据通过 filteredAgentSessions 按 mode='ta' 过滤实现隔离）。
 */

import * as React from 'react'

import { TASidebarAssets } from './TASidebar.Assets'
import { TASidebarConfig } from './TASidebar.Config'
import { TASidebarMemory } from './TASidebar.Memory'
import { TASidebarPipeline } from './TASidebar.Pipeline'
import { TASidebarReview } from './TASidebar.Review'

import type { TARailItem } from '@/atoms/app-mode'

const TITLES: Record<TARailItem, string> = {
  sessions: '会话',
  assets: '资产库',
  review: '审核',
  pipeline: '流水线',
  memory: '记忆',
  config: '配置',
  skills: '技能',
  scratch: '草稿',
}

interface TASidebarProps {
  activeRailItem: TARailItem
}

export function TASidebar({ activeRailItem }: TASidebarProps): React.ReactElement {
  const title = TITLES[activeRailItem] ?? 'TA'

  return (
    <div className="flex flex-col h-full">
      {/* 标题区：与通用模式 LeftSidebar 一致 */}
      <div className="titlebar-drag-region flex items-center px-3 h-8 flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      </div>

      {/* 内容区：选中『会话』由 LeftSidebar 直接渲染 SessionsRailContent，
          此处只渲染 5 个模块概览面板。 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {activeRailItem === 'assets' && <TASidebarAssets />}
        {activeRailItem === 'review' && <TASidebarReview />}
        {activeRailItem === 'pipeline' && <TASidebarPipeline />}
        {activeRailItem === 'memory' && <TASidebarMemory />}
        {activeRailItem === 'config' && <TASidebarConfig />}
      </div>
    </div>
  )
}
