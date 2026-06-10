/**
 * SkillsPanel - 工作区 MCP Servers & Skills 列表
 *
 * LeftSidebar 在 activeRailItem === 'skills' 时展示的概览列表。
 * 这里负责把能力条目组织成更清晰的分组、状态和选中态，并把右侧详情页的入口做得更稳。
 */

import { useAtom } from 'jotai'
import {
  CircleCheck,
  CircleDashed,
  Plug,
  RotateCw,
  Settings2,
  Sparkles,
  Zap,
} from 'lucide-react'
import * as React from 'react'

import type { WorkspaceCapabilities } from '@tagent/shared'

import { selectedCapabilityAtom } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

interface SkillsPanelProps {
  /** 工作区能力数据，null 表示尚未加载 */
  capabilities: WorkspaceCapabilities | null
  /** 右上角“配置”按钮回调，默认打开 settings agent tab */
  onConfigure?: () => void
}

export function SkillsPanel({
  capabilities,
  onConfigure,
}: SkillsPanelProps): React.ReactElement {
  const [selectedCapability, setSelectedCapability] = useAtom(selectedCapabilityAtom)

  const enabledMcpCount = capabilities?.mcpServers.filter((s) => s.enabled).length ?? 0
  const totalMcpCount = capabilities?.mcpServers.length ?? 0
  const enabledSkillCount = capabilities?.skills.filter((s) => s.enabled).length ?? 0
  const totalSkillCount = capabilities?.skills.length ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">MCP & Skills</h3>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {capabilities
                ? `${enabledMcpCount}/${totalMcpCount} MCP · ${enabledSkillCount}/${totalSkillCount} Skills`
                : '正在同步工作区能力'}
            </p>
          </div>

          {onConfigure && (
            <button
              type="button"
              onClick={onConfigure}
              className="inline-flex h-8 items-center justify-center rounded-full border border-border/70 bg-muted/40 px-3 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              title="配置 MCP 与 Skills"
            >
              <Settings2 size={14} className="mr-1.5" />
              配置
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatChip
            icon={<Plug size={12} />}
            label="MCP"
            value={capabilities ? `${enabledMcpCount}/${totalMcpCount}` : '...'}
          />
          <StatChip
            icon={<Zap size={12} />}
            label="Skills"
            value={capabilities ? `${enabledSkillCount}/${totalSkillCount}` : '...'}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <CapabilityGroup
          icon={<Plug size={12} />}
          label="MCP servers"
          count={totalMcpCount}
          activeCount={enabledMcpCount}
        />
        {capabilities === null ? (
          <SkeletonRows rows={2} />
        ) : capabilities.mcpServers.length === 0 ? (
          <EmptyHint
            icon={<Plug size={14} />}
            title="暂无 MCP"
            text="这里还没有配置任何 MCP 服务器。"
          />
        ) : (
          <div className="mb-4 flex flex-col gap-1.5">
            {capabilities.mcpServers.map((server) => (
              <McpServerItem
                key={server.name}
                name={server.name}
                enabled={server.enabled}
                type={server.type}
                selected={selectedCapability?.type === 'mcp' && selectedCapability.key === server.name}
                onClick={() => setSelectedCapability({ type: 'mcp', key: server.name })}
              />
            ))}
          </div>
        )}

        <CapabilityGroup
          icon={<Sparkles size={12} />}
          label="Skills"
          count={totalSkillCount}
          activeCount={enabledSkillCount}
        />
        {capabilities === null ? (
          <SkeletonRows rows={3} />
        ) : capabilities.skills.length === 0 ? (
          <EmptyHint
            icon={<Sparkles size={14} />}
            title="暂无 Skills"
            text="导入或创建后，这里会显示可用的工作区 Skills。"
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {capabilities.skills.map((skill) => (
              <SkillItem
                key={skill.slug}
                slug={skill.slug}
                name={skill.name}
                description={skill.description}
                enabled={skill.enabled}
                hasUpdate={skill.hasUpdate}
                selected={selectedCapability?.type === 'skill' && selectedCapability.key === skill.slug}
                onClick={() => setSelectedCapability({ type: 'skill', key: skill.slug })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/35 px-3 py-2">
      <span className="text-foreground/45">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
        <div className="text-xs font-medium text-foreground tabular-nums">{value}</div>
      </div>
    </div>
  )
}

function CapabilityGroup({
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
    <div className="mb-2 flex items-center justify-between px-1">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <span className="text-foreground/40">{icon}</span>
        <span className="tracking-[0.18em] uppercase">{label}</span>
      </div>
      <div className="rounded-full border border-border/60 bg-muted/35 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
        {activeCount}/{count}
      </div>
    </div>
  )
}

function McpServerItem({
  name,
  enabled,
  type,
  selected,
  onClick,
}: {
  name: string
  enabled: boolean
  type: string
  selected?: boolean
  onClick?: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        selected
          ? 'border-primary/25 bg-primary/8 shadow-sm shadow-primary/5'
          : enabled
            ? 'border-border/60 bg-background/70 hover:border-border hover:bg-muted/35'
            : 'border-border/40 bg-muted/20 hover:border-border hover:bg-muted/35',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border',
            enabled
              ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-600'
              : 'border-border/60 bg-muted text-muted-foreground',
          )}
        >
          {enabled ? <CircleCheck size={12} /> : <CircleDashed size={12} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            <span className="shrink-0 rounded-full border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {type}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{enabled ? '已启用' : '已禁用'}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="truncate">点击查看详情</span>
          </div>
        </div>
      </div>
    </button>
  )
}

function SkillItem({
  slug: _slug,
  name,
  description,
  enabled,
  hasUpdate,
  selected,
  onClick,
}: {
  slug: string
  name: string
  description?: string
  enabled: boolean
  hasUpdate?: boolean
  selected?: boolean
  onClick?: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        selected
          ? 'border-primary/25 bg-primary/8 shadow-sm shadow-primary/5'
          : enabled
            ? 'border-border/60 bg-background/70 hover:border-border hover:bg-muted/35'
            : 'border-border/40 bg-muted/20 hover:border-border hover:bg-muted/35',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border',
            enabled
              ? 'border-amber-500/15 bg-amber-500/10 text-amber-600'
              : 'border-border/60 bg-muted text-muted-foreground',
          )}
        >
          <Zap size={12} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            {hasUpdate && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                <RotateCw size={10} />
                更新
              </span>
            )}
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
            {description ?? '暂无描述'}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground/80">
            <span>{enabled ? '已启用' : '已禁用'}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="truncate">点击查看详情</span>
          </div>
        </div>
      </div>
    </button>
  )
}

function EmptyHint({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}): React.ReactElement {
  return (
    <div className="mb-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center">
      <div className="mx-auto flex size-9 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground">
        {icon}
      </div>
      <div className="mt-3 text-sm font-medium text-foreground">{title}</div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{text}</p>
    </div>
  )
}

function SkeletonRows({ rows }: { rows: number }): React.ReactElement {
  return (
    <div className="mb-4 flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[66px] rounded-xl border border-border/40 bg-muted/20 animate-pulse" />
      ))}
    </div>
  )
}
