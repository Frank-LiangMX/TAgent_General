/**
 * InstalledBundleDetail — 已安装整合包详情（轻量，对齐市场整合包页）
 */

import { ArrowLeft, Plug, Sparkles } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

import type { InstalledBundleGroup, PluginListItem } from './installed-plugins-grouping'
import { PluginBundleLogo } from './plugin-marketplace-icons'

interface InstalledBundleDetailProps {
  group: InstalledBundleGroup
  onBack: () => void
  onSelectItem: (item: PluginListItem) => void
}

export function InstalledBundleDetail({
  group,
  onBack,
  onSelectItem,
}: InstalledBundleDetailProps): React.ReactElement {
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
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="flex items-start gap-3">
            {group.logo ? (
              <PluginBundleLogo
                logo={group.logo}
                alt={group.name}
                className="size-12 shrink-0 rounded-2xl object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{group.name}</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                已安装 {group.installedCount} / {group.totalCount} 项
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-2">
            {group.items.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3 text-left transition-colors hover:border-border/70 hover:bg-card/70"
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      item.kind === 'mcp'
                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {item.kind === 'mcp' ? (
                      <Plug size={16} strokeWidth={1.75} />
                    ) : (
                      <Sparkles size={16} strokeWidth={1.75} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                    {item.subtitle ? (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                        {item.subtitle}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium',
                      item.enabled
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {item.enabled ? '已启用' : '已禁用'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
