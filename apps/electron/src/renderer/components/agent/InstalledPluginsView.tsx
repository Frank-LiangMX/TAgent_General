/**
 * InstalledPluginsView — 已安装插件主区（spatial）
 */

import { CheckCircle2, LayoutGrid, Plug, Sparkles } from 'lucide-react'
import * as React from 'react'

import type { PluginStoreCatalog, WorkspaceCapabilities } from '@tagent/shared'

import { useAtomValue } from 'jotai'

import { SearchInput } from '@tagent/ui'

import { InstalledBundleDetail } from './InstalledBundleDetail'
import { InstalledPluginDetail } from './InstalledPluginDetail'
import {
  groupInstalledPlugins,
  skillOriginLabel,
  skillStatusLabel,
  type InstalledBundleGroup,
  type PluginListItem,
} from './installed-plugins-grouping'
import {
  INSTALLED_NAV_LABELS,
  parseBundleNavId,
  resolveInstalledGridView,
} from './installed-plugin-nav'
import { PluginBundleLogo } from './plugin-marketplace-icons'
import { cn } from '@/lib/utils'
import { installedPluginNavAtom } from '@/atoms/app-mode'

interface InstalledPluginsViewProps {
  capabilities: WorkspaceCapabilities | null
  workspaceSlug: string
  toolbar?: React.ReactNode
}

type InstalledSelection = { kind: 'bundle'; id: string } | { kind: 'skill' | 'mcp'; id: string }

export function InstalledPluginsView({
  capabilities,
  workspaceSlug,
  toolbar,
}: InstalledPluginsViewProps): React.ReactElement {
  const installedNav = useAtomValue(installedPluginNavAtom)
  const [catalog, setCatalog] = React.useState<PluginStoreCatalog | null>(null)
  const [loadingCatalog, setLoadingCatalog] = React.useState(true)
  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState<InstalledSelection | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoadingCatalog(true)
    window.electronAPI
      .getPluginStoreCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data)
      })
      .catch(() => {
        if (!cancelled) setCatalog(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    setSelected(null)
  }, [workspaceSlug, installedNav])

  const grouping = React.useMemo(() => {
    if (!capabilities) {
      return { bundleGroups: [], orphanItems: [] }
    }
    return groupInstalledPlugins(capabilities, catalog)
  }, [capabilities, catalog])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredGrouping = React.useMemo(() => {
    if (!normalizedQuery) return grouping
    const bundleGroups = grouping.bundleGroups
      .map((group) => {
        const nameMatch = group.name.toLowerCase().includes(normalizedQuery)
        const matchedItems = group.items.filter(
          (item) =>
            item.title.toLowerCase().includes(normalizedQuery) ||
            (item.subtitle?.toLowerCase().includes(normalizedQuery) ?? false)
        )
        if (!nameMatch && matchedItems.length === 0) return null
        return { ...group, items: nameMatch ? group.items : matchedItems }
      })
      .filter((group): group is InstalledBundleGroup => group != null)
    const orphanItems = grouping.orphanItems.filter(
      (item) =>
        item.title.toLowerCase().includes(normalizedQuery) ||
        (item.subtitle?.toLowerCase().includes(normalizedQuery) ?? false)
    )
    return { bundleGroups, orphanItems }
  }, [grouping, normalizedQuery])

  const gridView = React.useMemo(
    () => resolveInstalledGridView(installedNav, filteredGrouping),
    [installedNav, filteredGrouping]
  )

  const bundles = gridView.bundles
  const flatItems = gridView.items

  const navTitle = React.useMemo(() => {
    const bundleId = parseBundleNavId(installedNav)
    if (bundleId) {
      return (
        filteredGrouping.bundleGroups.find((group) => group.bundleId === bundleId)?.name ?? '整合包'
      )
    }
    if (installedNav in INSTALLED_NAV_LABELS) {
      return INSTALLED_NAV_LABELS[installedNav as keyof typeof INSTALLED_NAV_LABELS]
    }
    return '已安装'
  }, [installedNav, filteredGrouping.bundleGroups])

  const selectedBundle = React.useMemo(() => {
    if (selected?.kind !== 'bundle') return undefined
    return filteredGrouping.bundleGroups.find((group) => group.bundleId === selected.id)
  }, [selected, filteredGrouping.bundleGroups])

  const selectedItem = React.useMemo((): PluginListItem | undefined => {
    if (selected?.kind === 'bundle') return undefined
    const key = `${selected?.kind}:${selected?.id}`
    const fromBundles = filteredGrouping.bundleGroups.flatMap((group) => group.items)
    return [...fromBundles, ...filteredGrouping.orphanItems].find(
      (item) => `${item.kind}:${item.id}` === key
    )
  }, [selected, filteredGrouping])

  const handleSelectItem = (item: PluginListItem): void => {
    setSelected({ kind: item.kind, id: item.id })
  }

  const handleBack = (): void => {
    setSelected(null)
  }

  if (selectedBundle) {
    return (
      <InstalledBundleDetail
        group={selectedBundle}
        onBack={handleBack}
        onSelectItem={handleSelectItem}
      />
    )
  }

  if (selectedItem && selected) {
    return (
      <InstalledPluginDetail
        item={selectedItem}
        workspaceSlug={workspaceSlug}
        onBack={handleBack}
      />
    )
  }

  const loading = capabilities === null || loadingCatalog
  const empty = !loading && bundles.length === 0 && flatItems.length === 0
  const totalCount =
    capabilities === null ? 0 : capabilities.mcpServers.length + capabilities.skills.length

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3.5 px-6 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="md-text text-[18px] font-semibold tracking-tight">{navTitle}</h2>
            <p className="md-text-variant mt-1 text-[12px] leading-relaxed">
              点击卡片查看状态与管理
              {!loading ? <span className="ml-1 tabular-nums">· 共 {totalCount} 项</span> : null}
            </p>
          </div>
          {toolbar}
        </div>

        <SearchInput
          variant="glass"
          size="md"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索已安装插件…"
          className="max-w-md"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 scrollbar-thin">
        {loading ? (
          <InstalledSkeletonGrid />
        ) : empty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Sparkles size={24} className="md-text-faint" strokeWidth={1.5} />
            <p className="md-text-variant mt-2 text-[12px]">
              {totalCount === 0 ? '暂无已安装插件，去市场看看吧' : '没有匹配的插件'}
            </p>
          </div>
        ) : (
          <div className="kanban-crew-field grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {bundles.map((group) => (
              <InstalledBundleCard
                key={group.bundleId}
                group={group}
                onSelect={() => setSelected({ kind: 'bundle', id: group.bundleId })}
              />
            ))}
            {flatItems.map((item) => (
              <InstalledItemCard
                key={`${item.kind}:${item.id}`}
                item={item}
                onSelect={() => handleSelectItem(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InstalledBundleCard({
  group,
  onSelect,
}: {
  group: InstalledBundleGroup
  onSelect: () => void
}): React.ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className="kanban-crew-badge flex h-full min-h-[120px] cursor-pointer flex-col p-3.5 text-left titlebar-no-drag ui-pressable"
    >
      <div className="flex items-start gap-3">
        {group.logo ? (
          <PluginBundleLogo
            logo={group.logo}
            alt={group.name}
            className="size-9 shrink-0 rounded-glass-popover object-cover"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04]">
            <LayoutGrid className="size-4 md-text-variant" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="md-text truncate text-[13px] font-medium tracking-tight">{group.name}</h3>
          <p className="md-text-faint mt-0.5 text-[10px]">
            整合包 · 已装 {group.installedCount}/{group.totalCount}
          </p>
        </div>
      </div>
      <p className="md-text-variant mt-3 line-clamp-2 flex-1 text-[11px] leading-relaxed">
        {group.items.map((item) => item.title).join('、') || '暂无成员'}
      </p>
      <div className="mt-3 flex justify-end border-t border-foreground/[0.05] pt-2">
        <span className="inline-flex h-7 items-center gap-1 px-2 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3" strokeWidth={1.75} />
          已安装
        </span>
      </div>
    </div>
  )
}

function InstalledItemCard({
  item,
  onSelect,
}: {
  item: PluginListItem
  onSelect: () => void
}): React.ReactElement {
  const Icon = item.kind === 'mcp' ? Plug : Sparkles
  const statusLabel = item.kind === 'skill' ? skillStatusLabel(item.skillStatus) : null
  const originLabel =
    item.kind === 'skill' ? skillOriginLabel(item.skillCreatedBy, item.skillProvenance) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className="kanban-crew-badge flex h-full min-h-[120px] cursor-pointer flex-col p-3.5 text-left titlebar-no-drag ui-pressable"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            item.kind === 'mcp'
              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="md-text truncate text-[13px] font-medium tracking-tight">{item.title}</h3>
          <p className="md-text-faint mt-0.5 text-[10px]">
            {item.kind === 'mcp' ? 'MCP' : 'Skill'}
            {item.skillScope === 'global' ? ' · 全局' : ''}
            {item.subtitle
              ? ` · ${item.subtitle.slice(0, 24)}${item.subtitle.length > 24 ? '…' : ''}`
              : ''}
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            item.enabled
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'bg-foreground/[0.05] md-text-faint'
          )}
        >
          {item.enabled ? '已启用' : '已禁用'}
        </span>
        {statusLabel ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              item.skillStatus === 'draft' && 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
              item.skillStatus === 'active' &&
                'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              item.skillStatus === 'stale' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
              item.skillStatus === 'archived' && 'bg-foreground/[0.05] md-text-faint'
            )}
          >
            {statusLabel}
          </span>
        ) : null}
        {originLabel ? (
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
            {originLabel}
          </span>
        ) : null}
        {item.skillPinned ? (
          <span className="rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[10px] md-text-faint">
            钉住
          </span>
        ) : null}
        {typeof item.skillUseCount === 'number' && item.skillUseCount > 0 ? (
          <span className="md-text-faint ml-auto text-[10px] tabular-nums">
            用过 {item.skillUseCount} 次
          </span>
        ) : null}
        {item.hasUpdate ? (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">有更新</span>
        ) : null}
      </div>
    </div>
  )
}

function InstalledSkeletonGrid(): React.ReactElement {
  return (
    <div className="kanban-crew-field grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[120px] animate-pulse rounded-glass-popover bg-foreground/[0.04]"
        />
      ))}
    </div>
  )
}
