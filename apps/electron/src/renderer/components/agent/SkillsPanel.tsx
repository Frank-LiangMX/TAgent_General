/**
 * SkillsPanel - 工作区 MCP & Skills 导航列表（Navigator 翼）
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

type SkillsFilter = 'all' | 'mcp' | 'skills'

interface SkillsPanelProps {
  capabilities: WorkspaceCapabilities | null
  onConfigure?: () => void
}

export function SkillsPanel({
  capabilities,
  onConfigure,
}: SkillsPanelProps): React.ReactElement {
  const [selectedCapability, setSelectedCapability] = useAtom(selectedCapabilityAtom)
  const [filter, setFilter] = React.useState<SkillsFilter>('all')

  const enabledMcpCount = capabilities?.mcpServers.filter((s) => s.enabled).length ?? 0
  const totalMcpCount = capabilities?.mcpServers.length ?? 0
  const enabledSkillCount = capabilities?.skills.filter((s) => s.enabled).length ?? 0
  const totalSkillCount = capabilities?.skills.length ?? 0

  const showMcp = filter === 'all' || filter === 'mcp'
  const showSkills = filter === 'all' || filter === 'skills'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3">
        <div className="min-w-0">
          <span className="text-[11px] font-medium text-foreground">MCP & Skills</span>
          <span className="ml-2 text-[10px] tabular-nums text-muted-foreground">
            {capabilities
              ? `${enabledMcpCount + enabledSkillCount}/${totalMcpCount + totalSkillCount}`
              : '…'}
          </span>
        </div>
        {onConfigure ? (
          <button
            type="button"
            onClick={onConfigure}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            title="配置 MCP 与 Skills"
          >
            <Settings2 size={14} />
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-1 border-b border-border/40 px-2 py-1.5">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>全部</FilterChip>
        <FilterChip active={filter === 'mcp'} onClick={() => setFilter('mcp')}>
          MCP {totalMcpCount > 0 ? `(${totalMcpCount})` : ''}
        </FilterChip>
        <FilterChip active={filter === 'skills'} onClick={() => setFilter('skills')}>
          Skills {totalSkillCount > 0 ? `(${totalSkillCount})` : ''}
        </FilterChip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1 scrollbar-thin">
        {capabilities === null ? (
          <SkeletonRows rows={5} />
        ) : (
          <>
            {showMcp ? (
              <section className="mb-1">
                {capabilities.mcpServers.length === 0 ? (
                  <EmptyRow icon={<Plug size={12} />} text="暂无 MCP" />
                ) : (
                  capabilities.mcpServers.map((server) => (
                    <NavigatorRow
                      key={server.name}
                      icon={server.enabled ? <CircleCheck size={12} /> : <CircleDashed size={12} />}
                      iconClassName={server.enabled ? 'text-emerald-500' : 'text-muted-foreground/50'}
                      title={server.name}
                      subtitle={server.type}
                      selected={selectedCapability?.type === 'mcp' && selectedCapability.key === server.name}
                      onClick={() => setSelectedCapability({ type: 'mcp', key: server.name })}
                    />
                  ))
                )}
              </section>
            ) : null}

            {showSkills ? (
              <section>
                {capabilities.skills.length === 0 ? (
                  <EmptyRow icon={<Sparkles size={12} />} text="暂无 Skills" />
                ) : (
                  capabilities.skills.map((skill) => (
                    <NavigatorRow
                      key={skill.slug}
                      icon={<Zap size={12} />}
                      iconClassName={skill.enabled ? 'text-amber-500' : 'text-muted-foreground/50'}
                      title={skill.name}
                      subtitle={skill.description ?? skill.slug}
                      badge={skill.hasUpdate ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                          <RotateCw size={9} />
                          更新
                        </span>
                      ) : undefined}
                      selected={selectedCapability?.type === 'skill' && selectedCapability.key === skill.slug}
                      onClick={() => setSelectedCapability({ type: 'skill', key: skill.slug })}
                    />
                  ))
                )}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
        active
          ? 'bg-foreground/8 text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function NavigatorRow({
  icon,
  iconClassName,
  title,
  subtitle,
  badge,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  iconClassName?: string
  title: string
  subtitle?: string
  badge?: React.ReactNode
  selected?: boolean
  onClick?: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
        selected ? 'bg-accent/70' : 'hover:bg-accent/40',
      )}
    >
      {selected ? (
        <span className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-primary" aria-hidden />
      ) : null}
      <span className={cn('mt-0.5 shrink-0', iconClassName)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-foreground">{title}</span>
          {badge}
        </span>
        {subtitle ? (
          <span className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </button>
  )
}

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-muted-foreground">
      <span className="text-muted-foreground/50">{icon}</span>
      {text}
    </div>
  )
}

function SkeletonRows({ rows }: { rows: number }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 px-2 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/30" />
      ))}
    </div>
  )
}
