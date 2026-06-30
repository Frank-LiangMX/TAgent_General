/**
 * PluginMarketplaceBundleDetail — 整合包详情页
 */

import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Plug, Sparkles } from 'lucide-react'
import * as React from 'react'

import type { PluginStoreCatalog, StorePluginBundle } from '@tagent/shared'

import { Button } from '@tagent/ui'

import { PluginBundleLogo } from './plugin-marketplace-icons'
import { PLUGIN_CATEGORY_LABELS, PLUGIN_SECTION_LABELS } from './plugin-marketplace-shared'
import type { PluginSidebarSection } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

interface PluginMarketplaceBundleDetailProps {
  section: Exclude<PluginSidebarSection, 'installed'>
  bundle: StorePluginBundle
  catalog: PluginStoreCatalog
  installedSkillSlugs: string[]
  installedMcpNames: string[]
  installing: boolean
  onBack: () => void
  onInstall: () => void
}

export function PluginMarketplaceBundleDetail({
  section,
  bundle,
  catalog,
  installedSkillSlugs,
  installedMcpNames,
  installing,
  onBack,
  onInstall,
}: PluginMarketplaceBundleDetailProps): React.ReactElement {
  const skillSet = React.useMemo(() => new Set(installedSkillSlugs), [installedSkillSlugs])
  const mcpSet = React.useMemo(() => new Set(installedMcpNames), [installedMcpNames])

  const skills = bundle.skills
    .map((slug) => catalog.skills.find((skill) => skill.slug === slug))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill))

  const mcps = bundle.mcps
    .map((name) => catalog.mcps.find((mcp) => mcp.name === name))
    .filter((mcp): mcp is NonNullable<typeof mcp> => Boolean(mcp))

  const totalItems = bundle.skills.length + bundle.mcps.length
  const installedCount =
    bundle.skills.filter((slug) => skillSet.has(slug)).length +
    bundle.mcps.filter((name) => mcpSet.has(name)).length
  const fullyInstalled = totalItems > 0 && installedCount >= totalItems

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/40 px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          返回
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6 lg:flex-row lg:gap-10">
          <aside className="w-full shrink-0 space-y-4 lg:w-44">
            <div className="space-y-1 text-[11px]">
              <p className="text-muted-foreground">市场 / {PLUGIN_SECTION_LABELS[section]}</p>
              <p className="text-foreground/80">{bundle.publisher}</p>
            </div>
            <dl className="space-y-2.5 text-[11px]">
              <MetaItem label="分类" value={PLUGIN_CATEGORY_LABELS[bundle.category]} />
              <MetaItem
                label="包含"
                value={`MCP ×${bundle.mcps.length} · Skill ×${bundle.skills.length}`}
              />
              <div>
                <dt className="text-muted-foreground">源码</dt>
                <dd className="mt-0.5">
                  <button
                    type="button"
                    onClick={() => window.open(bundle.repositoryUrl, '_blank')}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    查看 GitHub
                    <ExternalLink size={11} />
                  </button>
                </dd>
              </div>
              {bundle.homepageUrl ? (
                <div>
                  <dt className="text-muted-foreground">主页</dt>
                  <dd className="mt-0.5">
                    <button
                      type="button"
                      onClick={() => window.open(bundle.homepageUrl, '_blank')}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      打开
                      <ExternalLink size={11} />
                    </button>
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>

          <div className="min-w-0 flex-1 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <PluginBundleLogo
                  logo={bundle.logo}
                  alt={bundle.name}
                  className="size-12 shrink-0 rounded-2xl object-cover shadow-sm"
                />
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {bundle.name}
                  </h2>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{bundle.id}</p>
                </div>
              </div>

              {fullyInstalled ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={14} />
                  已安装 {installedCount}/{totalItems}
                </span>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0 px-5"
                  disabled={installing}
                  onClick={onInstall}
                >
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

            <p className="text-[13px] leading-7 text-foreground/85">{bundle.description}</p>

            {mcps.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-[12px] font-semibold text-foreground">
                  MCPs <span className="font-normal text-muted-foreground">{mcps.length}</span>
                </h3>
                <div className="space-y-2">
                  {mcps.map((mcp) => (
                    <BundleSubItem
                      key={mcp.name}
                      icon={<Plug size={16} strokeWidth={1.75} />}
                      iconClass="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                      title={mcp.displayName}
                      description={mcp.description}
                      installed={mcpSet.has(mcp.name)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {skills.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-[12px] font-semibold text-foreground">
                  Skills <span className="font-normal text-muted-foreground">{skills.length}</span>
                </h3>
                <div className="space-y-2">
                  {skills.map((skill) => (
                    <BundleSubItem
                      key={skill.slug}
                      icon={<Sparkles size={16} strokeWidth={1.75} />}
                      iconClass="bg-amber-500/12 text-amber-600 dark:text-amber-400"
                      title={skill.name}
                      description={skill.description}
                      installed={skillSet.has(skill.slug)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function BundleSubItem({
  icon,
  iconClass,
  title,
  description,
  installed,
}: {
  icon: React.ReactNode
  iconClass: string
  title: string
  description: string
  installed: boolean
}): React.ReactElement {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 p-4">
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconClass)}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-foreground">{title}</p>
          {installed ? (
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
              已安装
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground/90">{value}</dd>
    </div>
  )
}
