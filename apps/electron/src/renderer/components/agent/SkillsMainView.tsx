/**
 * SkillsMainView - 主区域版本的 MCP / Skills 工作台
 *
 * 目标：
 * - 左侧是稳定的能力列表，不要被裁切
 * - 右侧是独立滚动的详情区
 * - 避免直角线框和过多边线
 * - 空态要更像一个完整的产品面板，而不是占位卡片
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { CircleCheck, CircleDashed, Plug, Settings2, Sparkles } from 'lucide-react'
import * as React from 'react'

import type { WorkspaceCapabilities } from '@tagent/shared'

import { selectedCapabilityAtom } from '@/atoms/app-mode'
import {
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  workspaceCapabilitiesVersionAtom,
} from '@/atoms/agent-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import { CapabilityDetailView } from '@/components/agent/CapabilityDetailView'
import { Panel } from '@/components/app-shell/Panel'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type CapabilityKind = 'skill' | 'mcp'

export function SkillsMainView(): React.ReactElement {
  const [selectedCapability, setSelectedCapability] = useAtom(selectedCapabilityAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [activeKind, setActiveKind] = React.useState<CapabilityKind>('skill')

  const workspace = React.useMemo(
    () => workspaces.find((item) => item.id === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId],
  )

  const workspaceSlug = workspace?.slug ?? null

  React.useEffect(() => {
    let alive = true

    if (!workspaceSlug) {
      setCapabilities(null)
      setLoading(false)
      return () => {
        alive = false
      }
    }

    setLoading(true)
    window.electronAPI
      .getWorkspaceCapabilities(workspaceSlug)
      .then((data) => {
        if (!alive) return
        setCapabilities(data)
      })
      .catch((err) => {
        if (!alive) return
        console.error('[SkillsMainView] failed to load workspace capabilities:', err)
        setCapabilities(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [workspaceSlug, capabilitiesVersion])

  React.useEffect(() => {
    if (selectedCapability?.type !== activeKind) {
      setSelectedCapability(null)
    }
  }, [activeKind, selectedCapability, setSelectedCapability])

  const enabledMcpCount = capabilities?.mcpServers.filter((item) => item.enabled).length ?? 0
  const totalMcpCount = capabilities?.mcpServers.length ?? 0
  const enabledSkillCount = capabilities?.skills.filter((item) => item.enabled).length ?? 0
  const totalSkillCount = capabilities?.skills.length ?? 0

  const activeCount = activeKind === 'skill'
    ? { enabled: enabledSkillCount, total: totalSkillCount }
    : { enabled: enabledMcpCount, total: totalMcpCount }

  const handleConfigure = React.useCallback(() => {
    setSettingsTab('agent')
    setSettingsOpen(true)
  }, [setSettingsOpen, setSettingsTab])

  if (!workspace) {
    return (
      <Panel variant="grow" className="bg-content-area rounded-2xl shadow-xl">
        <div className="flex h-full min-h-0 items-center justify-center p-6">
          <div className="max-w-md rounded-[28px] bg-background/80 px-8 py-10 text-center shadow-[0_14px_42px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-border/35">
            <h3 className="text-base font-semibold text-foreground">先选择一个工作区</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              切换到工作区之后，这里会显示对应的 MCP 与 Skills。
            </p>
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel variant="grow" className="bg-content-area rounded-2xl shadow-xl">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 max-w-[72ch]">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                <span>Workspace Skills</span>
                <span className="text-border/80">/</span>
                <span className="truncate">{workspace.name}</span>
              </div>
              <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.03em] text-foreground">
                MCP & Skills
              </h2>
              <p className="mt-1 max-w-[64ch] text-sm leading-6 text-muted-foreground">
                在这里浏览当前工作区的 MCP 与 Skills，左侧选择条目，右侧查看详情与配置。
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SummaryPill
                label={activeKind === 'skill' ? 'Skills' : 'MCP'}
                value={`${activeCount.enabled}/${activeCount.total}`}
              />
              <button
                type="button"
                onClick={handleConfigure}
                className="inline-flex h-9 items-center justify-center rounded-full bg-background/80 px-3.5 text-sm font-medium text-foreground/80 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-inset ring-border/35 transition-colors hover:bg-background hover:text-foreground"
              >
                <Settings2 size={14} className="mr-1.5" />
                配置
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Tabs
              value={activeKind}
              onValueChange={(value) => {
                setActiveKind(value as CapabilityKind)
              }}
            >
              <TabsList className="rounded-full bg-background/80 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-inset ring-border/35">
                <TabsTrigger
                  value="skill"
                  className="rounded-full px-4 text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
                >
                  <Sparkles size={14} className="mr-1.5" />
                  Skills
                </TabsTrigger>
                <TabsTrigger
                  value="mcp"
                  className="rounded-full px-4 text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
                >
                  <Plug size={14} className="mr-1.5" />
                  MCP
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex-1 min-h-0 px-4 pb-4">
          <div
            className="grid h-full min-h-0 overflow-hidden rounded-[28px] bg-background/78 shadow-[0_22px_70px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-border/35 backdrop-blur"
            style={{
              gridTemplateColumns: 'minmax(340px, 380px) minmax(0, 1fr)',
            }}
          >
            <section className="flex min-h-0 flex-col overflow-hidden bg-background/60">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {activeKind === 'skill' ? <Sparkles size={12} /> : <Plug size={12} />}
                      <span>{activeKind === 'skill' ? 'Skills' : 'MCP servers'}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {loading ? '正在同步工作区能力…' : '点击条目以查看右侧详情。'}
                    </p>
                  </div>
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground shadow-[0_8px_18px_rgba(15,23,42,0.04)] ring-1 ring-inset ring-border/35">
                    {activeCount.enabled}/{activeCount.total}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 pt-1 scrollbar-thin">
                {activeKind === 'skill' ? (
                  <CapabilityList
                    loading={loading}
                    kind="skill"
                    skills={capabilities?.skills ?? []}
                    selectedCapability={selectedCapability}
                    onSelect={(slug) => setSelectedCapability({ type: 'skill', key: slug })}
                  />
                ) : (
                  <CapabilityList
                    loading={loading}
                    kind="mcp"
                    mcpServers={capabilities?.mcpServers ?? []}
                    selectedCapability={selectedCapability}
                    onSelect={(name) => setSelectedCapability({ type: 'mcp', key: name })}
                  />
                )}
              </div>
            </section>

            <section className="min-w-0 min-h-0 overflow-hidden bg-background/72">
              {selectedCapability?.type === activeKind ? (
                <CapabilityDetailView />
              ) : (
                <div className="flex h-full min-h-0 items-center justify-center px-6 py-8">
                  <div className="w-full max-w-2xl rounded-[30px] bg-background/84 px-8 py-8 text-left shadow-[0_18px_50px_rgba(15,23,42,0.05)] ring-1 ring-inset ring-border/35">
                    <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
                      <div className="flex justify-center md:justify-start">
                        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/8 text-emerald-600 shadow-[0_8px_20px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-emerald-500/15">
                          {activeKind === 'skill' ? <Sparkles size={20} /> : <Plug size={20} />}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Workspace
                          </span>
                          <h3 className="text-base font-semibold text-foreground">
                            选择一个 {activeKind === 'skill' ? 'Skill' : 'MCP'}
                          </h3>
                        </div>
                        <p className="mt-2 max-w-[54ch] text-sm leading-6 text-muted-foreground">
                          右侧会显示对应的详情、状态和配置入口。这里保留的是能力管理相关上下文，不再显示会话欢迎页。
                        </p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <HintCard label="当前工作区" value={workspace.name} />
                          <HintCard label="当前可用" value={`${activeCount.enabled}/${activeCount.total}`} />
                        </div>

                        <p className="mt-4 text-xs text-muted-foreground">
                          从左侧选择一个条目后，这里会直接打开详情。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function CapabilityList({
  loading,
  kind,
  skills,
  mcpServers,
  selectedCapability,
  onSelect,
}: {
  loading: boolean
  kind: CapabilityKind
  skills?: WorkspaceCapabilities['skills']
  mcpServers?: WorkspaceCapabilities['mcpServers']
  selectedCapability: { type: CapabilityKind; key: string } | null
  onSelect: (key: string) => void
}): React.ReactElement {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: kind === 'skill' ? 4 : 2 }).map((_, index) => (
          <div
            key={index}
            className="h-[70px] animate-pulse rounded-[18px] bg-muted/25 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]"
          />
        ))}
      </div>
    )
  }

  const items = kind === 'skill' ? skills ?? [] : mcpServers ?? []

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-center">
        <div className="max-w-sm rounded-[24px] bg-background/80 px-5 py-6 shadow-[0_14px_32px_rgba(15,23,42,0.04)] ring-1 ring-inset ring-border/35">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted/25 text-muted-foreground shadow-[0_6px_16px_rgba(15,23,42,0.04)] ring-1 ring-inset ring-border/35">
            {kind === 'skill' ? <Sparkles size={16} /> : <Plug size={16} />}
          </div>
          <h4 className="mt-3 text-sm font-semibold text-foreground">
            {kind === 'skill' ? '暂无 Skills' : '暂无 MCP'}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {kind === 'skill'
              ? '当前工作区还没有可用的 Skill。'
              : '当前工作区还没有配置 MCP 服务器。'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {kind === 'skill'
        ? skills!.map((skill) => (
            <CapabilityRow
              key={skill.slug}
              icon={<Sparkles size={12} />}
              title={skill.name}
              description={skill.description ?? '暂无说明'}
              badge={skill.hasUpdate ? '更新' : skill.enabled ? '启用' : '禁用'}
              badgeTone={skill.hasUpdate ? 'warning' : skill.enabled ? 'success' : 'muted'}
              selected={selectedCapability?.type === 'skill' && selectedCapability.key === skill.slug}
              onClick={() => onSelect(skill.slug)}
            />
          ))
        : mcpServers!.map((server) => (
            <CapabilityRow
              key={server.name}
              icon={server.enabled ? <CircleCheck size={12} /> : <CircleDashed size={12} />}
              title={server.name}
              description={server.type}
              badge={server.enabled ? '启用' : '禁用'}
              badgeTone={server.enabled ? 'success' : 'muted'}
              selected={selectedCapability?.type === 'mcp' && selectedCapability.key === server.name}
              onClick={() => onSelect(server.name)}
            />
          ))}
    </div>
  )
}

function CapabilityRow({
  icon,
  title,
  description,
  badge,
  badgeTone,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  badge: string
  badgeTone: 'success' | 'warning' | 'muted'
  selected?: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full rounded-[18px] px-3 py-3 text-left transition-colors duration-200 appearance-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        selected
          ? 'bg-accent text-accent-foreground shadow-[0_0_0_1px_rgba(148,163,184,0.14),0_0_0_2.5px_hsl(var(--primary)/0.34),0_10px_22px_rgba(15,23,42,0.05)]'
          : 'bg-transparent hover:bg-muted/40',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
            selected
              ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/20'
              : 'bg-muted/40 text-muted-foreground',
          )}
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('truncate text-sm font-medium', selected ? 'text-accent-foreground' : 'text-foreground')}>
              {title}
            </span>
            <span className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide shadow-[0_6px_14px_rgba(15,23,42,0.03)] ring-1 ring-inset ring-border/35',
              selected ? 'bg-primary/12 text-primary ring-primary/20' : 'bg-muted/50 text-muted-foreground',
            )}>
              {badge}
            </span>
          </div>
          <p className={cn('mt-1 line-clamp-2 text-[11px] leading-5', selected ? 'text-accent-foreground/72' : 'text-muted-foreground')}>
            {description}
          </p>
        </div>
      </div>
    </button>
  )
}

function SummaryPill({
  label,
  value,
}: {
  label: string
  value: string
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-inset ring-border/35">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums text-foreground">{value}</div>
    </div>
  )
}

function HintCard({
  label,
  value,
}: {
  label: string
  value: string
}): React.ReactElement {
  return (
    <div className="rounded-2xl bg-background/80 px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-inset ring-border/35">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}
