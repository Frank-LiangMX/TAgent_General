/**
 * InstalledPluginsView — 已安装插件主区（与市场页同构：卡片浏览 + 点击详情）
 */

import { CheckCircle2, LayoutGrid, Plug, Sparkles } from 'lucide-react'
import * as React from 'react'

import type { PluginStoreCatalog, WorkspaceCapabilities } from '@tagent/shared'

import { useAtomValue } from 'jotai'

import { installedPluginNavAtom } from '@/atoms/app-mode'
import { SearchInput } from '@tagent/ui'
import { cn } from '@/lib/utils'

import { InstalledBundleDetail } from './InstalledBundleDetail'
import { InstalledPluginDetail } from './InstalledPluginDetail'
import {
  groupInstalledPlugins,
  type InstalledBundleGroup,
  type PluginListItem,
} from './installed-plugins-grouping'
import {
  INSTALLED_NAV_LABELS,
  parseBundleNavId,
  resolveInstalledGridView,
} from './installed-plugin-nav'
import { PluginBundleLogo } from './plugin-marketplace-icons'

interface InstalledPluginsViewProps {
  capabilities: WorkspaceCapabilities | null
  workspaceSlug: string
}

type InstalledSelection = { kind: 'bundle'; id: string } | { kind: 'skill' | 'mcp'; id: string }

export function InstalledPluginsView({
  capabilities,
  workspaceSlug,
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
      <div className="shrink-0 space-y-3 border-b border-border/40 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{navTitle}</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            点击卡片查看状态与管理选项
            {!loading ? (
              <span className="ml-1 tabular-nums text-foreground/70">
                · 共 {totalCount} 项已安装
              </span>
            ) : null}
          </p>
        </div>

        <SearchInput
          variant="glass"
          size="md"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索已安装插件…"
          className="max-w-xl"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
        {loading ? (
          <InstalledSkeletonGrid />
        ) : empty ? (
          <div className="plugins-panel-empty py-16">
            <Sparkles size={24} className="text-muted-foreground/35" strokeWidth={1.5} />
            <p className="mt-2 text-[12px] text-muted-foreground">
              {totalCount === 0 ? '暂无已安装插件，去市场看看吧' : '没有匹配的插件'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'flex cursor-pointer flex-col rounded-2xl border border-border/45 bg-card/40 p-4 shadow-sm shadow-foreground/[0.02]',
        'transition-colors hover:border-border/70 hover:bg-card/70',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35'
      )}
    >
      <div className="flex items-start gap-3">
        {group.logo ? (
          <PluginBundleLogo
            logo={group.logo}
            alt={group.name}
            className="size-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06]">
            <LayoutGrid size={18} strokeWidth={1.75} className="text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-foreground">{group.name}</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            整合包 · 已装 {group.installedCount}/{group.totalCount}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 flex-1 text-[11px] leading-5 text-muted-foreground">
        {group.items.map((item) => item.title).join('、') || '暂无成员'}
      </p>
      <div className="mt-4 flex justify-end">
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={12} />
          已安装
        </span>
      </div>
    </article>
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

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'flex cursor-pointer flex-col rounded-2xl border border-border/45 bg-card/40 p-4 shadow-sm shadow-foreground/[0.02]',
        'transition-colors hover:border-border/70 hover:bg-card/70',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/35'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            item.kind === 'mcp'
              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
          )}
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-foreground">{item.title}</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {item.kind === 'mcp' ? 'MCP' : 'Skill'}
            {item.subtitle
              ? ` · ${item.subtitle.slice(0, 24)}${item.subtitle.length > 24 ? '…' : ''}`
              : ''}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium',
            item.enabled
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {item.enabled ? '已启用' : '已禁用'}
        </span>
        {item.hasUpdate ? (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">有更新</span>
        ) : null}
      </div>
    </article>
  )
}

function InstalledSkeletonGrid(): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-muted/25" />
      ))}
    </div>
  )
}
