/**
 * TAModePlaceholder - TA 模式占位组件
 *
 * 在 TA 模式完整 UI 实现之前，显示占位内容。
 * 后续实现：
 * - 资产库浏览
 * - 审核队列
 * - 流水线管理
 * - 项目配置
 */

import { Palette, Database, ClipboardCheck, GitBranch, Settings } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const taFeatures = [
  {
    icon: Database,
    title: '资产库',
    description: '浏览、搜索、管理游戏资产',
    status: 'planned',
  },
  {
    icon: ClipboardCheck,
    title: '审核队列',
    description: '资产审核与质量检查',
    status: 'planned',
  },
  {
    icon: GitBranch,
    title: '流水线',
    description: '自动化资产处理流程',
    status: 'planned',
  },
  {
    icon: Settings,
    title: '项目配置',
    description: '引擎路径、命名规范等设置',
    status: 'planned',
  },
]

export function TAModePlaceholder(): React.ReactElement {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-background rounded-2xl shadow-xl">
      {/* Logo 和标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Palette className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">TA 模式</h1>
          <p className="text-sm text-muted-foreground">技术美术工具集</p>
        </div>
      </div>

      {/* 功能卡片 */}
      <div className="grid grid-cols-2 gap-3 max-w-md w-full px-4">
        {taFeatures.map(({ icon: Icon, title, description, status }) => (
          <div
            key={title}
            className={cn(
              'flex flex-col gap-2 p-4 rounded-xl border transition-colors',
              status === 'available'
                ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                : 'bg-muted/50 border-muted-foreground/20'
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="size-5 text-muted-foreground" />
              <span className="font-medium text-sm">{title}</span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            {status === 'planned' && (
              <span className="text-[10px] text-muted-foreground/60 mt-auto">即将推出</span>
            )}
          </div>
        ))}
      </div>

      {/* 提示 */}
      <p className="mt-8 text-sm text-muted-foreground text-center max-w-md px-4">
        TA 模式正在开发中，将提供资产管理、审核、流水线等完整的技术美术工作流工具。
      </p>
    </div>
  )
}
