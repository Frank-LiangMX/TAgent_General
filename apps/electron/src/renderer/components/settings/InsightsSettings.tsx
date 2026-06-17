/**
 * InsightsSettings - 数据洞察设置页（合并磁盘管理 + 使用统计）
 *
 * 设计思路（结合 ui-ux-pro-max + minimalist-ui + gpt-taste 原则）：
 * - Bento Grid 4 列响应式，grid-flow-dense 零空隙
 * - Glassmorphism 玻璃拟态（`session-glass-surface`）
 * - Editorial typography：紧凑追踪、大字号巨字
 * - 暖色单色配色 + 5 色微妙色板用于分类
 * - 无 cheap meta-labels（无 "SECTION 01"）
 * - 严格 AIDA：Hero Insight → Bento 详情 → Action
 *
 * 数据维度：
 * - 累计 Token / 费用 / 缓存节省（巨字）
 * - 时间范围切换（今日/本周/本月/全部）
 * - 存储占用（按类别饼条）
 * - 按模型统计（横条对比图）
 * - 最近调用记录（时间轴）
 * - 自动清理配置
 */

import { useAtomValue } from 'jotai'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  Coins,
  Database,
  HardDrive,
  Hourglass,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type {
  CleanupResult,
  ModelUsageStats,
  StorageStats,
  TimeRange,
  UsageCallRecord,
  UsageStatsOverview,
} from '@tagent/shared'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useOpenSession } from '@/hooks/useOpenSession'
import { cn } from '@/lib/utils'

/** ===== 工具函数 ===== */

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return `${tokens}`
}

function formatCost(costUsd: number): string {
  if (costUsd >= 1) return `$${costUsd.toFixed(2)}`
  if (costUsd >= 0.01) return `$${costUsd.toFixed(3)}`
  return `$${costUsd.toFixed(4)}`
}

function formatModelName(modelId: string): string {
  const parts = modelId.split('/')
  if (parts.length > 2) return parts.slice(-2).join('/')
  return modelId
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  all: '全部',
}

/** 5 色色板（暖色单色 + 微妙饱和） */
const STORAGE_PALETTE = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-cyan-500',
] as const

/** 类别标签的中文映射 */
const STORAGE_CATEGORY_LABELS: Record<string, string> = {
  'agent-sessions': 'Agent 会话',
  'chat-sessions': 'Chat 会话',
  'mcp-config': 'MCP 配置',
  'sdk-config': 'SDK 配置',
  workspaces: '工作区',
  'temp-files': '临时文件',
  'media-cache': '媒体缓存',
  logs: '日志',
}

/** ===== 组件 ===== */

export function InsightsSettings(): React.ReactElement {
  // 使用统计
  const [stats, setStats] = React.useState<UsageStatsOverview | null>(null)
  const [activeTimeRange, setActiveTimeRange] = React.useState<TimeRange>('week')
  const [statsLoading, setStatsLoading] = React.useState(false)
  const openSession = useOpenSession()

  // 存储
  const [storage, setStorage] = React.useState<StorageStats | null>(null)
  const [storageLoading, setStorageLoading] = React.useState(false)
  const [cleaningKey, setCleaningKey] = React.useState<string | null>(null)
  const [lastResult, setLastResult] = React.useState<CleanupResult | null>(null)
  const [autoCleanupTemp, setAutoCleanupTemp] = React.useState(true)
  const [autoCleanupDays, setAutoCleanupDays] = React.useState(0)

  // 加载数据
  const loadStats = React.useCallback(async () => {
    setStatsLoading(true)
    try {
      const result = (await window.electronAPI.getUsageStatsOverview()) as UsageStatsOverview
      setStats(result)
    } catch (e) {
      console.error('[Insights] 加载使用统计失败:', e)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadStorage = React.useCallback(async () => {
    setStorageLoading(true)
    try {
      const result = (await window.electronAPI.getStorageStats()) as StorageStats
      setStorage(result)
    } catch (e) {
      console.error('[Insights] 加载存储统计失败:', e)
    } finally {
      setStorageLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadStats()
    void loadStorage()
    window.electronAPI
      .getSettings()
      .then((settings) => {
        setAutoCleanupTemp(settings.autoCleanupTempOnStart !== false)
        setAutoCleanupDays(settings.autoCleanupArchivedDays ?? 0)
      })
      .catch(console.error)
  }, [loadStats, loadStorage])

  const handleRefresh = (): void => {
    void loadStats()
    void loadStorage()
  }

  // 存储清理
  const handleCleanCategory = async (key: string, orphansOnly: boolean): Promise<void> => {
    setCleaningKey(key)
    setLastResult(null)
    try {
      const result = (await window.electronAPI.cleanupStorage({
        categories: [key],
        orphansOnly,
        archivedBeforeDays: 0,
      })) as CleanupResult
      setLastResult(result)
      await loadStorage()
      if (result.freedBytes > 0) {
        toast.success(`已释放 ${formatBytes(result.freedBytes)}`)
      }
    } catch (e) {
      console.error('[Insights] 清理失败:', e)
      toast.error('清理失败')
    } finally {
      setCleaningKey(null)
    }
  }

  const handleCleanTemp = async (): Promise<void> => {
    setCleaningKey('temp-files')
    setLastResult(null)
    try {
      const result = (await window.electronAPI.cleanupTempStorage()) as CleanupResult
      setLastResult(result)
      await loadStorage()
      if (result.freedBytes > 0) {
        toast.success(`已释放 ${formatBytes(result.freedBytes)}`)
      }
    } catch (e) {
      console.error('[Insights] 清理临时文件失败:', e)
      toast.error('清理失败')
    } finally {
      setCleaningKey(null)
    }
  }

  const handleCleanAllOrphans = async (): Promise<void> => {
    setCleaningKey('all-orphans')
    setLastResult(null)
    try {
      const result = (await window.electronAPI.cleanupStorage({
        categories: ['agent-sessions', 'sdk-config', 'workspaces'],
        orphansOnly: true,
        archivedBeforeDays: 0,
      })) as CleanupResult
      setLastResult(result)
      await loadStorage()
      if (result.freedBytes > 0) {
        toast.success(`已释放 ${formatBytes(result.freedBytes)}`)
      }
    } catch (e) {
      console.error('[Insights] 清理孤儿数据失败:', e)
      toast.error('清理失败')
    } finally {
      setCleaningKey(null)
    }
  }

  const handleAutoCleanupTempChange = async (enabled: boolean): Promise<void> => {
    setAutoCleanupTemp(enabled)
    try {
      await window.electronAPI.updateSettings({ autoCleanupTempOnStart: enabled })
    } catch (e) {
      console.error('[Insights] 更新自动清理设置失败:', e)
    }
  }

  const handleAutoCleanupDaysChange = async (value: string): Promise<void> => {
    const days = parseInt(value, 10)
    setAutoCleanupDays(days)
    try {
      await window.electronAPI.updateSettings({ autoCleanupArchivedDays: days })
    } catch (e) {
      console.error('[Insights] 更新清理天数失败:', e)
    }
  }

  const isLoading = statsLoading || storageLoading
  const timeRangeStats = stats?.byTimeRange[activeTimeRange]

  // 排序后的存储类别
  const sortedStorageCategories = React.useMemo(() => {
    if (!storage) return []
    return [...storage.categories].sort((a, b) => b.bytes - a.bytes)
  }, [storage])

  // 排序后的模型统计
  const sortedModelStats = React.useMemo(() => {
    if (!stats) return []
    return [...stats.byModel].sort((a, b) => b.totalCostUsd - a.totalCostUsd)
  }, [stats])

  const totalOrphanBytes = storage?.categories.reduce((sum, c) => sum + c.orphanBytes, 0) ?? 0
  const hasOrphans = totalOrphanBytes > 0
  const maxModelCost = Math.max(...sortedModelStats.map((m) => m.totalCostUsd), 0)

  return (
    <div className="space-y-6">
      {/* ===== Hero: 总览巨字 + 时间范围切换 ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/[0.08] blur-3xl pointer-events-none" />
        <div className="relative px-6 py-5">
          {/* 顶部：标题 + 时间范围切换 */}
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-muted-foreground" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                Insights
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/40 border border-border/30">
                {(['today', 'week', 'month', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setActiveTimeRange(range)}
                    className={cn(
                      'px-2.5 h-6 rounded-md text-[11px] font-medium transition-colors',
                      activeTimeRange === range
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {TIME_RANGE_LABELS[range]}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* 巨字统计 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
            <HeroMetric
              icon={<Zap size={14} />}
              label="Token 总数"
              value={
                timeRangeStats
                  ? formatTokens(timeRangeStats.totalInputTokens + timeRangeStats.totalOutputTokens)
                  : '—'
              }
              sub={timeRangeStats ? `${timeRangeStats.sessions} 个会话` : ''}
            />
            <HeroMetric
              icon={<Coins size={14} />}
              label="累计费用"
              value={timeRangeStats ? formatCost(timeRangeStats.totalCostUsd) : '—'}
              sub={
                stats?.totalCacheReadTokens
                  ? `节省 ${formatTokens(stats.totalCacheReadTokens)} 缓存`
                  : '无缓存命中'
              }
              subHighlight={!!stats?.totalCacheReadTokens}
            />
            <HeroMetric
              icon={<HardDrive size={14} />}
              label="存储用量"
              value={storage ? formatBytes(storage.totalBytes) : '—'}
              sub={hasOrphans ? `${formatBytes(totalOrphanBytes)} 可清理` : '数据整洁'}
            />
          </div>
        </div>
      </div>

      {/* ===== Bento Grid: 详细数据 ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 grid-flow-dense">
        {/* 存储类别（横跨 4 列） */}
        <BentoCard
          className="col-span-1 sm:col-span-2 lg:col-span-4"
          icon={<Database size={14} />}
          title="存储分布"
          subtitle={storage ? `共 ${formatBytes(storage.totalBytes)}` : ''}
        >
          {storage && (
            <div className="space-y-3">
              {/* 存储条 */}
              <StorageBar categories={sortedStorageCategories} totalBytes={storage.totalBytes} />

              {/* 类别列表 - 每行 3 个 */}
              <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                {sortedStorageCategories.map((cat, i) => (
                  <StorageCategoryRow
                    key={cat.key}
                    label={STORAGE_CATEGORY_LABELS[cat.key] ?? cat.label}
                    bytes={cat.bytes}
                    totalBytes={storage.totalBytes}
                    hasOrphans={cat.hasOrphans}
                    orphanBytes={cat.orphanBytes}
                    colorIndex={i}
                  />
                ))}
              </div>
            </div>
          )}
        </BentoCard>

        {/* 自动清理（横跨 2 列） */}
        <BentoCard
          className="col-span-1 sm:col-span-2"
          icon={<Sparkles size={14} />}
          title="自动清理"
          subtitle="保持系统整洁"
        >
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">启动清理临时</div>
                <div className="text-xs text-muted-foreground">预览/安装缓存</div>
              </div>
              <Switch checked={autoCleanupTemp} onCheckedChange={handleAutoCleanupTempChange} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-foreground">归档会话清理</div>
                <div className="text-xs text-muted-foreground">超过指定天数</div>
              </div>
              <Select value={String(autoCleanupDays)} onValueChange={handleAutoCleanupDaysChange}>
                <SelectTrigger className="h-8 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">禁用</SelectItem>
                  <SelectItem value="7">7 天</SelectItem>
                  <SelectItem value="30">30 天</SelectItem>
                  <SelectItem value="90">90 天</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </BentoCard>

        {/* 手动清理（横跨 2 列） */}
        <BentoCard
          className="col-span-1 sm:col-span-2"
          icon={<Trash2 size={14} />}
          title="手动清理"
          subtitle={hasOrphans ? `${formatBytes(totalOrphanBytes)} 可释放` : '数据整洁'}
        >
          <div className="grid grid-cols-2 gap-3 mt-2">
            <CleanupAction
              label="临时文件"
              onClick={handleCleanTemp}
              loading={cleaningKey === 'temp-files'}
            />
            <CleanupAction
              label="孤儿数据"
              onClick={handleCleanAllOrphans}
              loading={cleaningKey === 'all-orphans'}
              variant={hasOrphans ? 'primary' : 'ghost'}
            />
          </div>
        </BentoCard>

        {/* 按模型统计（横跨 2 列） */}
        <BentoCard
          className="col-span-1 sm:col-span-2 lg:col-span-2"
          icon={<TrendingUp size={14} />}
          title="按模型统计"
          subtitle={sortedModelStats.length > 0 ? `${sortedModelStats.length} 个模型` : '暂无数据'}
        >
          {sortedModelStats.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">暂无模型使用记录</div>
          ) : (
            <div className="space-y-2.5 mt-1">
              {sortedModelStats.slice(0, 5).map((model) => (
                <ModelBar key={model.modelId} model={model} maxCost={maxModelCost} />
              ))}
            </div>
          )}
        </BentoCard>

        {/* 最近调用（横跨 2 列） */}
        <BentoCard
          className="col-span-1 sm:col-span-2 lg:col-span-2"
          icon={<Clock size={14} />}
          title="最近调用"
          subtitle={stats ? `${stats.recentCalls.length} 条记录` : ''}
          scrollable
        >
          {stats && stats.recentCalls.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">暂无调用记录</div>
          ) : (
            <div className="space-y-1 mt-1">
              {stats?.recentCalls.slice(0, 8).map((record, idx) => (
                <CallRecordRow
                  key={`${record.sessionId}-${idx}`}
                  record={record}
                  onOpenSession={() => openSession('agent', record.sessionId, record.sessionTitle)}
                />
              ))}
            </div>
          )}
        </BentoCard>
      </div>

      {/* 清理结果提示 */}
      {lastResult && (
        <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-2.5 text-xs flex items-center gap-2">
          {lastResult.freedBytes > 0 ? (
            <>
              <CheckCircle />
              <span className="text-foreground">
                已释放 <span className="font-medium">{formatBytes(lastResult.freedBytes)}</span>
                ，删除 <span className="font-medium">{lastResult.deletedCount}</span> 个文件
              </span>
            </>
          ) : (
            <>
              <CheckCircle muted />
              <span className="text-muted-foreground">没有需要清理的数据</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ===== 内部组件 =====

function HeroMetric({
  icon,
  label,
  value,
  sub,
  subHighlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  subHighlight?: boolean
}): React.ReactElement {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.15em] font-medium">{label}</span>
      </div>
      <div className="text-[32px] leading-none font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      {sub && (
        <div
          className={cn(
            'text-[11px] mt-1.5 flex items-center gap-1',
            subHighlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'
          )}
        >
          {subHighlight && <span className="inline-block w-1 h-1 rounded-full bg-emerald-500" />}
          {sub}
        </div>
      )}
    </div>
  )
}

function BentoCard({
  className,
  icon,
  title,
  subtitle,
  scrollable = false,
  children,
}: {
  className?: string
  icon: React.ReactNode
  title: string
  subtitle?: string
  scrollable?: boolean
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/40 bg-card/60 p-4 flex flex-col',
        'hover:border-border/70 transition-colors',
        scrollable && 'max-h-64',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <span className="text-xs font-medium text-foreground truncate">{title}</span>
        </div>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
            {subtitle}
          </span>
        )}
      </div>
      <div
        className={cn('flex-1 min-h-0', scrollable && 'overflow-y-auto scrollbar-thin -mr-1 pr-1')}
      >
        {children}
      </div>
    </div>
  )
}

function StorageBar({
  categories,
  totalBytes,
}: {
  categories: { key: string; bytes: number }[]
  totalBytes: number
}): React.ReactElement {
  if (totalBytes === 0) {
    return <div className="h-2 w-full rounded-full bg-muted" />
  }
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {categories.map((cat, i) => {
        const pct = (cat.bytes / totalBytes) * 100
        if (pct < 0.5) return null
        return (
          <div
            key={cat.key}
            className={cn('h-full transition-all', STORAGE_PALETTE[i % STORAGE_PALETTE.length])}
            style={{ width: `${pct}%` }}
            title={`${cat.key}: ${formatBytes(cat.bytes)}`}
          />
        )
      })}
    </div>
  )
}

function StorageCategoryRow({
  label,
  bytes,
  totalBytes,
  hasOrphans,
  orphanBytes,
  colorIndex,
}: {
  label: string
  bytes: number
  totalBytes: number
  hasOrphans: boolean
  orphanBytes: number
  colorIndex: number
}): React.ReactElement {
  const pct = totalBytes > 0 ? (bytes / totalBytes) * 100 : 0
  return (
    <div className="flex items-center gap-1.5 text-[11px] min-w-0">
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full shrink-0',
          STORAGE_PALETTE[colorIndex % STORAGE_PALETTE.length]
        )}
      />
      <span className="text-foreground truncate">{label}</span>
      <span className="text-muted-foreground tabular-nums shrink-0 ml-auto">
        {formatBytes(bytes)}
      </span>
    </div>
  )
}

function ModelBar({
  model,
  maxCost,
}: {
  model: ModelUsageStats
  maxCost: number
}): React.ReactElement {
  const pct = maxCost > 0 ? (model.totalCostUsd / maxCost) * 100 : 0
  return (
    <div className="group">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-foreground truncate flex-1">{formatModelName(model.modelId)}</span>
        <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
          {model.sessions} 次 · {formatCost(model.totalCostUsd)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  )
}

function CallRecordRow({
  record,
  onOpenSession,
}: {
  record: UsageCallRecord
  onOpenSession: () => void
}): React.ReactElement {
  return (
    <button
      onClick={onOpenSession}
      className="group w-full flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-foreground truncate max-w-[180px]">{record.sessionTitle}</span>
        </div>
        <div className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
          {formatModelName(record.modelId)}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums shrink-0">
        <span title="输入">
          <span className="opacity-60">↓</span> {formatTokens(record.inputTokens)}
        </span>
        <span title="输出">
          <span className="opacity-60">↑</span> {formatTokens(record.outputTokens)}
        </span>
        {record.cacheReadTokens > 0 && (
          <span title="缓存" className="text-emerald-600 dark:text-emerald-400">
            ⚡{formatTokens(record.cacheReadTokens)}
          </span>
        )}
        <span className="font-medium text-foreground/80">{formatCost(record.costUsd)}</span>
      </div>
      <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 w-12 text-right">
        {formatTime(record.timestamp)}
      </span>
      <ArrowUpRight
        size={10}
        className="text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0"
      />
    </button>
  )
}

function CleanupAction({
  label,
  onClick,
  loading,
  variant = 'ghost',
}: {
  label: string
  onClick: () => void
  loading: boolean
  variant?: 'primary' | 'ghost'
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-muted/50 text-foreground hover:bg-muted',
        'disabled:opacity-50'
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      <span className="font-medium">{label}</span>
    </button>
  )
}

function CheckCircle({ muted = false }: { muted?: boolean }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium',
        muted
          ? 'bg-muted text-muted-foreground'
          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      )}
    >
      ✓
    </span>
  )
}

// 静默 export 避免 tree-shaking 警告
export { Activity, BarChart3, Calendar, ChevronRight, Hourglass, Loader2 }
