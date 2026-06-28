/**
 * 插件市场共享类型与筛选逻辑
 */

import type {
  BuiltinMcpCatalogEntry,
  PluginStoreCatalog,
  PluginStoreCategory,
  PluginStoreSkillEntry,
  StorePluginBundle,
} from '@tagent/shared'

import type { PluginSidebarSection } from '@/atoms/app-mode'

export const PLUGIN_SECTION_LABELS: Record<Exclude<PluginSidebarSection, 'installed'>, string> = {
  recommended: '推荐',
  dev: '开发工具',
  workflow: '工作流',
  office: '办公文档',
  planning: '任务规划',
  meta: '扩展能力',
  ta: 'TA 专用',
}

export const PLUGIN_CATEGORY_LABELS: Record<PluginStoreCategory, string> = {
  dev: '开发工具',
  ta: 'TA 专用',
  workflow: '工作流',
  office: '办公文档',
  planning: '任务规划',
  meta: '扩展能力',
}

/** 市场列表：整合包 / 全部 / 仅 MCP / 仅 Skill */
export type MarketplaceKindFilter = 'bundle' | 'all' | 'mcp' | 'skill'

export interface MarketplaceBundleItem {
  id: string
  kind: 'bundle'
  title: string
  description: string
  category: PluginStoreCategory
  tier: string
  bundle: StorePluginBundle
  mcpCount: number
  skillCount: number
}

export interface MarketplaceCatalogItem {
  id: string
  kind: 'skill' | 'mcp'
  title: string
  description: string
  category: PluginStoreCategory
  tier: string
  skill?: PluginStoreSkillEntry
  mcp?: BuiltinMcpCatalogEntry
}

export function buildMarketplaceBundles(catalog: PluginStoreCatalog | null): MarketplaceBundleItem[] {
  if (!catalog) return []
  return catalog.bundles.map((bundle) => ({
    id: bundle.id,
    kind: 'bundle' as const,
    title: bundle.name,
    description: bundle.description,
    category: bundle.category,
    tier: bundle.tier,
    bundle,
    mcpCount: bundle.mcps.length,
    skillCount: bundle.skills.length,
  }))
}

export function filterMarketplaceBundlesBySection(
  bundles: MarketplaceBundleItem[],
  section: PluginSidebarSection
): MarketplaceBundleItem[] {
  if (section === 'installed') return []
  if (section === 'recommended') {
    return bundles.filter((item) => item.tier === 'recommended')
  }
  return bundles.filter((item) => item.category === section)
}

export function filterMarketplaceBundlesByQuery(
  bundles: MarketplaceBundleItem[],
  query: string
): MarketplaceBundleItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return bundles
  return bundles.filter(
    (item) =>
      item.id.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.bundle.publisher.toLowerCase().includes(q)
  )
}

export function sortMarketplaceBundles(bundles: MarketplaceBundleItem[]): MarketplaceBundleItem[] {
  return [...bundles].sort((a, b) => {
    const tierA = a.tier === 'recommended' ? 0 : 1
    const tierB = b.tier === 'recommended' ? 0 : 1
    if (tierA !== tierB) return tierA - tierB
    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

export function buildMarketplaceItems(catalog: PluginStoreCatalog | null): MarketplaceCatalogItem[] {
  if (!catalog) return []
  const skills: MarketplaceCatalogItem[] = catalog.skills.map((skill) => ({
    id: skill.slug,
    kind: 'skill',
    title: skill.name,
    description: skill.description,
    category: skill.category,
    tier: skill.tier,
    skill,
  }))
  const mcps: MarketplaceCatalogItem[] = catalog.mcps.map((mcp) => ({
    id: mcp.name,
    kind: 'mcp',
    title: mcp.displayName,
    description: mcp.description,
    category: mcp.category,
    tier: mcp.tier,
    mcp,
  }))
  return excludeBundleMembersFromMarketplace([...skills, ...mcps], catalog)
}

/** 整合包已收录的 Skill / MCP id（市场单条列表不再重复展示） */
export function collectBundleMemberIds(catalog: PluginStoreCatalog | null): {
  skillSlugs: Set<string>
  mcpNames: Set<string>
} {
  const skillSlugs = new Set<string>()
  const mcpNames = new Set<string>()
  if (!catalog) return { skillSlugs, mcpNames }
  for (const bundle of catalog.bundles) {
    for (const slug of bundle.skills) skillSlugs.add(slug)
    for (const name of bundle.mcps) mcpNames.add(name)
  }
  return { skillSlugs, mcpNames }
}

export function excludeBundleMembersFromMarketplace(
  items: MarketplaceCatalogItem[],
  catalog: PluginStoreCatalog | null
): MarketplaceCatalogItem[] {
  const { skillSlugs, mcpNames } = collectBundleMemberIds(catalog)
  if (skillSlugs.size === 0 && mcpNames.size === 0) return items
  return items.filter((item) => {
    if (item.kind === 'skill') return !skillSlugs.has(item.id)
    if (item.kind === 'mcp') return !mcpNames.has(item.id)
    return true
  })
}

export function filterMarketplaceBySection(
  items: MarketplaceCatalogItem[],
  section: PluginSidebarSection
): MarketplaceCatalogItem[] {
  if (section === 'installed') return []
  if (section === 'recommended') {
    return items.filter((item) => item.tier === 'recommended')
  }
  return items.filter((item) => item.category === section)
}

export function filterMarketplaceByKind(
  items: MarketplaceCatalogItem[],
  kind: MarketplaceKindFilter
): MarketplaceCatalogItem[] {
  if (kind === 'all') return items
  return items.filter((item) => item.kind === kind)
}

export function countMarketplaceByKind(
  bundles: MarketplaceBundleItem[],
  items: MarketplaceCatalogItem[]
): {
  bundle: number
  all: number
  mcp: number
  skill: number
} {
  let mcp = 0
  let skill = 0
  for (const item of items) {
    if (item.kind === 'mcp') mcp += 1
    else skill += 1
  }
  return { bundle: bundles.length, all: bundles.length + items.length, mcp, skill }
}

export function filterMarketplaceByQuery(
  items: MarketplaceCatalogItem[],
  query: string
): MarketplaceCatalogItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (item) =>
      item.id.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
  )
}

export function sortMarketplaceItems(items: MarketplaceCatalogItem[]): MarketplaceCatalogItem[] {
  return [...items].sort((a, b) => {
    const tierA = a.tier === 'recommended' ? 0 : 1
    const tierB = b.tier === 'recommended' ? 0 : 1
    if (tierA !== tierB) return tierA - tierB
    if (a.kind !== b.kind) return a.kind === 'mcp' ? -1 : 1
    return a.title.localeCompare(b.title, 'zh-CN')
  })
}
