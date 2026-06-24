/**
 * PluginsPanel - 工作区插件导航（双列卡片 + MCP / Skill Tab）
 */

import { useAtom } from 'jotai'
import {
  CircleCheck,
  LayoutGrid,
  Plug,
  RotateCw,
  Search,
  Sparkles,
} from 'lucide-react'
import * as React from 'react'

import type { WorkspaceCapabilities } from '@tagent/shared'

import { pluginKindTabAtom, selectedCapabilityAtom, type PluginKindTab } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

interface PluginListItem {
  id: string
  kind: PluginKindTab
  title: string
  subtitle?: string
  enabled: boolean
  hasUpdate?: boolean
}

interface PluginsPanelProps {
  capabilities: WorkspaceCapabilities | null
}

/** @deprecated 使用 PluginsPanel */
export type SkillsPanelProps = PluginsPanelProps

export function PluginsPanel({ capabilities }: PluginsPanelProps): React.ReactElement {
  const [selectedCapability, setSelectedCapability] = useAtom(selectedCapabilityAtom)
  const [kindTab, setKindTab] = useAtom(pluginKindTabAtom)
  const [query, setQuery] = React.useState('')

  const { mcpItems, skillItems } = React.useMemo(() => {
    if (!capabilities) {
      return { mcpItems: [] as PluginListItem[], skillItems: [] as PluginListItem[] }
    }
    const mcpItems: PluginListItem[] = capabilities.mcpServers
      .map((server) => ({
        id: server.name,
        kind: 'mcp' as const,
        title: server.name,
        subtitle: server.type,
        enabled: server.enabled,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
    const skillItems: PluginListItem[] = capabilities.skills
      .map((skill) => ({
        id: skill.slug,
        kind: 'skill' as const,
        title: skill.name,
        subtitle: skill.description ?? skill.slug,
        enabled: skill.enabled,
        hasUpdate: skill.hasUpdate,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
    return { mcpItems, skillItems }
  }, [capabilities])

  const activeItems = kindTab === 'mcp' ? mcpItems : skillItems
  const enabledCount = activeItems.filter((item) => item.enabled).length
  const normalizedQuery = query.trim().toLowerCase()

  const visibleItems = activeItems.filter((item) => {
    if (!normalizedQuery) return true
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      (item.subtitle?.toLowerCase().includes(normalizedQuery) ?? false)
    )
  })

  const selectedKey =
    selectedCapability?.type === 'mcp'
      ? `mcp:${selectedCapability.key}`
      : selectedCapability?.type === 'skill'
        ? `skill:${selectedCapability.key}`
        : null

  const tabIndex = kindTab === 'mcp' ? 0 : 1
  const [gridPhase, setGridPhase] = React.useState(0)

  const handleKindTabChange = React.useCallback(
    (tab: PluginKindTab) => {
      if (tab === kindTab) return
      setKindTab(tab)
      setGridPhase((value) => value + 1)
      if (!capabilities) return

      const list = tab === 'mcp' ? capabilities.mcpServers : capabilities.skills
      if (list.length === 0) {
        setSelectedCapability(null)
        return
      }
      const first = list[0]!
      if (tab === 'mcp') {
        setSelectedCapability({ type: 'mcp', key: first.name })
      } else {
        setSelectedCapability({ type: 'skill', key: (first as { slug: string }).slug })
      }
    },
    [capabilities, kindTab, setKindTab, setSelectedCapability]
  )

  const handleSelectItem = React.useCallback(
    (item: PluginListItem) => {
      if (item.kind !== kindTab) {
        setKindTab(item.kind)
      }
      setSelectedCapability(
        item.kind === 'mcp' ? { type: 'mcp', key: item.id } : { type: 'skill', key: item.id }
      )
    },
    [kindTab, setKindTab, setSelectedCapability]
  )

  return (
    <div className="plugins-panel flex h-full min-h-0 flex-col">
      <div className="plugins-panel-header shrink-0 px-3 pb-2 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <LayoutGrid size={14} className="shrink-0 text-muted-foreground/75" strokeWidth={1.75} />
          <span className="text-[12px] font-semibold text-foreground">插件</span>
          <span className="rounded-md bg-foreground/6 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {capabilities ? `${enabledCount}/${activeItems.length}` : '…'}
          </span>
        </div>

        <div className="agent-model-segmented agent-model-segmented--2 mt-2.5">
          <div
            className="agent-model-segmented-indicator"
            style={{ transform: `translateX(${tabIndex * 100}%)` }}
          />
          <button
            type="button"
            onClick={() => handleKindTabChange('mcp')}
            className={cn(
              'agent-model-segmented-option gap-1',
              kindTab === 'mcp' && 'agent-model-segmented-option--active'
            )}
          >
            <Plug size={12} strokeWidth={1.75} />
            <span>MCP</span>
            {capabilities ? (
              <span className="text-[10px] tabular-nums opacity-60">{mcpItems.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => handleKindTabChange('skill')}
            className={cn(
              'agent-model-segmented-option gap-1',
              kindTab === 'skill' && 'agent-model-segmented-option--active'
            )}
          >
            <Sparkles size={12} strokeWidth={1.75} />
            <span>Skill</span>
            {capabilities ? (
              <span className="text-[10px] tabular-nums opacity-60">{skillItems.length}</span>
            ) : null}
          </button>
        </div>

        <label className="plugins-panel-search relative mt-2.5 flex items-center gap-2 rounded-xl px-2.5 py-1.5">
          <Search size={13} className="shrink-0 text-muted-foreground/65" strokeWidth={2} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={kindTab === 'mcp' ? '搜索 MCP…' : '搜索 Skill…'}
            className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/55"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5 scrollbar-thin">
        {capabilities === null ? (
          <PluginCardSkeletonGrid />
        ) : visibleItems.length === 0 ? (
          <div className="plugins-panel-empty">
            <LayoutGrid size={20} className="text-muted-foreground/35" strokeWidth={1.5} />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {activeItems.length === 0
                ? kindTab === 'mcp'
                  ? '暂无 MCP 插件'
                  : '暂无 Skill 插件'
                : '没有匹配的插件'}
            </p>
          </div>
        ) : (
          <div
            key={`${kindTab}-${gridPhase}`}
            className="plugins-panel-grid grid grid-cols-2 gap-2"
          >
            {visibleItems.map((item, index) => {
              const itemKey = `${item.kind}:${item.id}`
              const selected = selectedKey === itemKey
              return (
                <PluginCard
                  key={itemKey}
                  item={item}
                  selected={selected}
                  style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                  onClick={() => handleSelectItem(item)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** @deprecated 使用 PluginsPanel */
export const SkillsPanel = PluginsPanel

function PluginCard({
  item,
  selected,
  onClick,
  style,
}: {
  item: PluginListItem
  selected: boolean
  onClick: () => void
  style?: React.CSSProperties
}): React.ReactElement {
  const Icon = item.kind === 'mcp' ? Plug : Sparkles
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        'plugins-panel-card group relative flex min-h-[88px] flex-col items-start gap-2 rounded-[14px] p-2.5 text-left transition-[transform,box-shadow,background-color] duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
        selected
          ? 'plugins-panel-card--selected'
          : 'hover:-translate-y-px hover:bg-foreground/[0.04]'
      )}
    >
      <div className="flex w-full items-start justify-between gap-1">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-[10px]',
            item.kind === 'mcp'
              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
          )}
        >
          <Icon size={13} strokeWidth={1.85} />
        </span>
        {item.hasUpdate ? (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/12 px-1 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
            <RotateCw size={8} />
            更新
          </span>
        ) : item.enabled ? (
          <CircleCheck size={12} className="text-emerald-500/85" strokeWidth={2} />
        ) : (
          <span className="size-2 rounded-full bg-muted-foreground/25" />
        )}
      </div>
      <span className="line-clamp-2 w-full text-[11px] font-semibold leading-4 text-foreground">
        {item.title}
      </span>
      {item.subtitle ? (
        <span className="line-clamp-2 w-full text-[10px] leading-3.5 text-muted-foreground">
          {item.subtitle}
        </span>
      ) : null}
    </button>
  )
}

function PluginCardSkeletonGrid(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[88px] animate-pulse rounded-[14px] bg-muted/25" />
      ))}
    </div>
  )
}
