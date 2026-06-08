/**
 * SkillsPanel - 工作区 MCP Servers & Skills 列表
 *
 * LeftSidebar 在 activeRailItem === 'skills' 时显示的真正内容。
 * 复用 `WorkspaceCapabilities` 数据，展示：
 * - 顶部 header：MCP & Skills 标题 + 计数 + 配置入口
 * - MCP Servers 分组：每条 name + 启用状态 + transport 类型
 * - Skills 分组：每条 name + 描述（截断）+ 更新提示
 *
 * 原本 LeftSidebar 左下角"MCP × Skills"指示器的能力被这里完全覆盖。
 */

import { Plug, Zap, Settings2, CircleCheck, CircleDashed, RotateCw, Server } from 'lucide-react'
import * as React from 'react'

import type { WorkspaceCapabilities } from '@tagent/shared'

import { cn } from '@/lib/utils'

interface SkillsPanelProps {
  /** 工作区能力数据（null 表示尚未加载） */
  capabilities: WorkspaceCapabilities | null
  /** 点击右上角"配置"按钮回调（默认打开 settings agent tab） */
  onConfigure?: () => void
}

export function SkillsPanel({
  capabilities,
  onConfigure,
}: SkillsPanelProps): React.ReactElement {
  const enabledMcpCount = capabilities?.mcpServers.filter((s) => s.enabled).length ?? 0
  const totalMcpCount = capabilities?.mcpServers.length ?? 0
  const enabledSkillCount = capabilities?.skills.filter((s) => s.enabled).length ?? 0
  const totalSkillCount = capabilities?.skills.length ?? 0

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header：标题 + 计数 + 配置 */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-foreground">MCP & Skills</div>
          <div className="text-[11px] text-foreground/40 mt-0.5">
            {capabilities
              ? `${enabledMcpCount}/${totalMcpCount} MCP · ${enabledSkillCount}/${totalSkillCount} Skills`
              : '加载中…'}
          </div>
        </div>
        {onConfigure && (
          <button
            type="button"
            onClick={onConfigure}
            className="flex-shrink-0 size-7 flex items-center justify-center rounded-md text-foreground/45 hover:bg-foreground/[0.06] hover:text-foreground/70 transition-colors"
            title="配置 MCP 与 Skills"
          >
            <Settings2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
        {/* MCP Servers 分组 */}
        <SectionHeader
          icon={<Plug size={12} />}
          label="MCP Servers"
          count={totalMcpCount}
          activeCount={enabledMcpCount}
        />
        {capabilities === null ? (
          <SkeletonRows rows={2} />
        ) : capabilities.mcpServers.length === 0 ? (
          <EmptyHint text="未配置 MCP 服务器" />
        ) : (
          <div className="flex flex-col gap-0.5 mb-4">
            {capabilities.mcpServers.map((server) => (
              <McpServerItem key={server.name} name={server.name} enabled={server.enabled} type={server.type} />
            ))}
          </div>
        )}

        {/* Skills 分组 */}
        <SectionHeader
          icon={<Zap size={12} />}
          label="Skills"
          count={totalSkillCount}
          activeCount={enabledSkillCount}
        />
        {capabilities === null ? (
          <SkeletonRows rows={3} />
        ) : capabilities.skills.length === 0 ? (
          <EmptyHint text="未加载 Skills" />
        ) : (
          <div className="flex flex-col gap-0.5">
            {capabilities.skills.map((skill) => (
              <SkillItem
                key={skill.slug}
                name={skill.name}
                description={skill.description}
                enabled={skill.enabled}
                hasUpdate={skill.hasUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== 子组件 =====

function SectionHeader({
  icon,
  label,
  count,
  activeCount,
}: {
  icon: React.ReactNode
  label: string
  count: number
  activeCount: number
}): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 px-1 pt-2 pb-1.5 text-[11px] font-medium text-foreground/50 select-none">
      <span className="text-foreground/40">{icon}</span>
      <span className="uppercase tracking-wide">{label}</span>
      {count > 0 && (
        <span className="text-foreground/30 tabular-nums ml-auto">
          {activeCount}/{count}
        </span>
      )}
    </div>
  )
}

function McpServerItem({
  name,
  enabled,
  type,
}: {
  name: string
  enabled: boolean
  type: string
}): React.ReactElement {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors',
        enabled ? 'text-foreground/80' : 'text-foreground/40',
      )}
    >
      {enabled ? (
        <CircleCheck size={12} className="flex-shrink-0 text-emerald-500" />
      ) : (
        <CircleDashed size={12} className="flex-shrink-0 text-foreground/30" />
      )}
      <Server size={12} className="flex-shrink-0 text-foreground/30" />
      <span className="flex-1 min-w-0 truncate font-medium">{name}</span>
      <span className="flex-shrink-0 text-[10px] font-mono text-foreground/30 uppercase">{type}</span>
    </div>
  )
}

function SkillItem({
  name,
  description,
  enabled,
  hasUpdate,
}: {
  name: string
  description?: string
  enabled: boolean
  hasUpdate?: boolean
}): React.ReactElement {
  return (
    <div
      className={cn(
        'group flex items-start gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors',
        enabled ? 'text-foreground/80' : 'text-foreground/40',
      )}
    >
      <Zap
        size={12}
        className={cn(
          'flex-shrink-0 mt-0.5',
          enabled ? 'text-primary/70' : 'text-foreground/25',
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{name}</span>
          {hasUpdate && (
            <span title="有可用更新" className="flex-shrink-0 text-amber-500">
              <RotateCw size={10} />
            </span>
          )}
        </div>
        {description && (
          <div className="text-[11px] text-foreground/45 line-clamp-2 leading-snug mt-0.5">
            {description}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }): React.ReactElement {
  return (
    <div className="px-2 py-3 text-[11px] text-foreground/30 text-center select-none">
      {text}
    </div>
  )
}

function SkeletonRows({ rows }: { rows: number }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-6 rounded-md bg-foreground/[0.04] animate-pulse" />
      ))}
    </div>
  )
}
