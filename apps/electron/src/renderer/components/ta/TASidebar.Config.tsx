/**
 * TASidebarConfig — TA 配置概览
 *
 * 复用 TAConfigPanel 内部已加载的配置状态（naming rules / blender path / budget）。
 * 由于 TAConfigPanel 的配置加载是组件内部 state，这里不直接读取，而是展示
 * 静态跳转到主区的方式。后续若把配置提升为 atom，可在此处显示。
 */

import { Settings } from 'lucide-react'
import * as React from 'react'
import { useSetAtom } from 'jotai'

import { taActiveTabAtom } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

export function TASidebarConfig(): React.ReactElement {
  const setActiveTab = useSetAtom(taActiveTabAtom)

  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* 配置项快捷入口 */}
      {[
        { id: 'naming', label: '命名规则', desc: '资产/文件命名约束' },
        { id: 'blender', label: 'Blender 路径', desc: 'MCP 集成路径' },
        { id: 'budget', label: '预算配置', desc: '多边形/纹理预算阈值' },
      ].map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setActiveTab('config')}
          className={cn(
            'rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 text-left',
            'hover:bg-foreground/[0.04] transition-colors'
          )}
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/85">
            <Settings size={12} className="text-foreground/45" />
            {item.label}
          </div>
          <div className="text-[11px] text-muted-foreground/70 mt-1">{item.desc}</div>
        </button>
      ))}

      <div className="rounded-lg bg-muted/40 border border-border/40 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        配置修改在主区『配置』Tab 完成；保存后此处自动同步。
      </div>
    </div>
  )
}
