/**
 * RoleCard — 数字员工角色卡
 *
 * 对齐工牌浮岛：中性玻璃底 + lucide 图标，不用饱和色点。
 */

import * as React from 'react'

import type { AgentRoleProfile, RoleWorkStats } from '@tagent/shared'

import { roleAvatarSpec } from '@/lib/kanban-crew-status'
import { cn } from '@/lib/utils'

const BUILTIN_IDS = new Set([
  'analyst',
  'coder',
  'reviewer',
  'writer',
  'generalist',
  'data-analyst',
  'chat',
  'doc-writer',
])

export function RoleCard({
  role,
  stats,
  onClick,
}: {
  role: AgentRoleProfile
  stats?: RoleWorkStats
  onClick: () => void
}): React.ReactElement {
  const { wrap, Icon } = roleAvatarSpec(role.id)
  const isBuiltin = BUILTIN_IDS.has(role.id)
  const hasWork = Boolean(stats && stats.totalTasks > 0)

  return (
    <button
      type="button"
      onClick={onClick}
      className="kanban-crew-badge group flex h-full w-full cursor-pointer flex-col text-left titlebar-no-drag ui-pressable"
    >
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-[12px]',
              wrap
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                {role.displayName}
              </span>
              {isBuiltin ? (
                <span className="shrink-0 rounded-full bg-foreground/[0.05] px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  内置
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/65">{role.id}</p>
          </div>
        </div>

        <p className="line-clamp-3 flex-1 text-[11px] leading-relaxed text-muted-foreground">
          {role.description}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-0.5 text-[10px] text-muted-foreground">
          {hasWork && stats ? (
            <>
              <span className="tabular-nums">{stats.totalTasks} 上岗</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="tabular-nums">均 {formatMs(stats.avgDurationMs)}</span>
              {stats.failedCount > 0 ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="tabular-nums text-red-500/75">{stats.failedCount} 失败</span>
                </>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground/50">尚未上岗</span>
          )}
        </div>
      </div>
    </button>
  )
}

function formatMs(ms: number): string {
  if (ms < 1000) return '0s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`
}
