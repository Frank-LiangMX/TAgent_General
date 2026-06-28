/**
 * PluginStorePanel - 插件商店
 *
 * 主从布局：左侧卡片列表 + 右侧详情；样式对齐插件侧栏全局规范。
 */

import {
  CheckCircle2,
  CircleCheck,
  Download,
  ExternalLink,
  Loader2,
  Plug,
  Sparkles,
} from 'lucide-react'
import * as React from 'react'

import type {
  BuiltinMcpCatalogEntry,
  McpServerEntry,
  PluginStoreCatalog,
  PluginStoreCategory,
  PluginStoreSkillEntry,
} from '@tagent/shared'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { SegmentedTabs, SegmentedTabsItem } from '@/components/ui/segmented-tabs'
import { cn } from '@/lib/utils'

type StoreTab = 'skill' | 'mcp'
type SkillCategoryFilter = 'all' | PluginStoreCategory | 'recommended'
type McpCategoryFilter = 'all' | 'dev' | 'ta' | 'recommended'

const CATEGORY_LABELS: Record<PluginStoreCategory, string> = {
  dev: '开发工具',
  ta: 'TA 专用',
  workflow: '工作流',
  office: '办公文档',
  planning: '任务规划',
  meta: '扩展能力',
}

function sortByRecommended<T extends { tier: string; name?: string; displayName?: string; slug?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const tierA = a.tier === 'recommended' ? 0 : 1
    const tierB = b.tier === 'recommended' ? 0 : 1
    if (tierA !== tierB) return tierA - tierB
    const labelA = a.displayName ?? a.name ?? a.slug ?? ''
    const labelB = b.displayName ?? b.name ?? b.slug ?? ''
    return labelA.localeCompare(labelB, 'zh-CN')
  })
}

function storeItemBadge(category: string, tier: string): string | undefined {
  if (category === 'ta') return 'TA'
  if (tier === 'recommended') return '推荐'
  return undefined
}

type StoreSelection = { kind: StoreTab; id: string }

export interface PluginStoreMcpInstallInfo extends BuiltinMcpCatalogEntry {
  installed?: boolean
  installing?: boolean
}

interface PluginStorePanelProps {
  workspaceSlug: string
  installedSkillSlugs: string[]
  installedMcpNames: string[]
  onInstallMcp?: (mcp: PluginStoreMcpInstallInfo) => void
  onSkillInstalled?: () => void
  onAddCustomMcp?: () => void
}

export function PluginStorePanel({
  workspaceSlug,
  installedSkillSlugs,
  installedMcpNames,
  onInstallMcp,
  onSkillInstalled,
  onAddCustomMcp,
}: PluginStorePanelProps): React.ReactElement {
  const [tab, setTab] = React.useState<StoreTab>('skill')
  const [skillCategoryFilter, setSkillCategoryFilter] = React.useState<SkillCategoryFilter>('all')
  const [mcpCategoryFilter, setMcpCategoryFilter] = React.useState<McpCategoryFilter>('all')
  const [query, setQuery] = React.useState('')
  const [catalog, setCatalog] = React.useState<PluginStoreCatalog | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [installingSkill, setInstallingSkill] = React.useState<string | null>(null)
  const [installingMcp, setInstallingMcp] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<StoreSelection | null>(null)
  const [gridPhase, setGridPhase] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.electronAPI
      .getPluginStoreCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data)
      })
      .catch((err) => {
        console.error('[PluginStorePanel] 加载插件商店失败:', err)
        if (!cancelled) setCatalog({ bundles: [], skills: [], mcps: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const installedSkillSet = React.useMemo(() => new Set(installedSkillSlugs), [installedSkillSlugs])
  const installedMcpSet = React.useMemo(() => new Set(installedMcpNames), [installedMcpNames])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredSkills = React.useMemo(() => {
    const skills = catalog?.skills ?? []
    let list = skills
    if (skillCategoryFilter === 'recommended') {
      list = list.filter((s) => s.tier === 'recommended')
    } else if (skillCategoryFilter !== 'all') {
      list = list.filter((s) => s.category === skillCategoryFilter)
    }
    if (normalizedQuery) {
      list = list.filter(
        (s) =>
          s.slug.toLowerCase().includes(normalizedQuery) ||
          s.name.toLowerCase().includes(normalizedQuery) ||
          s.description.toLowerCase().includes(normalizedQuery)
      )
    }
    return sortByRecommended(list)
  }, [catalog?.skills, normalizedQuery, skillCategoryFilter])

  const filteredMcps = React.useMemo(() => {
    const mcps = catalog?.mcps ?? []
    let list = mcps
    if (mcpCategoryFilter === 'recommended') {
      list = list.filter((m) => m.tier === 'recommended')
    } else if (mcpCategoryFilter === 'dev' || mcpCategoryFilter === 'ta') {
      list = list.filter((m) => m.category === mcpCategoryFilter)
    }
    if (normalizedQuery) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(normalizedQuery) ||
          m.displayName.toLowerCase().includes(normalizedQuery) ||
          m.description.toLowerCase().includes(normalizedQuery)
      )
    }
    return sortByRecommended(list)
  }, [catalog?.mcps, normalizedQuery, mcpCategoryFilter])

  const activeSelection = React.useMemo((): StoreSelection | null => {
    const list = tab === 'skill' ? filteredSkills : filteredMcps
    if (list.length === 0) return null

    if (tab === 'skill') {
      const skills = filteredSkills
      if (selected?.kind === 'skill' && skills.some((s) => s.slug === selected.id)) {
        return selected
      }
      return { kind: 'skill', id: skills[0]!.slug }
    }

    const mcps = filteredMcps
    if (selected?.kind === 'mcp' && mcps.some((m) => m.name === selected.id)) {
      return selected
    }
    return { kind: 'mcp', id: mcps[0]!.name }
  }, [tab, filteredSkills, filteredMcps, selected])

  const selectedSkill = React.useMemo(() => {
    if (activeSelection?.kind !== 'skill') return null
    return filteredSkills.find((s) => s.slug === activeSelection.id) ?? null
  }, [activeSelection, filteredSkills])

  const selectedMcp = React.useMemo(() => {
    if (activeSelection?.kind !== 'mcp') return null
    return filteredMcps.find((m) => m.name === activeSelection.id) ?? null
  }, [activeSelection, filteredMcps])

  const listCount = tab === 'skill' ? filteredSkills.length : filteredMcps.length

  const handleTabChange = (next: StoreTab): void => {
    if (next === tab) return
    setTab(next)
    setSelected(null)
    setGridPhase((p) => p + 1)
  }

  const handleInstallSkill = async (skill: PluginStoreSkillEntry): Promise<void> => {
    if (installedSkillSet.has(skill.slug) || installingSkill) return
    setInstallingSkill(skill.slug)
    try {
      await window.electronAPI.installStoreSkill(workspaceSlug, skill.slug)
      onSkillInstalled?.()
    } catch (error) {
      console.error('[PluginStorePanel] 安装 Skill 失败:', error)
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('安装 Skill 失败', { description: message })
    } finally {
      setInstallingSkill(null)
    }
  }

  const handleInstallMcp = async (mcp: BuiltinMcpCatalogEntry): Promise<void> => {
    if (installedMcpSet.has(mcp.name) || installingMcp) return
    setInstallingMcp(mcp.name)
    try {
      onInstallMcp?.({
        ...mcp,
        installed: installedMcpSet.has(mcp.name),
        installing: true,
      })
    } finally {
      setInstallingMcp(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2.5">
        <SegmentedTabs value={tab} onValueChange={(next) => handleTabChange(next as StoreTab)}>
          <SegmentedTabsItem value="skill" className="gap-1">
            <Sparkles size={12} strokeWidth={1.75} />
            <span>Skill</span>
            {catalog ? (
              <span className="text-[10px] tabular-nums opacity-60">{catalog.skills.length}</span>
            ) : null}
          </SegmentedTabsItem>
          <SegmentedTabsItem value="mcp" className="gap-1">
            <Plug size={12} strokeWidth={1.75} />
            <span>MCP</span>
            {catalog ? (
              <span className="text-[10px] tabular-nums opacity-60">{catalog.mcps.length}</span>
            ) : null}
          </SegmentedTabsItem>
        </SegmentedTabs>

        <SearchInput
          variant="glass"
          size="sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === 'mcp' ? '搜索 MCP…' : '搜索 Skill…'}
        />

        {tab === 'skill' ? (
          <SegmentedTabs
            className="!grid-cols-[repeat(6,minmax(0,1fr))]"
            value={skillCategoryFilter}
            onValueChange={(next) => setSkillCategoryFilter(next as SkillCategoryFilter)}
          >
            <SegmentedTabsItem value="all">全部</SegmentedTabsItem>
            <SegmentedTabsItem value="recommended">推荐</SegmentedTabsItem>
            <SegmentedTabsItem value="workflow">工作流</SegmentedTabsItem>
            <SegmentedTabsItem value="office">办公</SegmentedTabsItem>
            <SegmentedTabsItem value="planning">规划</SegmentedTabsItem>
            <SegmentedTabsItem value="meta">扩展</SegmentedTabsItem>
          </SegmentedTabs>
        ) : (
          <SegmentedTabs
            value={mcpCategoryFilter}
            onValueChange={(next) => setMcpCategoryFilter(next as McpCategoryFilter)}
          >
            <SegmentedTabsItem value="all">全部</SegmentedTabsItem>
            <SegmentedTabsItem value="recommended">推荐</SegmentedTabsItem>
            <SegmentedTabsItem value="dev">开发</SegmentedTabsItem>
            <SegmentedTabsItem value="ta">TA</SegmentedTabsItem>
          </SegmentedTabs>
        )}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 gap-0 overflow-hidden rounded-xl border border-border/45 bg-background/20">
        <div className="flex w-[54%] min-w-0 flex-col border-r border-border/40">
          <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
            {loading ? (
              <StoreCardSkeletonGrid />
            ) : listCount === 0 ? (
              <div className="plugins-panel-empty">
                <Sparkles size={20} className="text-muted-foreground/35" strokeWidth={1.5} />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {tab === 'mcp' ? '没有匹配的 MCP' : '没有匹配的 Skill'}
                </p>
              </div>
            ) : tab === 'skill' ? (
              <div key={`skill-${gridPhase}`} className="plugins-panel-grid grid grid-cols-2 gap-2">
                {filteredSkills.map((skill, index) => (
                  <StorePluginCard
                    key={skill.slug}
                    kind="skill"
                    title={skill.name}
                    subtitle={skill.description}
                    selected={
                      activeSelection?.kind === 'skill' && activeSelection.id === skill.slug
                    }
                    badge={storeItemBadge(skill.category, skill.tier)}
                    installed={installedSkillSet.has(skill.slug)}
                    style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                    onClick={() => setSelected({ kind: 'skill', id: skill.slug })}
                  />
                ))}
              </div>
            ) : (
              <div key={`mcp-${gridPhase}`} className="plugins-panel-grid grid grid-cols-2 gap-2">
                {filteredMcps.map((mcp, index) => (
                  <StorePluginCard
                    key={mcp.name}
                    kind="mcp"
                    title={mcp.displayName}
                    subtitle={mcp.description}
                    badge={storeItemBadge(mcp.category, mcp.tier)}
                    selected={activeSelection?.kind === 'mcp' && activeSelection.id === mcp.name}
                    installed={installedMcpSet.has(mcp.name)}
                    style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                    onClick={() => setSelected({ kind: 'mcp', id: mcp.name })}
                  />
                ))}
                {onAddCustomMcp ? (
                  <button
                    type="button"
                    onClick={onAddCustomMcp}
                    className="plugins-panel-card flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-border/70 p-2.5 text-center transition-colors hover:bg-foreground/[0.04]"
                  >
                    <span className="text-[11px] font-medium text-foreground/80">自定义 MCP</span>
                    <span className="text-[10px] text-muted-foreground">stdio / HTTP / SSE</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              加载中…
            </div>
          ) : selectedSkill ? (
            <StoreSkillDetail
              skill={selectedSkill}
              installed={installedSkillSet.has(selectedSkill.slug)}
              installing={installingSkill === selectedSkill.slug}
              onInstall={() => void handleInstallSkill(selectedSkill)}
            />
          ) : selectedMcp ? (
            <StoreMcpDetail
              mcp={selectedMcp}
              installed={installedMcpSet.has(selectedMcp.name)}
              installing={installingMcp === selectedMcp.name}
              onInstall={() => void handleInstallMcp(selectedMcp)}
            />
          ) : (
            <div className="plugins-panel-empty flex flex-1 items-center justify-center">
              <Plug size={20} className="text-muted-foreground/35" strokeWidth={1.5} />
              <p className="mt-2 text-[11px] text-muted-foreground">选择左侧插件查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface StorePluginCardProps {
  kind: StoreTab
  title: string
  subtitle?: string
  badge?: string
  selected: boolean
  installed: boolean
  onClick: () => void
  style?: React.CSSProperties
}

function StorePluginCard({
  kind,
  title,
  subtitle,
  badge,
  selected,
  installed,
  onClick,
  style,
}: StorePluginCardProps): React.ReactElement {
  const Icon = kind === 'mcp' ? Plug : Sparkles

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        'plugins-panel-card group relative flex min-h-[72px] w-full flex-col items-start gap-1.5 rounded-[14px] p-2.5 text-left transition-[transform,box-shadow,background-color] duration-200',
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
            kind === 'mcp'
              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
          )}
        >
          <Icon size={13} strokeWidth={1.85} />
        </span>
        <div className="flex items-center gap-1">
          {badge ? (
            <span className="rounded-md bg-amber-500/12 px-1 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
              {badge}
            </span>
          ) : null}
          {installed ? (
            <CircleCheck size={12} className="text-emerald-500/85" strokeWidth={2} />
          ) : (
            <span className="size-2 rounded-full bg-muted-foreground/25" />
          )}
        </div>
      </div>
      <span className="line-clamp-2 w-full text-[11px] font-semibold leading-4 text-foreground">
        {title}
      </span>
      {subtitle ? (
        <span className="line-clamp-2 w-full text-[10px] leading-3.5 text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
    </button>
  )
}

function StoreCardSkeletonGrid(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[72px] animate-pulse rounded-[14px] bg-muted/25" />
      ))}
    </div>
  )
}

function DetailMetaRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}): React.ReactElement {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground/90">{value}</span>
    </div>
  )
}

function StoreSkillDetail({
  skill,
  installed,
  installing,
  onInstall,
}: {
  skill: PluginStoreSkillEntry
  installed: boolean
  installing: boolean
  onInstall: () => void
}): React.ReactElement {
  return (
    <div className="plugins-inspector-body flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-4 p-4 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              Skill
            </span>
            {installed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={10} />
                已安装
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-base font-semibold text-foreground">{skill.name}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">{skill.slug}</p>
        </div>

        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
          <DetailMetaRow label="分类" value={CATEGORY_LABELS[skill.category] ?? skill.category} />
          <DetailMetaRow
            label="类型"
            value={skill.installKind === 'bundled' ? '完整包（含脚本）' : '轻量工作流'}
          />
          <DetailMetaRow label="版本" value={skill.version || '—'} />
          <DetailMetaRow
            label="标识"
            value={<code className="font-mono text-[10px]">{skill.slug}</code>}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 scrollbar-thin">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          说明
        </div>
        <p className="mt-2 text-[12px] leading-6 text-foreground/85">
          {skill.description || '暂无描述'}
        </p>
      </div>

      <div className="shrink-0 border-t border-border/40 bg-background/90 px-4 py-3 backdrop-blur-sm">
        {installed ? (
          <p className="text-[11px] text-muted-foreground">此 Skill 已安装到当前工作区</p>
        ) : (
          <Button size="sm" disabled={installing} onClick={onInstall}>
            {installing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                安装中…
              </>
            ) : (
              <>
                <Download size={14} />
                安装到工作区
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function StoreMcpDetail({
  mcp,
  installed,
  installing,
  onInstall,
}: {
  mcp: BuiltinMcpCatalogEntry
  installed: boolean
  installing: boolean
  onInstall: () => void
}): React.ReactElement {
  const installPreview = [mcp.installCommand, ...mcp.installArgs].join(' ')

  return (
    <div className="plugins-inspector-body flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-4 p-4 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              MCP
            </span>
            {mcp.category === 'ta' ? (
              <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                TA
              </span>
            ) : null}
            {installed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={10} />
                已安装
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-base font-semibold text-foreground">{mcp.displayName}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">{mcp.name}</p>
        </div>

        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
          <DetailMetaRow label="分类" value={CATEGORY_LABELS[mcp.category] ?? mcp.category} />
          <DetailMetaRow
            label="启动"
            value={<code className="break-all font-mono text-[10px]">{installPreview}</code>}
          />
          {mcp.envHints && mcp.envHints.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] text-muted-foreground">环境变量</div>
              {mcp.envHints.map((hint) => (
                <div key={hint.key} className="text-[10px] text-muted-foreground">
                  <code className="rounded bg-muted px-1 font-mono">{hint.key}</code>
                  {hint.required ? <span className="ml-1 text-red-500">*</span> : null}
                  <span className="ml-1">— {hint.description}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 scrollbar-thin">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          说明
        </div>
        <p className="mt-2 text-[12px] leading-6 text-foreground/85">{mcp.description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/40 bg-background/90 px-4 py-3 backdrop-blur-sm">
        {mcp.docsUrl ? (
          <Button variant="outline" size="sm" onClick={() => window.open(mcp.docsUrl, '_blank')}>
            <ExternalLink size={14} />
            文档
          </Button>
        ) : null}
        {installed ? (
          <p className="text-[11px] text-muted-foreground">此 MCP 已添加到当前工作区</p>
        ) : (
          <Button size="sm" disabled={installing} onClick={onInstall}>
            {installing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                安装中…
              </>
            ) : (
              <>
                <Download size={14} />
                安装到工作区
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

/** 将商店 MCP 条目转为 McpServerEntry 预填表单 */
export { mcpCatalogEntryToServerEntry } from '@tagent/shared'
