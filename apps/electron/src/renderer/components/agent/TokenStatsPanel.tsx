/**
 * TokenStatsPanel — 会话底栏统计条
 *
 * 左侧：当前 Context 窗口占用（圆环 + 分项 Popover 入口）
 * 右侧：累计 token、缓存读取占比、轮数
 * 仅在通用模式显示（TA 模式暂不显示）。
 */

import { useAtomValue } from 'jotai'
import { Database, TrendingDown, TrendingUp } from 'lucide-react'
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
import { getContextUsageDescription } from '@/lib/context-usage-labels'

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

  const cacheSavedTokens = stats.totalCacheReadTokens
  const hasCacheData = stats.totalCacheReadTokens > 0 || stats.totalCacheCreationTokens > 0
  const cacheReadTooltip = React.useMemo((): readonly string[] | undefined => {
    const base = getContextUsageDescription('缓存读取')
    if (!base) return undefined
    const lines: string[] = []
    if (hasCacheData && cacheSavedTokens > 0) {
      lines.push(`本会话累计缓存读取 ${formatTokens(cacheSavedTokens)} tokens。`)
    }
    lines.push(base)
    if (stats.turnCount <= 1) {
      lines.push('首条消息也可能 >0，不表示上一轮对话复用。')
    }
    return lines
  }, [cacheSavedTokens, hasCacheData, stats.turnCount])

  if (topLevelMode === 'ta') return null

  const hasTokenStats = stats.totalInputTokens > 0 || stats.totalOutputTokens > 0
  const hasContextData = (contextStatus.inputTokens ?? 0) > 0
  const showContextUsage = hasContextData && onCompact != null

  if (!hasTokenStats && !showContextUsage) return null

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
            tooltip={getContextUsageDescription('累计输入')}
          />
          <StatItem
            icon={<TrendingUp size={12} />}
            label="输出"
            value={formatTokens(stats.totalOutputTokens)}
            tooltip={getContextUsageDescription('累计输出')}
          />
          {hasCacheData && (
            <>
              <div className="h-3 w-px bg-border/50" />
              <StatItem
                icon={<Database size={12} />}
                label="缓存读取"
                value={formatHitRate(cacheHitRate)}
                highlight={cacheHitRate !== null && cacheHitRate > 0.5}
                tooltip={cacheReadTooltip}
              />
            </>
          )}
          {stats.turnCount > 0 && (
            <>
              <div className="h-3 w-px bg-border/50" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground/60">{stats.turnCount} 轮</span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{getContextUsageDescription('对话轮数')}</p>
                </TooltipContent>
              </Tooltip>
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
  tooltip?: string | readonly string[]
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

  const lines = typeof tooltip === 'string' ? [tooltip] : tooltip

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        <div className="flex flex-col gap-1.5 leading-relaxed">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
