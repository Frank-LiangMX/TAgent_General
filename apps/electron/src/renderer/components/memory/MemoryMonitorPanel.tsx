/**
 * MemoryMonitorPanel - 记忆层监控主面板
 *
 * 视觉风格对齐 KanbanMainView：
 * - Panel + content-glass 玻璃底
 * - RailInspectorHeader 面包屑顶栏（Mac/Windows 拖拽避让）
 * - 工具栏：总计 + Reflect 状态 + 模式徽章 + 刷新
 * - 主区：6 层时间线卡片，展开显示该层实际内容预览
 * - 底部状态栏
 */

import { useAtomValue } from 'jotai'
import {
  User,
  FolderTree,
  Lightbulb,
  AlertTriangle,
  History,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  Clock,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@tagent/ui'
import { Panel } from '@/components/app-shell/Panel'
import { RailInspectorHeader } from '@/components/app-shell/RailInspectorHeader'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

interface MemoryLayerStats {
  l0: { exists: boolean; lines: number; lastUpdated: number | null }
  l1: { exists: boolean; lines: number; lastUpdated: number | null }
  l2: { exists: boolean; lines: number; lastUpdated: number | null }
  l3: { rawCount: number; rulesCount: number; lastUpdated: number | null }
  l4: { sessions: number; oldestDate: number | null; newestDate: number | null }
  l5: { exists: boolean; lines: number; lastUpdated: number | null }
}

interface SessionPreview {
  id: number
  title: string
  summary: string
  created_at: number
}

interface LayerConfig {
  key: 'l0' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5'
  label: string
  description: string
  icon: React.ReactNode
  color: string
  accent: string
  format: (stats: MemoryLayerStats) => string
}

const LAYERS: LayerConfig[] = [
  {
    key: 'l0',
    label: 'L0 用户画像',
    description: '身份、环境、偏好',
    icon: <User size={16} />,
    color: 'text-blue-500',
    accent: 'bg-blue-500/10',
    format: (s) => `${s.l0.exists ? s.l0.lines : 0} 条`,
  },
  {
    key: 'l1',
    label: 'L1 项目画像',
    description: '项目规范、模板',
    icon: <FolderTree size={16} />,
    color: 'text-emerald-500',
    accent: 'bg-emerald-500/10',
    format: (s) => `${s.l1.exists ? s.l1.lines : 0} 条`,
  },
  {
    key: 'l2',
    label: 'L2 稳定事实',
    description: '长期记忆的事实',
    icon: <Lightbulb size={16} />,
    color: 'text-amber-500',
    accent: 'bg-amber-500/10',
    format: (s) => `${s.l2.exists ? s.l2.lines : 0} 条`,
  },
  {
    key: 'l3',
    label: 'L3 纠错记录',
    description: '用户纠正 + 规则',
    icon: <AlertTriangle size={16} />,
    color: 'text-red-500',
    accent: 'bg-red-500/10',
    format: (s) => `${s.l3.rawCount} 条 / ${s.l3.rulesCount} 规则`,
  },
  {
    key: 'l4',
    label: 'L4 历史会话',
    description: 'SQLite + FTS5 全文搜索',
    icon: <History size={16} />,
    color: 'text-purple-500',
    accent: 'bg-purple-500/10',
    format: (s) => `${s.l4.sessions} 个会话`,
  },
  {
    key: 'l5',
    label: 'L5 提炼洞察',
    description: '每日 Reflect 提炼',
    icon: <Sparkles size={16} />,
    color: 'text-cyan-500',
    accent: 'bg-cyan-500/10',
    format: (s) => `${s.l5.exists ? s.l5.lines : 0} 条`,
  },
]

function formatRelativeTime(ts: number | null): string {
  if (!ts) return '从未'
  const diff = Date.now() - ts
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}h 前`
  const days = Math.floor(hours / 24)
  return `${days}d 前`
}

function formatDate(ts: number | null): string {
  if (!ts) return '无'
  return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function MemoryMonitorPanel(): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const mode = topLevelMode === 'ta' ? 'ta' : 'general'
  const isMac = React.useMemo(() => detectIsMac(), [])

  const [stats, setStats] = React.useState<MemoryLayerStats | null>(null)
  const [recentSessions, setRecentSessions] = React.useState<SessionPreview[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [expandedLayer, setExpandedLayer] = React.useState<LayerConfig['key'] | null>('l4')

  const loadData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await window.electronAPI.initMemoryLayers()
      const [s, recent] = await Promise.all([
        window.electronAPI.getMemoryStats(mode),
        window.electronAPI.listRecentMemorySessions(mode, 6),
      ])
      setStats(s)
      setRecentSessions(recent as SessionPreview[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [mode])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Reflect 下次运行：明天 03:00
  const nextReflect = React.useMemo(() => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(3, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next
  }, [])

  if (loading && !stats) {
    return (
      <Panel variant="grow" className="content-glass">
        <div className="flex h-full items-center justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      </Panel>
    )
  }

  if (error) {
    return (
      <Panel variant="grow" className="content-glass">
        <RailInspectorHeader
          crumbs={[{ label: '记忆' }, { label: mode === 'ta' ? 'TA 模式' : '通用模式' }]}
          title="记忆系统"
          description="L0-L5 五层记忆体系监控"
        />
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertTriangle size={24} />
          <span className="text-sm">加载失败: {error}</span>
          <Button variant="outline" size="sm" onClick={loadData}>
            重试
          </Button>
        </div>
      </Panel>
    )
  }

  const totalLines = stats
    ? (stats.l0.exists ? stats.l0.lines : 0) +
      (stats.l1.exists ? stats.l1.lines : 0) +
      (stats.l2.exists ? stats.l2.lines : 0) +
      stats.l3.rawCount +
      stats.l4.sessions +
      (stats.l5.exists ? stats.l5.lines : 0)
    : 0

  const headerClassName = cn(!isMac && 'pt-6')

  return (
    <Panel variant="grow" className="content-glass">
      <RailInspectorHeader
        crumbs={[{ label: '记忆' }, { label: mode === 'ta' ? 'TA 模式' : '通用模式' }]}
        title="记忆系统"
        description="L0-L5 五层记忆体系：用户画像 / 项目画像 / 稳定事实 / 纠错记录 / 历史会话 / 提炼洞察"
        className={headerClassName}
      />

      {/* 工具栏 */}
      <div className="flex items-center gap-2 border-b border-border/40 px-5 py-2">
        {/* 总计 */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
          <span>共 {totalLines} 条</span>
        </div>

        <div className="h-3 w-px bg-border/40" />

        {/* Reflect 状态 */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          <span>
            Reflect 下次运行 {nextReflect.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* 模式徽章 */}
          <span className="rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {mode === 'ta' ? 'TA 模式' : '通用模式'}
          </span>
          {/* 刷新 */}
          <Button
            variant="ghost"
            size="sm"
            className="size-[28px] rounded-full p-0"
            onClick={loadData}
            title="刷新"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 主区：层时间线 */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="space-y-2">
          {LAYERS.map((layer, index) => {
            const isExpanded = expandedLayer === layer.key
            const isEmpty =
              stats &&
              (layer.key === 'l3'
                ? stats.l3.rawCount === 0 && stats.l3.rulesCount === 0
                : layer.key === 'l4'
                  ? stats.l4.sessions === 0
                  : !stats[layer.key].exists)

            return (
              <LayerRow
                key={layer.key}
                layer={layer}
                stats={stats}
                recentSessions={layer.key === 'l4' ? recentSessions : []}
                isEmpty={!!isEmpty}
                isExpanded={isExpanded}
                onToggle={() => setExpandedLayer(isExpanded ? null : layer.key)}
                showConnector={index < LAYERS.length - 1}
              />
            )
          })}
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="shrink-0 border-t border-border/40 px-5 py-2 text-[10px] text-muted-foreground/70">
        记忆由 TAgent 自动维护 · L4 会话日志自动写入 · Reflect 每日 03:00 提炼 L5 洞察
      </div>
    </Panel>
  )
}

interface LayerRowProps {
  layer: LayerConfig
  stats: MemoryLayerStats | null
  recentSessions: SessionPreview[]
  isEmpty: boolean
  isExpanded: boolean
  onToggle: () => void
  showConnector: boolean
}

function LayerRow({
  layer,
  stats,
  recentSessions,
  isEmpty,
  isExpanded,
  onToggle,
  showConnector,
}: LayerRowProps): React.ReactElement {
  const lastUpdated =
    stats && layer.key !== 'l4'
      ? (stats[layer.key] as { lastUpdated: number | null }).lastUpdated
      : layer.key === 'l4'
        ? stats?.l4.newestDate ?? null
        : null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'group flex w-full items-center gap-3 rounded-md border border-border/40 bg-muted/10 px-3 py-2.5 transition-colors',
          'hover:bg-muted/30 hover:border-border/60',
          isExpanded && 'bg-muted/30 border-border/60'
        )}
      >
        {/* 图标 */}
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            layer.accent,
            layer.color
          )}
        >
          {layer.icon}
        </div>

        {/* 信息 */}
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground/90">{layer.label}</span>
            {isEmpty && (
              <span className="rounded border border-border/40 px-1 py-0 text-[9px] text-muted-foreground/70">
                空
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground/80">{layer.description}</div>
        </div>

        {/* 统计 */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="text-[12px] font-medium tabular-nums text-foreground/90">
              {stats ? layer.format(stats) : '-'}
            </div>
            <div className="text-[10px] text-muted-foreground/60">
              {layer.key === 'l4' && stats
                ? `${formatDate(stats.l4.oldestDate)} → ${formatDate(stats.l4.newestDate)}`
                : `更新 ${formatRelativeTime(lastUpdated)}`}
            </div>
          </div>
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground/60 transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="ml-3 mt-1 border-l border-border/30 pl-3">
          <LayerDetail layer={layer} stats={stats} recentSessions={recentSessions} />
        </div>
      )}

      {/* 时间线连接器 */}
      {showConnector && (
        <div className="pointer-events-none absolute left-[27px] top-full h-2 w-px bg-border/30" aria-hidden />
      )}
    </div>
  )
}

interface LayerDetailProps {
  layer: LayerConfig
  stats: MemoryLayerStats | null
  recentSessions: SessionPreview[]
}

function LayerDetail({ layer, stats, recentSessions }: LayerDetailProps): React.ReactElement {
  if (layer.key === 'l4') {
    if (recentSessions.length === 0) {
      return <div className="py-2 text-[11px] text-muted-foreground/60">暂无会话记录</div>
    }
    return (
      <div className="py-2">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          最近会话
        </div>
        <div className="space-y-1">
          {recentSessions.map((s) => (
            <div
              key={s.id}
              className="rounded-md border border-border/30 bg-background/40 px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-foreground/90">
                  {s.title || '（无标题）'}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                  {new Date(s.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {s.summary && (
                <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground/80">
                  {s.summary}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // L0-L3 / L5: 简单状态展示
  const layerStats = stats ? stats[layer.key] : null
  const exists =
    layerStats && 'exists' in layerStats
      ? (layerStats as { exists: boolean }).exists
      : layer.key === 'l3'
        ? (layerStats as { rawCount: number })?.rawCount > 0
        : false

  if (!exists) {
    return (
      <div className="py-2 text-[11px] text-muted-foreground/60">
        该层尚未初始化 — 由 Agent 在使用过程中自动写入
      </div>
    )
  }

  return (
    <div className="py-2 text-[11px] text-muted-foreground/80">
      {layer.key === 'l3' && layerStats ? (
        <div className="space-y-1">
          <div>原始纠错记录: {(layerStats as { rawCount: number }).rawCount} 条</div>
          <div>提炼规则: {(layerStats as { rulesCount: number }).rulesCount} 条</div>
        </div>
      ) : (
        <div>
          共 {(layerStats as { lines: number }).lines} 条记录 · 更新于 {formatRelativeTime((layerStats as { lastUpdated: number | null }).lastUpdated)}
        </div>
      )}
    </div>
  )
}
