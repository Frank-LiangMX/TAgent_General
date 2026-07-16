/**
 * MemoryMonitorPanel - 记忆系统主面板（v2 简洁高级版）
 *
 * 设计原则：
 * 1. 信息密度低，视觉干净
 * 2. 网格卡片布局，不堆叠
 * 3. 点击才展开详情（右侧抽屉）
 * 4. Glass 样式 + 大留白 + 精致色彩
 */

import * as React from 'react'

import { useAtomValue, useSetAtom } from 'jotai'
import {
  User,
  FolderTree,
  Lightbulb,
  AlertTriangle,
  History,
  Sparkles,
  Clock,
  RefreshCw,
  GitBranch,
  Layers,
} from 'lucide-react'

import { Button } from '@tagent/ui'
import { Panel } from '@/components/app-shell/Panel'
import { RailInspectorHeader } from '@/components/app-shell/RailInspectorHeader'
import { topLevelModeAtom } from '@/atoms/app-mode'
import {
  memorySelectedLayerAtom,
  memorySelectedSessionAtom,
  memoryViewModeAtom,
  type MemoryViewMode,
} from '@/atoms/memory-atoms'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { StageQueueCard } from './StageQueueCard'
import { MemoryGraph } from './MemoryGraph'

// ===== 类型 =====

interface MemoryLayerStats {
  l0: { exists: boolean; lines: number; lastUpdated: number | null }
  l1: { exists: boolean; lines: number; lastUpdated: number | null }
  l2: { exists: boolean; lines: number; lastUpdated: number | null }
  l3: { rawCount: number; rulesCount: number; lastUpdated: number | null }
  l4: { sessions: number; oldestDate: number | null; newestDate: number | null }
  l5: { exists: boolean; lines: number; lastUpdated: number | null }
}

interface LayerConfig {
  key: 'l0' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5'
  label: string
  sublabel: string
  icon: React.ReactNode
  color: string
  bgColor: string
  getCount: (stats: MemoryLayerStats) => number
}

// ===== 层配置 =====

const LAYERS: LayerConfig[] = [
  {
    key: 'l0',
    label: '用户画像',
    sublabel: 'L0',
    icon: <User size={18} />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/8',
    getCount: (s) => (s.l0.exists ? s.l0.lines : 0),
  },
  {
    key: 'l1',
    label: '项目画像',
    sublabel: 'L1',
    icon: <FolderTree size={18} />,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/8',
    getCount: (s) => (s.l1.exists ? s.l1.lines : 0),
  },
  {
    key: 'l2',
    label: '稳定事实',
    sublabel: 'L2',
    icon: <Lightbulb size={18} />,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/8',
    getCount: (s) => (s.l2.exists ? s.l2.lines : 0),
  },
  {
    key: 'l3',
    label: '纠错记录',
    sublabel: 'L3',
    icon: <AlertTriangle size={18} />,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/8',
    getCount: (s) => s.l3.rawCount,
  },
  {
    key: 'l4',
    label: '历史会话',
    sublabel: 'L4',
    icon: <History size={18} />,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/8',
    getCount: (s) => s.l4.sessions,
  },
  {
    key: 'l5',
    label: '提炼洞察',
    sublabel: 'L5',
    icon: <Sparkles size={18} />,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/8',
    getCount: (s) => (s.l5.exists ? s.l5.lines : 0),
  },
]

// ===== 工具函数 =====

function formatRelativeTime(ts: number | null): string {
  if (!ts) return '从未'
  const diff = Date.now() - ts
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}h 前`
  const days = Math.floor(hours / 24)
  return `${days}d 前`
}

// ===== 主组件 =====

export function MemoryMonitorPanel(): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const mode = topLevelMode === 'ta' ? 'ta' : 'general'
  const isMac = React.useMemo(() => detectIsMac(), [])

  const [stats, setStats] = React.useState<MemoryLayerStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<'layers' | 'graph'>('layers')

  // 用 atom 做左栏联动（左栏快捷入口控制主区视图）
  const atomViewMode = useAtomValue(memoryViewModeAtom)
  const effectiveViewMode = atomViewMode === 'pending' ? 'layers' : atomViewMode
  const setAtomViewMode = useSetAtom(memoryViewModeAtom)
  const [selectedLayer, setSelectedLayer] = React.useState<LayerConfig | null>(null)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await window.electronAPI.initMemoryLayers()
      const s = await window.electronAPI.getMemoryStats(mode)
      setStats(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [mode])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const headerClassName = cn(!isMac && 'pt-6')

  if (loading) {
    return (
      <Panel variant="grow" className="content-glass">
        <RailInspectorHeader
          crumbs={[{ label: '记忆' }]}
          title="记忆"
          className={headerClassName}
        />
        <div className="flex h-full items-center justify-center">
          <RefreshCw className="size-4 animate-spin text-muted-foreground" />
        </div>
      </Panel>
    )
  }

  if (error) {
    return (
      <Panel variant="grow" className="content-glass">
        <RailInspectorHeader
          crumbs={[{ label: '记忆' }]}
          title="记忆"
          className={headerClassName}
        />
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertTriangle size={20} />
          <span className="text-xs">{error}</span>
          <Button variant="outline" size="sm" onClick={loadData}>
            重试
          </Button>
        </div>
      </Panel>
    )
  }

  const totalMemories = stats ? LAYERS.reduce((sum, l) => sum + l.getCount(stats), 0) : 0

  return (
    <Panel variant="grow" className="content-glass">
      {/* 顶部 */}
      <RailInspectorHeader crumbs={[{ label: '记忆' }]} title="记忆" className={headerClassName} />

      {/* 概览栏 — Minimalism: 大留白 + 极简 */}
      <div className="flex items-center justify-between border-b border-border/15 px-6 py-4">
        <div className="flex items-center gap-4">
          {/* 总记忆数 */}
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-muted-foreground/60" />
            <span className="text-sm font-medium tabular-nums">{totalMemories}</span>
            <span className="text-[11px] text-muted-foreground/60">条记忆</span>
          </div>

          {/* L4 会话数 */}
          {stats && stats.l4.sessions > 0 && (
            <>
              <div className="h-3 w-px bg-border/30" />
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <GitBranch className="size-3" />
                <span className="tabular-nums">{stats.l4.sessions}</span>
                <span>会话</span>
              </div>
            </>
          )}

          {/* Reflect 状态 */}
          {stats && (
            <>
              <div className="h-3 w-px bg-border/30" />
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Clock className="size-3" />
                <span>Reflect {formatRelativeTime(stats.l5.lastUpdated)}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* 视图切换 */}
          <div className="flex rounded-md border border-border/30 bg-muted/10">
            <button
              className={cn(
                'px-2.5 py-1 text-[11px] transition-colors',
                effectiveViewMode === 'layers'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground/70 hover:text-foreground'
              )}
              onClick={() => {
                setViewMode('layers')
                setAtomViewMode('layers')
              }}
            >
              层
            </button>
            <button
              className={cn(
                'px-2.5 py-1 text-[11px] transition-colors',
                effectiveViewMode === 'graph'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground/70 hover:text-foreground'
              )}
              onClick={() => {
                setViewMode('graph')
                setAtomViewMode('graph')
              }}
            >
              图
            </button>
          </div>

          {/* 刷新 */}
          <Button
            variant="ghost"
            size="sm"
            className="size-7 rounded-full p-0"
            onClick={loadData}
            title="刷新"
          >
            <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 主区 */}
      {atomViewMode === 'pending' ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-5">
            <StageQueueCard mode={mode} onChanged={loadData} />
          </div>
        </div>
      ) : effectiveViewMode === 'graph' ? (
        <div className="flex-1 overflow-hidden">
          <MemoryGraph mode={mode} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Stage 队列（精简版） */}
          <div className="px-5 pt-4">
            <StageQueueCard mode={mode} onChanged={loadData} />
          </div>

          {/* 6 个层卡片网格 — Bento Grid: 结构化卡片 + 大圆角 */}
          <div className="grid grid-cols-2 gap-4 p-6">
            {LAYERS.map((layer) => {
              const count = stats ? layer.getCount(stats) : 0
              const isSelected = selectedLayer?.key === layer.key

              return (
                <button
                  key={layer.key}
                  type="button"
                  onClick={() => setSelectedLayer(isSelected ? null : layer)}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all',
                    // Soft UI Evolution：柔和阴影替代边框，微妙深度
                    'bg-gradient-to-br from-background/90 to-muted/5',
                    'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]',
                    'hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)]',
                    'dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.3)]',
                    'dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.2)]',
                    isSelected ? 'ring-1 ring-primary/20 shadow-[0_4px_12px_rgba(0,0,0,0.08)]' : ''
                  )}
                >
                  {/* 图标 */}
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg',
                      layer.bgColor,
                      layer.color
                    )}
                  >
                    {layer.icon}
                  </div>

                  {/* 信息 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground/90">
                        {layer.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">{layer.sublabel}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] tabular-nums text-muted-foreground/70">
                      {count > 0 ? (
                        <>
                          <span className="font-medium text-foreground/80">{count}</span>
                          <span className="ml-0.5">{layer.key === 'l4' ? '个会话' : '条'}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/40">空</span>
                      )}
                    </div>
                  </div>

                  {/* 最近更新 */}
                  {stats && (
                    <div className="shrink-0 text-[10px] text-muted-foreground/40">
                      {layer.key === 'l4'
                        ? stats.l4.newestDate
                          ? formatRelativeTime(stats.l4.newestDate)
                          : ''
                        : formatRelativeTime(
                            (stats[layer.key] as { lastUpdated: number | null }).lastUpdated
                          )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* 选中层的详情 — 克制 Glassmorphism */}
          {selectedLayer && stats && (
            <div className="mx-6 mb-6 rounded-2xl bg-gradient-to-br from-background/95 to-muted/5 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              <LayerDetail layer={selectedLayer} stats={stats} />
            </div>
          )}
        </div>
      )}

      {/* 底部 — Minimalism: 极简 */}
      <div className="shrink-0 border-t border-border/10 px-6 py-2 text-[10px] text-muted-foreground/30">
        TAgent 记忆系统
      </div>
    </Panel>
  )
}

// ===== 层详情组件 =====

function LayerDetail({
  layer,
  stats,
}: {
  layer: LayerConfig
  stats: MemoryLayerStats
}): React.ReactElement {
  const count = layer.getCount(stats)

  if (count === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground/40">
        {layer.icon}
        <span className="text-xs">暂无数据</span>
        <span className="text-[10px]">
          {layer.key === 'l0' && '用户偏好会在对话中自动学习'}
          {layer.key === 'l1' && '项目信息会在会话中自动识别'}
          {layer.key === 'l2' && '稳定事实会在对话中自动记录'}
          {layer.key === 'l3' && '纠错记录会在用户纠正时自动创建'}
          {layer.key === 'l4' && '会话日志会在每次对话后自动写入'}
          {layer.key === 'l5' && '洞察会在每日 03:00 由 Reflect 自动提炼'}
        </span>
      </div>
    )
  }

  // L4 详情：显示最近会话
  if (layer.key === 'l4') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground/60">共 {stats.l4.sessions} 个会话</span>
          {stats.l4.oldestDate && stats.l4.newestDate && (
            <span className="text-muted-foreground/40">
              {new Date(stats.l4.oldestDate).toLocaleDateString('zh-CN')} →{' '}
              {new Date(stats.l4.newestDate).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground/40">
          SQLite + FTS5 全文搜索 · 会话自动合并 · {'>'}30 天自动归档
        </div>
      </div>
    )
  }

  // 其他层详情
  const layerInfo = stats[layer.key] as {
    exists: boolean
    lines: number
    lastUpdated: number | null
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground/60">{layerInfo.lines} 条记录</span>
        <span className="text-muted-foreground/40">
          更新 {formatRelativeTime(layerInfo.lastUpdated)}
        </span>
      </div>
      {layer.key === 'l3' && (
        <div className="text-[10px] text-muted-foreground/40">
          {(stats as MemoryLayerStats).l3.rulesCount} 条规则
        </div>
      )}
    </div>
  )
}
