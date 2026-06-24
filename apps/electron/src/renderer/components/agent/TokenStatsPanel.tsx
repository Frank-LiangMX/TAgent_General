/**
 * TokenStatsPanel — 会话底栏统计条
 *
 * 左侧：当前 Context 窗口占用（圆环 + 分项 Popover 入口）
 * 右侧：累计 token、缓存命中、费用、轮数
 * 仅在通用模式显示（TA 模式暂不显示）。
 */

import { useAtomValue } from 'jotai'
import { Coins, Database, TrendingDown, TrendingUp } from 'lucide-react'
import * as React from 'react'

import {
  agentContextStatusAtom,
  cacheHitRateAtom,
  currentAgentSessionIdAtom,
  currentSessionTokenStatsAtom,
} from '@/atoms/agent-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { ContextUsageBadge } from './ContextUsageBadge'

interface TokenStatsPanelProps {
  isProcessing?: boolean
  onCompact?: () => void
  onClientCompact?: () => void
}

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
  return `$${costUsd.toFixed(4)}`
}

/** 格式化命中率为百分比 */
function formatHitRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${Math.round(rate * 100)}%`
}

export function TokenStatsPanel({
  isProcessing = false,
  onCompact,
  onClientCompact,
}: TokenStatsPanelProps): React.ReactElement | null {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const sessionId = useAtomValue(currentAgentSessionIdAtom)
  const stats = useAtomValue(currentSessionTokenStatsAtom)
  const contextStatus = useAtomValue(agentContextStatusAtom)
  const cacheHitRate = useAtomValue(cacheHitRateAtom)

  if (topLevelMode === 'ta') return null

  const hasTokenStats = stats.totalInputTokens > 0 || stats.totalOutputTokens > 0
  const hasContextData = (contextStatus.inputTokens ?? 0) > 0
  const showContextUsage = hasContextData && onCompact != null

  if (!hasTokenStats && !showContextUsage) return null

  const cacheSavedTokens = stats.totalCacheReadTokens
  const hasCacheData = stats.totalCacheReadTokens > 0 || stats.totalCacheCreationTokens > 0

  return (
    <div className="token-stats-bar content-shell-chrome-bleed flex items-center gap-4 px-4 py-2 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
      {showContextUsage && (
        <>
          <ContextUsageBadge
            sessionId={sessionId}
            variant="inline"
            inputTokens={contextStatus.inputTokens}
            outputTokens={contextStatus.outputTokens}
            cacheReadTokens={contextStatus.cacheReadTokens}
            cacheCreationTokens={contextStatus.cacheCreationTokens}
            costUsd={contextStatus.costUsd}
            contextWindow={contextStatus.contextWindow}
            usageUpdatedAt={contextStatus.usageUpdatedAt}
            isCompacting={contextStatus.isCompacting}
            isProcessing={isProcessing}
            onCompact={onCompact}
            onClientCompact={onClientCompact}
          />
          {hasTokenStats && <div className="h-3 w-px bg-border/50" />}
        </>
      )}

      {hasTokenStats && (
        <>
          <StatItem
            icon={<TrendingDown size={12} />}
            label="输入"
            value={formatTokens(stats.totalInputTokens)}
          />
          <StatItem
            icon={<TrendingUp size={12} />}
            label="输出"
            value={formatTokens(stats.totalOutputTokens)}
          />
          {hasCacheData && (
            <>
              <div className="h-3 w-px bg-border/50" />
              <StatItem
                icon={<Database size={12} />}
                label="缓存命中"
                value={formatHitRate(cacheHitRate)}
                highlight={cacheHitRate !== null && cacheHitRate > 0.5}
                tooltip={
                  cacheSavedTokens > 0 ? `节省 ${formatTokens(cacheSavedTokens)} tokens` : undefined
                }
              />
            </>
          )}
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
          {stats.turnCount > 0 && (
            <>
              <div className="h-3 w-px bg-border/50" />
              <span className="text-muted-foreground/60">{stats.turnCount} 轮</span>
            </>
          )}
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
  const content = (
    <div
      className={cn(
        'flex items-center gap-1.5',
        highlight && 'text-emerald-600 dark:text-emerald-400'
      )}
    >
      <span className="opacity-70">{icon}</span>
      <span className="text-muted-foreground/80">{label}</span>
      <span
        className={cn(
          'font-medium tabular-nums',
          highlight && 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        {value}
      </span>
    </div>
  )

  if (!tooltip) return content

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )
}
