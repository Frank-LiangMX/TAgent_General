/**
 * TASidebarMemory — 记忆 5 层概览
 *
 * 显示 5 层记忆（L0~L5）的统计数字，一眼看到记忆系统状态。
 */

import { Brain } from 'lucide-react'
import * as React from 'react'

interface MemoryLayerStats {
  l0: { exists: boolean; lines: number }
  l1: { exists: boolean; lines: number }
  l2: { exists: boolean; lines: number }
  l3: { rawCount: number; rulesCount: number }
  l4: { sessions: number }
  l5: { exists: boolean; lines: number }
}

export function TASidebarMemory(): React.ReactElement {
  const [stats, setStats] = React.useState<MemoryLayerStats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setIsLoading(true)
      try {
        const result = await window.electronAPI.getMemoryStats('ta')
        if (mounted) setStats(result as unknown as MemoryLayerStats)
      } catch (error) {
        console.error('[TASidebarMemory] 加载失败:', error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const layers: Array<{ key: string; label: string; value: string }> = [
    { key: 'l0', label: 'L0 · 原始', value: stats ? `${stats.l0.lines} 行` : '—' },
    { key: 'l1', label: 'L1 · 摘要', value: stats ? `${stats.l1.lines} 行` : '—' },
    { key: 'l2', label: 'L2 · 规则', value: stats ? `${stats.l2.lines} 行` : '—' },
    { key: 'l3', label: 'L3 · 索引', value: stats ? `${stats.l3.rawCount} 条` : '—' },
    { key: 'l4', label: 'L4 · 会话', value: stats ? `${stats.l4.sessions} 个` : '—' },
    { key: 'l5', label: 'L5 · 压缩', value: stats ? `${stats.l5.lines} 行` : '—' },
  ]

  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <Brain size={12} />
        5 层记忆（TA 模式）
      </div>

      {isLoading ? (
        <div className="text-[12px] text-muted-foreground/60 text-center py-4">加载中...</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {layers.map((l) => (
            <div
              key={l.key}
              className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5"
            >
              <div className="text-[10px] text-muted-foreground">{l.label}</div>
              <div className="text-sm font-semibold text-foreground mt-1">{l.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
