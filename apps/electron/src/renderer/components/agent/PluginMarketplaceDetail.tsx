/**
 * PluginMarketplaceDetail — 市场插件详情（Cursor Marketplace 点击后全页）
 */

import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  Sparkles,
} from 'lucide-react'
import * as React from 'react'
import Markdown from 'react-markdown'

import type { BuiltinMcpCatalogEntry, PluginStoreSkillEntry } from '@tagent/shared'
import { getStoreSkillCatalogEntry } from '@tagent/shared'

import { Button } from '@tagent/ui'

import { PLUGIN_CATEGORY_LABELS, PLUGIN_SECTION_LABELS } from './plugin-marketplace-shared'
import type { PluginSidebarSection } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

interface PluginMarketplaceDetailProps {
  section: Exclude<PluginSidebarSection, 'installed'>
  skill?: PluginStoreSkillEntry
  mcp?: BuiltinMcpCatalogEntry
  installed: boolean
  installing: boolean
  onBack: () => void
  onInstall: () => void
}

export function PluginMarketplaceDetail({
  section,
  skill,
  mcp,
  installed,
  installing,
  onBack,
  onInstall,
}: PluginMarketplaceDetailProps): React.ReactElement {
  const isMcp = Boolean(mcp)
  const title = isMcp ? mcp!.displayName : skill!.name
  const subtitle = isMcp ? mcp!.name : skill!.slug
  const description = isMcp ? mcp!.description : skill!.description
  const Icon = isMcp ? Plug : Sparkles

  const skillBody = React.useMemo(() => {
    if (!skill) return null
    const entry = getStoreSkillCatalogEntry(skill.slug)
    if (entry?.installKind === 'inline') return entry.body
    return null
  }, [skill])

  const installPreview = mcp ? [mcp.installCommand, ...mcp.installArgs].join(' ') : null

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
          {/* 左侧元数据 — 对齐 Cursor Marketplace 详情左栏 */}
          <aside className="w-full shrink-0 space-y-4 lg:w-44">
            <div className="space-y-1 text-[11px]">
              <p className="text-muted-foreground">
                市场 / {PLUGIN_SECTION_LABELS[section]}
              </p>
              <p className="text-foreground/80">
                {isMcp ? 'MCP 连接' : skill?.installKind === 'bundled' ? '完整 Skill 包' : '轻量 Skill'}
              </p>
            </div>

            <dl className="space-y-2.5 text-[11px]">
              <MetaItem label="分类" value={PLUGIN_CATEGORY_LABELS[isMcp ? mcp!.category : skill!.category]} />
              {!isMcp && skill ? (
                <>
                  <MetaItem label="版本" value={skill.version || '—'} />
                  <MetaItem
                    label="类型"
                    value={skill.installKind === 'bundled' ? '含脚本资源' : '工作流指令'}
                  />
                </>
              ) : null}
              {isMcp && mcp?.docsUrl ? (
                <div>
                  <dt className="text-muted-foreground">文档</dt>
                  <dd className="mt-0.5">
                    <button
                      type="button"
                      onClick={() => window.open(mcp.docsUrl, '_blank')}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      查看源码
                      <ExternalLink size={11} />
                    </button>
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>

          {/* 右侧主内容 */}
          <div className="min-w-0 flex-1 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-2xl',
                    isMcp
                      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                  )}
                >
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
                </div>
              </div>

              {installed ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={14} />
                  已安装
                </span>
              ) : (
                <Button size="sm" className="shrink-0 px-5" disabled={installing} onClick={onInstall}>
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

            <section>
              <p className="text-[13px] leading-7 text-foreground/85">{description}</p>
            </section>

            {isMcp && mcp ? (
              <section className="space-y-3">
                <h3 className="text-[12px] font-semibold text-foreground">
                  MCPs <span className="font-normal text-muted-foreground">1</span>
                </h3>
                <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                      <Plug size={16} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{mcp.displayName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{mcp.description}</p>
                    </div>
                  </div>
                  {installPreview ? (
                    <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">
                      {installPreview}
                    </p>
                  ) : null}
                  {mcp.envHints && mcp.envHints.length > 0 ? (
                    <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
                      <p className="text-[10px] font-medium text-muted-foreground">环境变量</p>
                      {mcp.envHints.map((hint) => (
                        <p key={hint.key} className="text-[10px] text-muted-foreground">
                          <code className="rounded bg-muted px-1 font-mono">{hint.key}</code>
                          {hint.required ? <span className="ml-1 text-red-500">*</span> : null}
                          <span className="ml-1">— {hint.description}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : skill ? (
              <section className="space-y-3">
                <h3 className="text-[12px] font-semibold text-foreground">
                  Skills <span className="font-normal text-muted-foreground">1</span>
                </h3>
                <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400">
                      <Sparkles size={16} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{skill.name}</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {skill.description}
                      </p>
                    </div>
                  </div>
                </div>

                {skillBody ? (
                  <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      指令预览
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-[12px] leading-6 text-foreground/85">
                      <Markdown>{skillBody}</Markdown>
                    </div>
                  </div>
                ) : skill.installKind === 'bundled' ? (
                  <p className="text-[11px] text-muted-foreground">
                    安装后将复制完整 Skill 包（含脚本与资源）到当前工作区。
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
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
