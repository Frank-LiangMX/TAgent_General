/**
 * RoleCard — 数字员工角色卡片（简约风格）
 *
 * 轻量材质感：无顶部色条，用中性 glass 表面 + 角色语义 tint 小圆点。
 * 描述完整显示（line-clamp-3），上岗徽章用弱信息色。
 */

import * as React from 'react'

import type { AgentRoleProfile, RoleWorkStats } from '@tagent/shared'

import { Badge } from '@tagent/ui'
import { roleAvatarTint } from '@/lib/kanban-crew-status'
import { cn } from '@/lib/utils'

export function RoleCard({
  role,
  stats,
  onClick,
}: {
  role: AgentRoleProfile
  stats?: RoleWorkStats
  onClick: () => void
}): React.ReactElement {
  const tint = roleAvatarTint(role.id)

  return (
    <button
      type="button"
      onClick={onClick}
      className="session-list-item-active group w-full text-left transition-colors hover:bg-primary/5"
    >
      <div className="p-3 space-y-2">
        {/* 角色名 + 小圆点 */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn('size-2 rounded-full shrink-0', tint.wrap.replace('/15', ''))}
            aria-hidden
          />
          <span className="text-sm font-medium text-foreground truncate flex-1">
            {role.displayName}
          </span>
          {stats && stats.totalTasks > 0 && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
              {stats.totalTasks} 上岗
            </Badge>
          )}
        </div>

        {/* 职责描述（完整 3 行） */}
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {role.description}
        </p>

        {/* 底部：均时 / 失败计数 */}
        {stats && stats.totalTasks > 0 ? (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>均 {formatMs(stats.avgDurationMs)}</span>
            {stats.failedCount > 0 && (
              <span className="text-red-500/70">{stats.failedCount} 失败</span>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/50">尚未上岗</div>
        )}
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
