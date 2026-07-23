/**
 * TokenStatsPanel — 会话底栏统计条
 *
 * 左侧：当前 Context 窗口占用（圆环 + 分项 Popover 入口）
 * 右侧：累计 token、缓存读取占比、轮数
 * 仅在通用模式显示（TA 模式暂不显示）。
 */

import { useAtomValue } from 'jotai'
import { Database, Hash, TrendingDown, TrendingUp } from 'lucide-react'
import * as React from 'react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import { ContextUsageBadge } from './ContextUsageBadge'
import {
  agentContextStatusAtom,
  cacheHitRateAtom,
  currentAgentSessionIdAtom,
  currentSessionTokenStatsAtom,
} from '@/atoms/agent-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { useAgentSessionChannelModel } from '@/hooks/useAgentSessionChannelModel'
import { cn } from '@/lib/utils'
import { getContextUsageDescription } from '@/lib/context-usage-labels'

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

export const TokenStatsPanel = React.memo(function TokenStatsPanel({
  isProcessing = false,
  onCompact,
  onClientCompact,
}: TokenStatsPanelProps): React.ReactElement | null {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const sessionId = useAtomValue(currentAgentSessionIdAtom)
  const stats = useAtomValue(currentSessionTokenStatsAtom)
  const contextStatus = useAtomValue(agentContextStatusAtom)
  const cacheHitRate = useAtomValue(cacheHitRateAtom)
  const { channel } = useAgentSessionChannelModel(sessionId ?? '')
  const callStats = stats.lastCallStats
  const modelCallCount = callStats ? callStats.modelCalls + callStats.subagentCalls : 0

  /**
   * kscc 内网 CLI 的 usage / contextWindow 与 Anthropic 口径不一致，
   * 圆环分母/分子经常虚高或失真 → 对用户误导。kscc 会话不展示 Context 占用。
   */
  const isKsccChannel = channel?.provider === 'kscc-internal'

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

  // TA 模式整栏不挂；通用模式即使无数据也要常驻占位，避免底栏高度跳变打乱 main 基线
  if (topLevelMode === 'ta') return null

  const hasTokenStats = stats.totalInputTokens > 0 || stats.totalOutputTokens > 0
  const hasContextData = (contextStatus.inputTokens ?? 0) > 0
  const showContextUsage = !isKsccChannel && hasContextData && onCompact != null
  const empty = !hasTokenStats && !showContextUsage && !callStats

  return (
    <div
      className={cn(
        'token-stats-bar content-shell-chrome-bleed flex items-center justify-end gap-2.5 px-1 py-0 text-[8px] leading-none text-muted-foreground/50',
        empty && 'token-stats-bar--empty'
      )}
      aria-hidden={empty || undefined}
    >
      {!empty && showContextUsage && (
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
          {hasTokenStats && <div className="h-2 w-px bg-border/30" />}
        </>
      )}

      {!empty && hasTokenStats && (
        <>
          <StatItem
            icon={<TrendingDown size={9} />}
            label="输入"
            value={formatTokens(stats.totalInputTokens)}
            tooltip={getContextUsageDescription('累计输入')}
          />
          <StatItem
            icon={<TrendingUp size={9} />}
            label="输出"
            value={formatTokens(stats.totalOutputTokens)}
            tooltip={getContextUsageDescription('累计输出')}
          />
          {hasCacheData && (
            <>
              <div className="h-2 w-px bg-border/30" />
              <StatItem
                icon={<Database size={9} />}
                label="缓存读取"
                value={formatHitRate(cacheHitRate)}
                highlight={cacheHitRate !== null && cacheHitRate > 0.5}
                tooltip={cacheReadTooltip}
              />
            </>
          )}
          {stats.turnCount > 0 && (
            <>
              <div className="h-2 w-px bg-border/30" />
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

      {!empty && callStats && (
        <>
          {(hasTokenStats || showContextUsage) && <div className="h-2 w-px bg-border/30" />}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 whitespace-nowrap text-muted-foreground/80 transition-colors hover:text-foreground"
                aria-label="查看上一轮调用次数详情"
              >
                <Hash size={9} className="opacity-70" />
                <span>调用 {modelCallCount}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-64 p-3 text-xs">
              <div className="space-y-2">
                <p className="font-medium text-foreground">上一轮调用详情</p>
                <div className="space-y-1.5 text-muted-foreground">
                  <CallStatRow label="主 Agent 模型响应" value={callStats.modelCalls} />
                  <CallStatRow label="SubAgent 模型响应" value={callStats.subagentCalls} />
                  <CallStatRow label="Query 尝试（含重试）" value={callStats.queryAttempts} />
                  <CallStatRow
                    label="Context Usage 控制请求"
                    value={callStats.contextUsageRequests}
                  />
                  <CallStatRow label="标题生成请求" value={callStats.titleRequests} />
                  <CallStatRow label="自动重试 / 恢复" value={callStats.retryAttempts} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  )
})

function CallStatRow({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
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
        'flex items-center gap-1 leading-none',
        highlight && 'text-emerald-600 dark:text-emerald-400'
      )}
    >
      <span className="opacity-70">{icon}</span>
      <span className="text-muted-foreground/80 whitespace-nowrap overflow-hidden">{label}</span>
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
