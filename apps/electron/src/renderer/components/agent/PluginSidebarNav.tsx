/**
 * PluginSidebarNav — 插件市场 / 已安装左栏分类导航（Cursor Marketplace 式）
 */

import { useAtom } from 'jotai'
import {
  BookOpen,
  Brain,
  FolderOpen,
  LayoutGrid,
  Package,
  Plug,
  Sparkles,
  Wrench,
} from 'lucide-react'
import * as React from 'react'

import type { PluginStoreCatalog, WorkspaceCapabilities } from '@tagent/shared'

import {
  installedPluginNavAtom,
  pluginSidebarSectionAtom,
} from '@/atoms/app-mode'
import type { PluginSidebarSection } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

import { groupInstalledPlugins } from './installed-plugins-grouping'
import {
  bundleNavId,
  INSTALLED_NAV_LABELS,
  type InstalledPluginNavFilter,
} from './installed-plugin-nav'
import { PluginNavItem, PluginNavSlideList } from './PluginNavSlideList'
import { PluginBundleLogo } from './plugin-marketplace-icons'
import { PLUGIN_SECTION_LABELS } from './plugin-marketplace-shared'

interface PluginSidebarNavProps {
  capabilities: WorkspaceCapabilities | null
}

interface NavSection {
  id: Exclude<PluginSidebarSection, 'installed'>
  icon: React.ReactNode
}

const NAV_SECTIONS: NavSection[] = [
  { id: 'recommended', icon: <Sparkles size={14} strokeWidth={1.75} /> },
  { id: 'dev', icon: <Plug size={14} strokeWidth={1.75} /> },
  { id: 'workflow', icon: <Wrench size={14} strokeWidth={1.75} /> },
  { id: 'office', icon: <BookOpen size={14} strokeWidth={1.75} /> },
  { id: 'planning', icon: <Brain size={14} strokeWidth={1.75} /> },
  { id: 'meta', icon: <LayoutGrid size={14} strokeWidth={1.75} /> },
  { id: 'ta', icon: <FolderOpen size={14} strokeWidth={1.75} /> },
]

const STATIC_INSTALLED_NAV: Exclude<InstalledPluginNavFilter, `bundle:${string}`>[] = ['overview', 'orphan', 'mcp', 'skill']

export function PluginSidebarNav({ capabilities }: PluginSidebarNavProps): React.ReactElement {
  const [section, setSection] = useAtom(pluginSidebarSectionAtom)
  const [installedNav, setInstalledNav] = useAtom(installedPluginNavAtom)
  const [catalog, setCatalog] = React.useState<PluginStoreCatalog | null>(null)

  React.useEffect(() => {
    if (section !== 'installed') return
    let cancelled = false
    window.electronAPI
      .getPluginStoreCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data)
      })
      .catch(() => {
        if (!cancelled) setCatalog(null)
      })
    return () => {
      cancelled = true
    }
  }, [section])

  const installedGrouping = React.useMemo(() => {
    if (!capabilities) {
      return { bundleGroups: [], orphanItems: [] }
    }
    return groupInstalledPlugins(capabilities, catalog)
  }, [capabilities, catalog])

  const installedCounts = React.useMemo(() => {
    const allItems = [
      ...installedGrouping.bundleGroups.flatMap((group) => group.items),
      ...installedGrouping.orphanItems,
    ]
    const unique = new Map(allItems.map((item) => [`${item.kind}:${item.id}`, item] as const))
    const items = [...unique.values()]
    return {
      total: items.length,
      orphan: installedGrouping.orphanItems.length,
      mcp: items.filter((item) => item.kind === 'mcp').length,
      skill: items.filter((item) => item.kind === 'skill').length,
    }
  }, [installedGrouping])

  const installedNavLayoutKey = React.useMemo(
    () =>
      [
        installedGrouping.bundleGroups.map((group) => group.bundleId).join(','),
        installedCounts.orphan,
        installedCounts.mcp,
        installedCounts.skill,
      ].join('|'),
    [installedGrouping.bundleGroups, installedCounts]
  )

  const handleSelectSection = (next: PluginSidebarSection): void => {
    setSection(next)
    if (next === 'installed') {
      setInstalledNav('overview')
    }
  }

  const handleSelectInstalledNav = (next: InstalledPluginNavFilter): void => {
    setInstalledNav(next)
  }

  if (section === 'installed') {
    return (
      <div className="plugins-panel flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-3 pb-2 pt-2.5">
          <button
            type="button"
            onClick={() => handleSelectSection('recommended')}
            className="mb-2 rounded-lg px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
          >
            ← 返回市场
          </button>
          <div className="flex min-w-0 items-center gap-1.5">
            <LayoutGrid size={14} className="shrink-0 text-muted-foreground/75" strokeWidth={1.75} />
            <span className="text-[12px] font-semibold text-foreground">已安装</span>
            <span className="ml-auto rounded-md bg-foreground/6 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {capabilities ? installedCounts.total : '…'}
            </span>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
          {capabilities === null ? (
            <InstalledNavSkeleton />
          ) : (
            <PluginNavSlideList activeId={installedNav} layoutKey={installedNavLayoutKey}>
              {STATIC_INSTALLED_NAV.map((navId) => {
                if (navId === 'orphan' && installedCounts.orphan === 0) return null
                const count =
                  navId === 'overview'
                    ? installedCounts.total
                    : navId === 'orphan'
                      ? installedCounts.orphan
                      : navId === 'mcp'
                        ? installedCounts.mcp
                        : installedCounts.skill
                const Icon =
                  navId === 'overview'
                    ? LayoutGrid
                    : navId === 'orphan'
                      ? Package
                      : navId === 'mcp'
                        ? Plug
                        : Sparkles

                return (
                  <PluginNavItem
                    key={navId}
                    navId={navId}
                    active={installedNav === navId}
                    icon={<Icon size={14} strokeWidth={1.75} />}
                    label={INSTALLED_NAV_LABELS[navId]}
                    count={count}
                    onClick={() => handleSelectInstalledNav(navId)}
                  />
                )
              })}

              {installedGrouping.bundleGroups.length > 0 ? (
                <div className="px-2.5 pb-1 pt-3 text-[10px] font-medium text-muted-foreground">
                  整合包
                </div>
              ) : null}

              {installedGrouping.bundleGroups.map((group) => {
                const navId = bundleNavId(group.bundleId)
                return (
                  <PluginNavItem
                    key={group.bundleId}
                    navId={navId}
                    active={installedNav === navId}
                    icon={
                      group.logo ? (
                        <PluginBundleLogo
                          logo={group.logo}
                          alt={group.name}
                          className="size-3.5 rounded-sm object-cover"
                        />
                      ) : (
                        <LayoutGrid size={14} strokeWidth={1.75} />
                      )
                    }
                    label={group.name}
                    count={group.installedCount}
                    onClick={() => handleSelectInstalledNav(navId)}
                  />
                )
              })}
            </PluginNavSlideList>
          )}
        </nav>
      </div>
    )
  }

  return (
    <div className="plugins-panel flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pb-2 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles size={14} className="shrink-0 text-muted-foreground/75" strokeWidth={1.75} />
          <span className="text-[12px] font-semibold text-foreground">插件市场</span>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
        <PluginNavSlideList activeId={section}>
          {NAV_SECTIONS.map((item) => (
            <PluginNavItem
              key={item.id}
              navId={item.id}
              active={section === item.id}
              icon={item.icon}
              label={PLUGIN_SECTION_LABELS[item.id]}
              onClick={() => handleSelectSection(item.id)}
            />
          ))}
        </PluginNavSlideList>
      </nav>

      <div className="shrink-0 border-t border-border/40 p-2">
        <button
          type="button"
          onClick={() => handleSelectSection('installed')}
          className={cn(
            'flex w-full items-center justify-between rounded-[10px] px-2.5 py-2 text-left text-[12px] transition-colors duration-150',
            'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
          )}
        >
          <span>已安装</span>
          <span className="rounded-md bg-foreground/6 px-1.5 py-0.5 text-[10px] tabular-nums">
            {capabilities ? installedCounts.total : '…'}
          </span>
        </button>
      </div>
    </div>
  )
}

function InstalledNavSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 px-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-[10px] bg-muted/25" />
      ))}
    </div>
  )
}
