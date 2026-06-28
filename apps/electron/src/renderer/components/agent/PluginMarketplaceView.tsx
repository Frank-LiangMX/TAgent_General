/**
 * PluginMarketplaceView — 插件市场（整合包 + 散落 MCP/Skill）
 */

import { CheckCircle2, LayoutGrid, Loader2, Plug, Plus, Sparkles } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { BuiltinMcpCatalogEntry, PluginStoreCatalog } from '@tagent/shared'

import { Button, SearchInput, SegmentedTabs, SegmentedTabsItem } from '@tagent/ui'
import { useAtomValue } from 'jotai'

import { pluginSidebarSectionAtom } from '@/atoms/app-mode'
import type { PluginSidebarSection } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

import { PluginMarketplaceBundleDetail } from './PluginMarketplaceBundleDetail'
import { PluginMarketplaceDetail } from './PluginMarketplaceDetail'
import { PluginBundleLogo } from './plugin-marketplace-icons'
import {
  PLUGIN_CATEGORY_LABELS,
  PLUGIN_SECTION_LABELS,
  type MarketplaceBundleItem,
  type MarketplaceCatalogItem,
  type MarketplaceKindFilter,
  buildMarketplaceBundles,
  buildMarketplaceItems,
  countMarketplaceByKind,
  filterMarketplaceBundlesByQuery,
  filterMarketplaceBundlesBySection,
  filterMarketplaceByKind,
  filterMarketplaceByQuery,
  filterMarketplaceBySection,
  sortMarketplaceBundles,
  sortMarketplaceItems,
} from './plugin-marketplace-shared'

type StoreSelection =
  | { kind: 'bundle'; id: string }
  | { kind: 'skill' | 'mcp'; id: string }

interface PluginMarketplaceViewProps {
  workspaceSlug: string
  installedSkillSlugs: string[]
  installedMcpNames: string[]
  onInstallMcp: (mcp: BuiltinMcpCatalogEntry) => void
  onSkillInstalled: () => void
  onBundleInstalled: () => void
  onAddCustomMcp?: () => void
}

export function PluginMarketplaceView({
  workspaceSlug,
  installedSkillSlugs,
  installedMcpNames,
  onInstallMcp,
  onSkillInstalled,
  onBundleInstalled,
  onAddCustomMcp,
}: PluginMarketplaceViewProps): React.ReactElement {
  const section = useAtomValue(pluginSidebarSectionAtom)
  const [catalog, setCatalog] = React.useState<PluginStoreCatalog | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState('')
  const [kindFilter, setKindFilter] = React.useState<MarketplaceKindFilter>('bundle')
  const [installingSkill, setInstallingSkill] = React.useState<string | null>(null)
  const [installingBundle, setInstallingBundle] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<StoreSelection | null>(null)

  const installedSkillSet = React.useMemo(() => new Set(installedSkillSlugs), [installedSkillSlugs])
  const installedMcpSet = React.useMemo(() => new Set(installedMcpNames), [installedMcpNames])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.electronAPI
      .getPluginStoreCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data)
      })
      .catch((err) => {
        console.error('[PluginMarketplaceView] 加载目录失败:', err)
        if (!cancelled) setCatalog({ bundles: [], skills: [], mcps: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    setSelected(null)
  }, [section])

  const baseBundles = React.useMemo(() => {
    const all = buildMarketplaceBundles(catalog)
    const bySection = filterMarketplaceBundlesBySection(all, section)
    const byQuery = filterMarketplaceBundlesByQuery(bySection, query)
    return sortMarketplaceBundles(byQuery)
  }, [catalog, section, query])

  const baseItems = React.useMemo(() => {
    const all = buildMarketplaceItems(catalog)
    const bySection = filterMarketplaceBySection(all, section)
    const byQuery = filterMarketplaceByQuery(bySection, query)
    return sortMarketplaceItems(byQuery)
  }, [catalog, section, query])

  const kindCounts = React.useMemo(
    () => countMarketplaceByKind(baseBundles, baseItems),
    [baseBundles, baseItems]
  )

  const flatItems = React.useMemo(() => {
    if (kindFilter === 'bundle') return []
    const kind = kindFilter === 'all' ? 'all' : kindFilter
    return filterMarketplaceByKind(baseItems, kind)
  }, [baseItems, kindFilter])

  const showBundles = kindFilter === 'bundle' || kindFilter === 'all'
  const bundles = showBundles ? baseBundles : []

  const selectedBundle = React.useMemo(() => {
    if (selected?.kind !== 'bundle' || !catalog) return undefined
    return catalog.bundles.find((bundle) => bundle.id === selected.id)
  }, [selected, catalog])

  const selectedSkill = React.useMemo(() => {
    if (selected?.kind !== 'skill' || !catalog) return undefined
    return catalog.skills.find((s) => s.slug === selected.id)
  }, [selected, catalog])

  const selectedMcp = React.useMemo(() => {
    if (selected?.kind !== 'mcp' || !catalog) return undefined
    return catalog.mcps.find((m) => m.name === selected.id)
  }, [selected, catalog])

  const marketplaceSection = section as Exclude<PluginSidebarSection, 'installed'>
  const sectionTitle = PLUGIN_SECTION_LABELS[marketplaceSection] ?? '插件'

  const handleInstallSkill = async (skillSlug: string): Promise<void> => {
    if (installingSkill || installedSkillSet.has(skillSlug)) return
    setInstallingSkill(skillSlug)
    try {
      await window.electronAPI.installStoreSkill(workspaceSlug, skillSlug)
      onSkillInstalled()
    } catch (error) {
      console.error('[PluginMarketplaceView] 安装 Skill 失败:', error)
      toast.error(error instanceof Error ? error.message : '安装失败')
    } finally {
      setInstallingSkill(null)
    }
  }

  const handleInstallBundle = async (bundleId: string): Promise<void> => {
    if (installingBundle) return
    setInstallingBundle(bundleId)
    try {
      const result = await window.electronAPI.installStoreBundle(workspaceSlug, bundleId)
      onBundleInstalled()
      if (result.errors.length > 0) {
        toast.warning(`部分安装未完成：${result.errors[0]}`)
      } else {
        const installedTotal = result.installedSkills.length + result.installedMcps.length
        const skippedTotal = result.skippedSkills.length + result.skippedMcps.length
        if (installedTotal === 0 && skippedTotal > 0) {
          toast.success('整合包内容已全部安装')
        } else {
          toast.success(`已安装 ${installedTotal} 项${skippedTotal > 0 ? `，跳过 ${skippedTotal} 项已存在` : ''}`)
        }
      }
    } catch (error) {
      console.error('[PluginMarketplaceView] 安装整合包失败:', error)
      toast.error(error instanceof Error ? error.message : '安装失败')
    } finally {
      setInstallingBundle(null)
    }
  }

  const handleInstallItem = (item: MarketplaceCatalogItem): void => {
    if (item.kind === 'mcp' && item.mcp) {
      onInstallMcp(item.mcp)
      return
    }
    if (item.skill) {
      void handleInstallSkill(item.skill.slug)
    }
  }

  const isBundleFullyInstalled = (bundle: MarketplaceBundleItem): boolean => {
    const skillsOk = bundle.bundle.skills.every((slug) => installedSkillSet.has(slug))
    const mcpsOk = bundle.bundle.mcps.every((name) => installedMcpSet.has(name))
    const total = bundle.bundle.skills.length + bundle.bundle.mcps.length
    return total > 0 && skillsOk && mcpsOk
  }

  if (selectedBundle && catalog) {
    return (
      <PluginMarketplaceBundleDetail
        section={marketplaceSection}
        bundle={selectedBundle}
        catalog={catalog}
        installedSkillSlugs={installedSkillSlugs}
        installedMcpNames={installedMcpNames}
        installing={installingBundle === selectedBundle.id}
        onBack={() => setSelected(null)}
        onInstall={() => void handleInstallBundle(selectedBundle.id)}
      />
    )
  }

  if (selectedSkill || selectedMcp) {
    const installed = selectedSkill
      ? installedSkillSet.has(selectedSkill.slug)
      : installedMcpSet.has(selectedMcp!.name)
    const installing = selectedSkill ? installingSkill === selectedSkill.slug : false

    return (
      <PluginMarketplaceDetail
        section={marketplaceSection}
        skill={selectedSkill}
        mcp={selectedMcp}
        installed={installed}
        installing={installing}
        onBack={() => setSelected(null)}
        onInstall={() => {
          if (selectedSkill) {
            void handleInstallSkill(selectedSkill.slug)
          } else if (selectedMcp) {
            onInstallMcp(selectedMcp)
          }
        }}
      />
    )
  }

  const empty =
    !loading && bundles.length === 0 && flatItems.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-border/40 px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{sectionTitle}</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              优先通过整合包安装；MCP / Skill 标签仅展示未收录在整合包中的条目
            </p>
          </div>
          {onAddCustomMcp ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddCustomMcp}>
              <Plus size={14} />
              自定义 MCP
            </Button>
          ) : null}
        </div>
        <SegmentedTabs
          className="max-w-lg"
          value={kindFilter}
          onValueChange={(next) => setKindFilter(next as MarketplaceKindFilter)}
        >
          <SegmentedTabsItem value="bundle" className="gap-1">
            <LayoutGrid size={12} strokeWidth={1.75} />
            整合包
            {!loading ? (
              <span className="text-[10px] tabular-nums opacity-60">{kindCounts.bundle}</span>
            ) : null}
          </SegmentedTabsItem>
          <SegmentedTabsItem value="all" className="gap-1">
            全部
            {!loading ? (
              <span className="text-[10px] tabular-nums opacity-60">{kindCounts.all}</span>
            ) : null}
          </SegmentedTabsItem>
          <SegmentedTabsItem value="mcp" className="gap-1">
            <Plug size={12} strokeWidth={1.75} />
            MCP
            {!loading ? (
              <span className="text-[10px] tabular-nums opacity-60">{kindCounts.mcp}</span>
            ) : null}
          </SegmentedTabsItem>
          <SegmentedTabsItem value="skill" className="gap-1">
            <Sparkles size={12} strokeWidth={1.75} />
            Skill
            {!loading ? (
              <span className="text-[10px] tabular-nums opacity-60">{kindCounts.skill}</span>
            ) : null}
          </SegmentedTabsItem>
        </SegmentedTabs>

        <SearchInput
          variant="glass"
          size="md"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            kindFilter === 'bundle'
              ? '搜索整合包…'
              : kindFilter === 'mcp'
                ? '搜索 MCP…'
                : kindFilter === 'skill'
                  ? '搜索 Skill…'
                  : '搜索整合包、Skill、MCP…'
          }
          className="max-w-xl"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
        {loading ? (
          <MarketplaceSkeletonGrid />
        ) : empty ? (
          <div className="plugins-panel-empty py-16">
            <Sparkles size={24} className="text-muted-foreground/35" strokeWidth={1.5} />
            <p className="mt-2 text-[12px] text-muted-foreground">此分类下没有匹配的插件</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {bundles.map((bundle) => (
              <MarketplaceBundleCard
                key={`bundle:${bundle.id}`}
                item={bundle}
                installed={isBundleFullyInstalled(bundle)}
                installing={installingBundle === bundle.id}
                onSelect={() => setSelected({ kind: 'bundle', id: bundle.id })}
                onGet={(event) => {
                  event.stopPropagation()
                  void handleInstallBundle(bundle.id)
                }}
              />
            ))}
            {flatItems.map((item) => {
              const installed =
                item.kind === 'skill'
                  ? installedSkillSet.has(item.id)
                  : installedMcpSet.has(item.id)
              return (
                <MarketplaceItemCard
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  installed={installed}
                  installing={item.kind === 'skill' && installingSkill === item.id}
                  onSelect={() => setSelected({ kind: item.kind, id: item.id })}
                  onGet={(event) => {
                    event.stopPropagation()
                    handleInstallItem(item)
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MarketplaceBundleCard({
  item,
  installed,
  installing,
  onSelect,
  onGet,
}: {
  item: MarketplaceBundleItem
  installed: boolean
  installing: boolean
  onSelect: () => void
  onGet: (event: React.MouseEvent) => void
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
        <PluginBundleLogo
          logo={item.bundle.logo}
          alt={item.title}
          className="size-10 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[13px] font-semibold text-foreground">{item.title}</h3>
            {item.tier === 'recommended' ? (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                推荐
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            整合包 · MCP ×{item.mcpCount} · Skill ×{item.skillCount}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 flex-1 text-[11px] leading-5 text-muted-foreground">
        {item.description}
      </p>
      <div className="mt-4 flex justify-end">
        {installed ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={12} />
            已安装
          </span>
        ) : (
          <Button size="sm" variant="secondary" disabled={installing} onClick={onGet}>
            {installing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                安装中…
              </>
            ) : (
              '安装'
            )}
          </Button>
        )}
      </div>
    </article>
  )
}

function MarketplaceItemCard({
  item,
  installed,
  installing,
  onSelect,
  onGet,
}: {
  item: MarketplaceCatalogItem
  installed: boolean
  installing: boolean
  onSelect: () => void
  onGet: (event: React.MouseEvent) => void
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
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[13px] font-semibold text-foreground">{item.title}</h3>
            {item.tier === 'recommended' ? (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                推荐
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {item.kind === 'mcp' ? 'MCP' : 'Skill'} · {PLUGIN_CATEGORY_LABELS[item.category]}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 flex-1 text-[11px] leading-5 text-muted-foreground">
        {item.description}
      </p>
      <div className="mt-4 flex justify-end">
        {installed ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={12} />
            已安装
          </span>
        ) : (
          <Button size="sm" variant="secondary" disabled={installing} onClick={onGet}>
            {installing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                安装中…
              </>
            ) : (
              '安装'
            )}
          </Button>
        )}
      </div>
    </article>
  )
}

function MarketplaceSkeletonGrid(): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[148px] animate-pulse rounded-2xl bg-muted/25" />
      ))}
    </div>
  )
}
