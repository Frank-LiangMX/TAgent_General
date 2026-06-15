/**
 * TATabBar — TA 模式专用 TabBar
 *
 * 显示固定的 TA 功能 Tab：
 * - 资产库
 * - 审核
 * - 流水线
 * - 记忆
 * - 配置
 *
 * 支持点击切换，高亮当前 Tab。
 */

import { Database, ClipboardCheck, GitBranch, Brain, Settings } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export type TATabId = 'assets' | 'review' | 'pipeline' | 'memory' | 'config'

interface TATabItem {
  id: TATabId
  label: string
  icon: React.ReactNode
}

const TA_TABS: TATabItem[] = [
  { id: 'assets', label: '资产库', icon: <Database size={14} /> },
  { id: 'review', label: '审核', icon: <ClipboardCheck size={14} /> },
  { id: 'pipeline', label: '流水线', icon: <GitBranch size={14} /> },
  { id: 'memory', label: '记忆', icon: <Brain size={14} /> },
  { id: 'config', label: '配置', icon: <Settings size={14} /> },
]

export interface TATabBarProps {
  activeTab: TATabId
  onTabChange: (tabId: TATabId) => void
}

export function TATabBar({ activeTab, onTabChange }: TATabBarProps): React.ReactElement {
  return (
    <div className="flex items-end h-[34px] tabbar-bg content-shell-chrome-bleed relative shrink-0">
      {/* 拖拽区域 */}
      <div className="absolute inset-0 titlebar-drag-region" />

      <div className="relative flex items-end flex-1 min-w-0 overflow-x-auto scrollbar-none">
        {TA_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 h-[28px] min-w-[80px] max-w-[160px]',
              'rounded-t-[8px] border-x border-t border-transparent',
              'text-[13px] font-medium transition-colors duration-100 titlebar-no-drag',
              'flex-shrink-0 truncate',
              activeTab === tab.id
                ? 'bg-background text-foreground border-border shadow-[0_-1px_0_0_hsl(var(--border))_inset]'
                : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
            )}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
