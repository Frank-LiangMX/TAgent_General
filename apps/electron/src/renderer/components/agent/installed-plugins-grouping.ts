/**
 * 已安装插件分组：整合包 vs 单独安装
 *
 * 1. plugins-installed.json 安装记录
 * 2. 按商店整合包定义推断（兼容旧工作区 / 未写入 manifest 的安装）
 */

import type {
  PluginStoreCatalog,
  SkillCreatedBy,
  SkillLifecycleStatus,
  SkillProvenance,
  SkillScope,
  StorePluginBundle,
  WorkspaceCapabilities,
  WorkspacePluginBundleRecord,
} from '@tagent/shared'
import { getPluginStoreBundles, getStorePluginBundle } from '@tagent/shared'

import type { PluginKindTab } from '@/atoms/app-mode'

export interface PluginListItem {
  id: string
  kind: PluginKindTab
  title: string
  subtitle?: string
  enabled: boolean
  hasUpdate?: boolean
  /** Skill Curator 元数据（仅 kind=skill） */
  skillStatus?: SkillLifecycleStatus
  skillProvenance?: SkillProvenance
  skillCreatedBy?: SkillCreatedBy
  skillScope?: SkillScope
  skillUseCount?: number
  skillPinned?: boolean
}

export interface InstalledBundleGroup {
  bundleId: string
  name: string
  logo: StorePluginBundle['logo'] | null
  installedCount: number
  totalCount: number
  items: PluginListItem[]
  /** 来自 plugins-installed.json；推断分组时为空 */
  record?: WorkspacePluginBundleRecord
}

export interface InstalledPluginsGrouping {
  bundleGroups: InstalledBundleGroup[]
  /** 不属于任何整合包的已安装条目 */
  orphanItems: PluginListItem[]
}

export function buildPluginListItems(capabilities: WorkspaceCapabilities): {
  mcpItems: PluginListItem[]
  skillItems: PluginListItem[]
} {
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
      skillStatus: skill.status,
      skillProvenance: skill.provenance,
      skillCreatedBy: skill.createdBy,
      skillScope: skill.scope,
      skillUseCount: skill.useCount,
      skillPinned: skill.pinned,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))

  return { mcpItems, skillItems }
}

/** Skill 生命周期徽章文案 */
export function skillStatusLabel(status?: SkillLifecycleStatus): string | null {
  if (!status) return null
  switch (status) {
    case 'draft':
      return '草稿'
    case 'active':
      return '活跃'
    case 'stale':
      return '闲置'
    case 'archived':
      return '已归档'
    default:
      return null
  }
}

/** Skill 来源徽章文案 */
export function skillOriginLabel(
  createdBy?: SkillCreatedBy,
  provenance?: SkillProvenance
): string | null {
  if (createdBy === 'agent' || provenance === 'background') return '自动固化'
  if (createdBy === 'user') return '用户'
  if (createdBy === 'market') return '商店'
  if (createdBy === 'official') return '官方'
  return null
}

function resolveBundleMeta(
  bundleId: string,
  catalog: PluginStoreCatalog | null
): StorePluginBundle | undefined {
  return catalog?.bundles.find((bundle) => bundle.id === bundleId) ?? getStorePluginBundle(bundleId)
}

function collectBundleItems(
  itemByKey: Map<string, PluginListItem>,
  claimedKeys: Set<string>,
  mcpNames: readonly string[],
  skillSlugs: readonly string[]
): PluginListItem[] {
  const items: PluginListItem[] = []

  for (const mcpName of mcpNames) {
    const key = `mcp:${mcpName}`
    if (claimedKeys.has(key)) continue
    const item = itemByKey.get(key)
    if (!item) continue
    items.push(item)
    claimedKeys.add(key)
  }

  for (const skillSlug of skillSlugs) {
    const key = `skill:${skillSlug}`
    if (claimedKeys.has(key)) continue
    const item = itemByKey.get(key)
    if (!item) continue
    items.push(item)
    claimedKeys.add(key)
  }

  return items
}

export function groupInstalledPlugins(
  capabilities: WorkspaceCapabilities,
  catalog: PluginStoreCatalog | null
): InstalledPluginsGrouping {
  const { mcpItems, skillItems } = buildPluginListItems(capabilities)
  const allItems = [...mcpItems, ...skillItems]
  const itemByKey = new Map(allItems.map((item) => [`${item.kind}:${item.id}`, item] as const))

  const claimedKeys = new Set<string>()
  const bundleGroups: InstalledBundleGroup[] = []
  const handledBundleIds = new Set<string>()
  const catalogBundles = catalog?.bundles ?? getPluginStoreBundles()

  const pushBundleGroup = (
    meta: StorePluginBundle,
    memberMcps: readonly string[],
    memberSkills: readonly string[],
    record?: WorkspacePluginBundleRecord
  ): void => {
    const items = collectBundleItems(itemByKey, claimedKeys, memberMcps, memberSkills)
    if (items.length === 0) return

    bundleGroups.push({
      bundleId: meta.id,
      name: meta.name,
      logo: meta.logo,
      installedCount: items.length,
      totalCount: meta.mcps.length + meta.skills.length,
      items,
      record,
    })
    handledBundleIds.add(meta.id)
  }

  const sortedRecords = [...capabilities.installedBundles].sort((a, b) =>
    a.installedAt.localeCompare(b.installedAt)
  )

  for (const record of sortedRecords) {
    const meta = resolveBundleMeta(record.bundleId, catalog)
    if (!meta) continue
    pushBundleGroup(meta, record.mcps, record.skills, record)
  }

  for (const meta of catalogBundles) {
    if (handledBundleIds.has(meta.id)) continue
    pushBundleGroup(meta, meta.mcps, meta.skills)
  }

  bundleGroups.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

  const orphanItems = allItems.filter((item) => !claimedKeys.has(`${item.kind}:${item.id}`))

  return { bundleGroups, orphanItems }
}
