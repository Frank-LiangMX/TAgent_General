/**
 * MemoryMonitorPanel - 记忆层监控面板
 *
 * 可视化 5 层记忆状态：
 * - L0 用户画像
 * - L1 项目画像
 * - L2 稳定事实
 * - L3 纠错记录
 * - L4 历史会话
 * - L5 提炼洞察
 */

import { useAtomValue } from 'jotai'
import { User, FolderTree, Lightbulb, AlertTriangle, History, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import * as React from 'react'

import { topLevelModeAtom } from '@/atoms/app-mode'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MemoryLayerStats {
  l0: { exists: boolean; lines: number; lastUpdated: number | null }
  l1: { exists: boolean; lines: number; lastUpdated: number | null }
  l2: { exists: boolean; lines: number; lastUpdated: number | null }
  l3: { rawCount: number; rulesCount: number; lastUpdated: number | null }
  l4: { sessions: number; oldestDate: number | null; newestDate: number | null }
  l5: { exists: boolean; lines: number; lastUpdated: number | null }
}

interface LayerConfig {
  key: keyof MemoryLayerStats
  label: string
  description: string
  icon: React.ReactNode
  color: string
  format: (stats: MemoryLayerStats[keyof MemoryLayerStats]) => string
}

const LAYERS: LayerConfig[] = [
  {
    key: 'l0',
    label: 'L0 用户画像',
    description: '身份、环境、偏好',
    icon: <User size={18} />,
    color: 'text-blue-500',
    format: (s) => `${(s as { lines: number }).lines} 条`,
  },
  {
    key: 'l1',
    label: 'L1 项目画像',
    description: '项目规范、模板',
    icon: <FolderTree size={18} />,
    color: 'text-emerald-500',
    format: (s) => `${(s as { lines: number }).lines} 条`,
  },
  {
    key: 'l2',
    label: 'L2 稳定事实',
    description: '长期记忆的事实',
    icon: <Lightbulb size={18} />,
    color: 'text-amber-500',
    format: (s) => `${(s as { lines: number }).lines} 条`,
  },
  {
    key: 'l3',
    label: 'L3 纠错记录',
    description: '用户纠正 + 规则',
    icon: <AlertTriangle size={18} />,
    color: 'text-red-500',
    format: (s) => `${(s as { rawCount: number; rulesCount: number }).rawCount} 条 / ${(s as { rawCount: number; rulesCount: number }).rulesCount} 规则`,
  },
  {
    key: 'l4',
    label: 'L4 历史会话',
    description: 'SQLite + FTS5 全文搜索',
    icon: <History size={18} />,
    color: 'text-purple-500',
    format: (s) => `${(s as { sessions: number }).sessions} 个会话`,
  },
  {
    key: 'l5',
    label: 'L5 提炼洞察',
    description: '每日 Reflect 提炼',
    icon: <Sparkles size={18} />,
    color: 'text-cyan-500',
    format: (s) => `${(s as { lines: number }).lines} 条`,
  },
]

export function MemoryMonitorPanel(): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const mode = topLevelMode === 'ta' ? 'ta' : 'general'

  const [stats, setStats] = React.useState<MemoryLayerStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 先初始化服务
      await window.electronAPI.initMemoryLayers()
      const result = await window.electronAPI.getMemoryStats(mode)
      setStats(result)
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertTriangle size={24} />
        <span className="text-sm">加载失败: {error}</span>
        <Button variant="outline" size="sm" onClick={loadData}>
          重试
        </Button>
      </div>
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

  return (
    <div className="h-full flex flex-col">
      {/* 顶部统计 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="text-sm font-medium">
          {mode === 'general' ? '通用模式' : 'TA 模式'}记忆
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">共 {totalLines} 条</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={loadData}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* 层列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {LAYERS.map((layer) => {
            const layerStats = stats?.[layer.key]
            const exists = layer.key === 'l3' || layer.key === 'l4'
              ? true
              : (layerStats as { exists: boolean })?.exists

            return (
              <LayerCard
                key={layer.key}
                layer={layer}
                stats={layerStats}
                exists={exists}
                mode={mode}
              />
            )
          })}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        记忆由 ta_agent MCP Server 维护，TAgent 端只读
      </div>
    </div>
  )
}

interface LayerCardProps {
  layer: LayerConfig
  stats: MemoryLayerStats[keyof MemoryLayerStats] | undefined
  exists: boolean
  mode: 'general' | 'ta'
}

function LayerCard({ layer, stats, exists }: LayerCardProps): React.ReactElement {
  const isEmpty = !exists || (layer.key !== 'l3' && layer.key !== 'l4' && !(stats as { exists: boolean })?.exists)

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border border-border',
      isEmpty && 'opacity-50'
    )}>
      {/* 图标 */}
      <div className={cn('size-10 rounded-full flex items-center justify-center bg-muted', layer.color)}>
        {layer.icon}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{layer.label}</div>
        <div className="text-xs text-muted-foreground">{layer.description}</div>
      </div>

      {/* 统计 */}
      <div className="text-right">
        <div className="text-sm font-medium">
          {stats ? layer.format(stats) : '-'}
        </div>
        {isEmpty && (
          <div className="text-xs text-muted-foreground">未初始化</div>
        )}
      </div>
    </div>
  )
}
