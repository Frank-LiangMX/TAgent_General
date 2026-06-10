/**
 * TokenStatsPanel — Token 统计面板
 *
 * 显示当前会话的累计 token 使用量、缓存命中率、成本。
 * 仅在通用模式显示（TA 模式暂不显示）。
 * 位置：会话页底部（AgentView 的 bottom bar 区域）。
 */

import { useAtomValue } from 'jotai'
import { Coins, Database, Zap, TrendingUp } from 'lucide-react'
import * as React from 'react'

import {
  currentSessionTokenStatsAtom,
  cacheHitRateAtom,
} from '@/atoms/agent-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

/** 格式化 token 数为可读字符串 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`
  }
  return `${tokens}`
}

/** 格式化费用为可读字符串 */
function formatCost(costUsd: number): string {
  if (costUsd >= 1) {
    return `$${costUsd.toFixed(2)}`
  }
  if (costUsd >= 0.01) {
    return `$${costUsd.toFixed(3)}`
  }
  // 小于 $0.01 时显示更精确的值
  return `$${costUsd.toFixed(4)}`
}

/** 格式化命中率为百分比 */
function formatHitRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${Math.round(rate * 100)}%`
}

export function TokenStatsPanel(): React.ReactElement | null {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const stats = useAtomValue(currentSessionTokenStatsAtom)
  const cacheHitRate = useAtomValue(cacheHitRateAtom)

  // TA 模式暂不显示
  if (topLevelMode === 'ta') return null

  // 无数据时不显示
  if (stats.totalInputTokens === 0 && stats.totalOutputTokens === 0) return null

  // 计算缓存节省的 token
  const cacheSavedTokens = stats.totalCacheReadTokens
  // 是否有缓存数据（支持 prompt caching 的模型）
  const hasCacheData = stats.totalCacheReadTokens > 0 || stats.totalCacheCreationTokens > 0

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
      {/* 输入 token */}
      <StatItem
        icon={<Zap size={12} />}
        label="输入"
        value={formatTokens(stats.totalInputTokens)}
      />

      {/* 输出 token */}
      <StatItem
        icon={<TrendingUp size={12} />}
        label="输出"
        value={formatTokens(stats.totalOutputTokens)}
      />

      {/* 分隔线 */}
      <div className="h-3 w-px bg-border/50" />

      {/* 缓存命中率 — 仅当模型支持 prompt caching 时显示 */}
      {hasCacheData && (
        <StatItem
          icon={<Database size={12} />}
          label="缓存命中"
          value={formatHitRate(cacheHitRate)}
          highlight={cacheHitRate !== null && cacheHitRate > 0.5}
          tooltip={cacheSavedTokens > 0 ? `节省 ${formatTokens(cacheSavedTokens)} tokens` : undefined}
        />
      )}

      {/* 费用 */}
      {stats.totalCostUsd > 0 && (
        <>
          <div className="h-3 w-px bg-border/50" />
          <StatItem
            icon={<Coins size={12} />}
            label="费用"
            value={formatCost(stats.totalCostUsd)}
          />
        </>
      )}

      {/* turn 数 */}
      {stats.turnCount > 0 && (
        <>
          <div className="h-3 w-px bg-border/50" />
          <span className="text-muted-foreground/60">
            {stats.turnCount} 轮
          </span>
        </>
      )}
    </div>
  )
}

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  tooltip?: string
}

function StatItem({ icon, label, value, highlight, tooltip }: StatItemProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        highlight && 'text-emerald-600 dark:text-emerald-400',
      )}
      title={tooltip}
    >
      <span className="opacity-70">{icon}</span>
      <span className="text-muted-foreground/80">{label}</span>
      <span className={cn('font-medium tabular-nums', highlight && 'text-emerald-600 dark:text-emerald-400')}>
        {value}
      </span>
    </div>
  )
}
