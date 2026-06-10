/**
 * UsageStatsSettings - 使用统计设置页面
 *
 * 显示所有模型的使用统计：
 * - 按模型聚合的 token 消耗
 * - 按时间范围的统计（今日/本周/本月/全部）
 * - 总费用统计
 * - 最近调用记录列表
 */

import { BarChart3, Coins, Database, Zap, TrendingUp, Calendar, RefreshCw, Loader2, Clock, ExternalLink } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { UsageStatsOverview, ModelUsageStats, TimeRangeStats, UsageCallRecord } from '@tagent/shared'

import { useOpenSession } from '@/hooks/useOpenSession'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

/** 格式化 token 数 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return `${tokens}`
}

/** 格式化费用 */
function formatCost(costUsd: number): string {
  if (costUsd >= 1) return `$${costUsd.toFixed(2)}`
  if (costUsd >= 0.01) return `$${costUsd.toFixed(3)}`
  return `$${costUsd.toFixed(4)}`
}

/** 格式化模型名（缩短长名称） */
function formatModelName(modelId: string): string {
  // 尝试提取模型名核心部分
  const parts = modelId.split('/')
  if (parts.length > 2) {
    return parts.slice(-2).join('/')
  }
  return modelId
}

/** 格式化时间 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN')
}

export function UsageStatsSettings(): React.ReactElement {
  const [stats, setStats] = React.useState<UsageStatsOverview | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [activeTimeRange, setActiveTimeRange] = React.useState<'today' | 'week' | 'month' | 'all'>('all')
  const openSession = useOpenSession()

  const loadStats = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.getUsageStatsOverview()
      setStats(result)
    } catch (error) {
      console.error('[UsageStatsSettings] 加载失败:', error)
      toast.error('加载统计数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadStats()
  }, [loadStats])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <BarChart3 size={24} />
        <span className="text-sm">暂无统计数据</span>
        <Button variant="outline" size="sm" onClick={loadStats}>
          重新加载
        </Button>
      </div>
    )
  }

  const timeRangeStats = stats.byTimeRange[activeTimeRange]

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* 标题 + 刷新按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold">使用统计</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={loadStats} disabled={isLoading}>
            <RefreshCw size={14} />
          </Button>
        </div>

        {/* 总览卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <OverviewCard
            icon={<Zap size={18} />}
            label="总输入"
            value={formatTokens(stats.totalInputTokens)}
            subLabel={`${stats.totalSessions} 个会话`}
          />
          <OverviewCard
            icon={<TrendingUp size={18} />}
            label="总输出"
            value={formatTokens(stats.totalOutputTokens)}
          />
          <OverviewCard
            icon={<Database size={18} />}
            label="缓存节省"
            value={formatTokens(stats.totalCacheReadTokens)}
            highlight={stats.totalCacheReadTokens > 0}
          />
          <OverviewCard
            icon={<Coins size={18} />}
            label="总费用"
            value={formatCost(stats.totalCostUsd)}
          />
        </div>

        {/* 时间范围选择 */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-muted-foreground" />
          <div className="flex gap-1">
            {(['today', 'week', 'month', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={activeTimeRange === range ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setActiveTimeRange(range)}
              >
                {range === 'today' ? '今日' : range === 'week' ? '本周' : range === 'month' ? '本月' : '全部'}
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-2">
            {timeRangeStats.sessions} 个会话
          </span>
        </div>

        {/* 时间范围统计卡片 */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg border border-border bg-muted/30">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">输入 Token</div>
            <div className="text-xl font-semibold">{formatTokens(timeRangeStats.totalInputTokens)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">输出 Token</div>
            <div className="text-xl font-semibold">{formatTokens(timeRangeStats.totalOutputTokens)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">费用</div>
            <div className="text-xl font-semibold">{formatCost(timeRangeStats.totalCostUsd)}</div>
          </div>
        </div>

        {/* 最近调用记录 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock size={16} />
            最近调用记录
          </h3>

          {stats.recentCalls.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              暂无调用记录
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentCalls.slice(0, 20).map((record, index) => (
                <CallRecordCard
                  key={`${record.sessionId}-${index}`}
                  record={record}
                  onOpenSession={() => openSession('agent', record.sessionId, record.sessionTitle)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 模型使用统计表格 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">按模型统计</h3>

          {stats.byModel.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              暂无模型使用记录
            </div>
          ) : (
            <div className="space-y-2">
              {stats.byModel.map((model) => (
                <ModelStatsCard key={model.modelId} model={model} />
              ))}
            </div>
          )}
        </div>

        {/* 缓存命中说明 */}
        {stats.totalCacheReadTokens > 0 && (
          <div className="p-4 rounded-lg border border-border bg-emerald-500/10 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-emerald-500" />
              <span className="font-medium">缓存命中节省</span>
            </div>
            <p className="text-muted-foreground">
              Prompt Caching 共节省 <span className="text-emerald-600 font-medium">{formatTokens(stats.totalCacheReadTokens)}</span> tokens，
              约占总输入的 <span className="text-emerald-600 font-medium">
                {Math.round(stats.totalCacheReadTokens / stats.totalInputTokens * 100)}%
              </span>。
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

interface OverviewCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subLabel?: string
  highlight?: boolean
}

function OverviewCard({ icon, label, value, subLabel, highlight }: OverviewCardProps): React.ReactElement {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('text-muted-foreground', highlight && 'text-emerald-500')}>
          {icon}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={cn('text-xl font-semibold', highlight && 'text-emerald-600')}>
        {value}
      </div>
      {subLabel && (
        <div className="text-xs text-muted-foreground mt-1">{subLabel}</div>
      )}
    </div>
  )
}

interface CallRecordCardProps {
  record: UsageCallRecord
  onOpenSession: () => void
}

function CallRecordCard({ record, onOpenSession }: CallRecordCardProps): React.ReactElement {
  return (
    <div
      className="p-3 rounded-lg border border-border hover:border-border/80 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onOpenSession}
    >
      {/* 会话标题 + 时间 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate max-w-[200px]">
            {record.sessionTitle}
          </span>
          <ExternalLink size={12} className="text-muted-foreground" />
        </div>
        <span className="text-xs text-muted-foreground">
          {formatTime(record.timestamp)}
        </span>
      </div>

      {/* 模型 */}
      <div className="text-xs text-muted-foreground mb-2">
        {formatModelName(record.modelId)}
      </div>

      {/* Token 统计 */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">输入:</span>
          <span className="font-medium tabular-nums ml-1">{formatTokens(record.inputTokens)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">输出:</span>
          <span className="font-medium tabular-nums ml-1">{formatTokens(record.outputTokens)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">费用:</span>
          <span className="font-medium tabular-nums ml-1">{formatCost(record.costUsd)}</span>
        </div>
      </div>

      {/* 缓存统计（如有） */}
      {record.cacheReadTokens > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1 text-xs">
          <Database size={10} className="text-emerald-500" />
          <span className="text-emerald-600 font-medium tabular-nums">
            {formatTokens(record.cacheReadTokens)}
          </span>
          <span className="text-muted-foreground">缓存节省</span>
        </div>
      )}
    </div>
  )
}

interface ModelStatsCardProps {
  model: ModelUsageStats
}

function ModelStatsCard({ model }: ModelStatsCardProps): React.ReactElement {
  const totalTokens = model.totalInputTokens + model.totalOutputTokens
  const costPerThousandTokens = totalTokens > 0 ? (model.totalCostUsd / totalTokens * 1000) : 0

  return (
    <div className="p-4 rounded-lg border border-border hover:border-border/80 transition-colors">
      {/* 模型名 + 会话数 */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-sm truncate flex-1">
          {formatModelName(model.modelId)}
        </div>
        <div className="text-xs text-muted-foreground">
          {model.sessions} 个会话
        </div>
      </div>

      {/* Token 统计 */}
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground mb-1">输入</div>
          <div className="font-medium tabular-nums">{formatTokens(model.totalInputTokens)}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">输出</div>
          <div className="font-medium tabular-nums">{formatTokens(model.totalOutputTokens)}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">费用</div>
          <div className="font-medium tabular-nums">{formatCost(model.totalCostUsd)}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">平均输入</div>
          <div className="font-medium tabular-nums">{formatTokens(model.avgInputPerSession)}</div>
        </div>
      </div>

      {/* 缓存统计（如有） */}
      {model.totalCacheReadTokens > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs">
          <Database size={12} className="text-emerald-500" />
          <span className="text-muted-foreground">缓存节省:</span>
          <span className="text-emerald-600 font-medium tabular-nums">
            {formatTokens(model.totalCacheReadTokens)}
          </span>
          <span className="text-muted-foreground">
            ({Math.round(model.totalCacheReadTokens / model.totalInputTokens * 100)}%)
          </span>
        </div>
      )}
    </div>
  )
}