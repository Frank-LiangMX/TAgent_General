/**
 * TASidebar — TA 模式 LeftSidebar 主内容容器
 *
 * 根据 taActiveTabAtom 渲染对应模块的概览面板：
 * - sessions → TASidebarSessions（TA 会话列表 + 新建）
 * - assets   → TASidebarAssets（资产库概览）
 * - review   → TASidebarReview（审核队列概览）
 * - pipeline → TASidebarPipeline（流水线概览）
 * - memory   → TASidebarMemory（记忆 5 层概览）
 * - config   → TASidebarConfig（配置概览）
 *
 * 与通用模式 LeftSidebar 不同的关键点：
 * 1. 通用模式 LeftSidebar 内容由 activeRailItem 决定；TA 模式由 taActiveTab 决定。
 * 2. TA 模式没有"功能区切换器"概念（FunctionalRail 上已隐藏 5 个 TA 图标），
 *    主区 TATabBar 是唯一的导航。
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import { taActiveTabAtom } from '@/atoms/app-mode'

import { TASidebarAssets } from './TASidebar.Assets'
import { TASidebarReview } from './TASidebar.Review'
import { TASidebarPipeline } from './TASidebar.Pipeline'
import { TASidebarMemory } from './TASidebar.Memory'
import { TASidebarConfig } from './TASidebar.Config'
import { TASidebarSessions } from './TASidebar.Sessions'

const TITLES: Record<string, string> = {
  sessions: '会话',
  assets: '资产库',
  review: '审核',
  pipeline: '流水线',
  memory: '记忆',
  config: '配置',
}

export function TASidebar(): React.ReactElement {
  const activeTab = useAtomValue(taActiveTabAtom)
  const title = TITLES[activeTab] ?? 'TA'

  return (
    <div className="flex flex-col h-full">
      {/* 标题区：与通用模式 LeftSidebar 一致 */}
      <div className="titlebar-drag-region flex items-center px-3 h-8 flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {activeTab === 'sessions' && <TASidebarSessions />}
        {activeTab === 'assets' && <TASidebarAssets />}
        {activeTab === 'review' && <TASidebarReview />}
        {activeTab === 'pipeline' && <TASidebarPipeline />}
        {activeTab === 'memory' && <TASidebarMemory />}
        {activeTab === 'config' && <TASidebarConfig />}
      </div>
    </div>
  )
}
