/**
 * 已安装插件侧栏导航筛选
 */

import type { InstalledPluginNavFilter } from '@/atoms/app-mode'

import type {
  InstalledBundleGroup,
  InstalledPluginsGrouping,
  PluginListItem,
} from './installed-plugins-grouping'

export type { InstalledPluginNavFilter } from '@/atoms/app-mode'

export function bundleNavId(bundleId: string): InstalledPluginNavFilter {
  return `bundle:${bundleId}`
}

export function parseBundleNavId(filter: InstalledPluginNavFilter): string | null {
  return filter.startsWith('bundle:') ? filter.slice('bundle:'.length) : null
}

function uniqueItems(items: PluginListItem[]): PluginListItem[] {
  const map = new Map(items.map((item) => [`${item.kind}:${item.id}`, item] as const))
  return [...map.values()]
}

export function resolveInstalledGridView(
  filter: InstalledPluginNavFilter,
  grouping: InstalledPluginsGrouping
): { bundles: InstalledBundleGroup[]; items: PluginListItem[] } {
  const allMemberItems = uniqueItems([
    ...grouping.bundleGroups.flatMap((group) => group.items),
    ...grouping.orphanItems,
  ])

  const bundleId = parseBundleNavId(filter)
  if (bundleId) {
    const group = grouping.bundleGroups.find((entry) => entry.bundleId === bundleId)
    return { bundles: [], items: group?.items ?? [] }
  }

  switch (filter) {
    case 'orphan':
      return { bundles: [], items: grouping.orphanItems }
    case 'mcp':
      return { bundles: [], items: allMemberItems.filter((item) => item.kind === 'mcp') }
    case 'skill':
      return { bundles: [], items: allMemberItems.filter((item) => item.kind === 'skill') }
    case 'overview':
    default:
      return { bundles: grouping.bundleGroups, items: grouping.orphanItems }
  }
}

export const INSTALLED_NAV_LABELS: Record<
  Exclude<InstalledPluginNavFilter, `bundle:${string}`>,
  string
> = {
  overview: '概览',
  orphan: '单独安装',
  mcp: 'MCP',
  skill: 'Skill',
}
