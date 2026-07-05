/**
 * MemoryRailContent - 记忆页左栏（层级导航 + Reflect 状态 + 最近会话）
 *
 * 与 KanbanRailContent 风格对齐：玻璃浮岛列表 + 紧凑信息密度。
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import { topLevelModeAtom } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

interface RailSessionItem {
  id: number
  session_slug: string
  title: string
  summary: string
  created_at: number
}

interface RailLayerItem {
  key: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  label: string
  description: string
}

const LAYER_ITEMS: RailLayerItem[] = [
  { key: 'L0', label: '用户画像', description: '身份 / 环境 / 偏好' },
  { key: 'L1', label: '项目画像', description: '规范 / 模板' },
  { key: 'L2', label: '稳定事实', description: '长期记忆' },
  { key: 'L3', label: '纠错记录', description: '纠正 + 规则' },
  { key: 'L4', label: '历史会话', description: 'SQLite + FTS5' },
  { key: 'L5', label: '提炼洞察', description: 'Reflect 每日提炼' },
]

function formatRelativeTime(ts: number | null): string {
  if (!ts) return '从未运行'
  const diff = Date.now() - ts
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

export function MemoryRailContent(): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const mode = topLevelMode === 'ta' ? 'ta' : 'general'

  const [stats, setStats] = React.useState<{
    total: number
    l4Sessions: number
    l5Lines: number
  } | null>(null)
  const [recentSessions, setRecentSessions] = React.useState<RailSessionItem[]>([])
  const [reflectLastRun, setReflectLastRun] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      await window.electronAPI.initMemoryLayers()
      const [s, recent] = await Promise.all([
        window.electronAPI.getMemoryStats(mode),
        window.electronAPI.listRecentMemorySessions(mode, 8),
      ])
      setStats({
        total:
          (s.l0.exists ? s.l0.lines : 0) +
          (s.l1.exists ? s.l1.lines : 0) +
          (s.l2.exists ? s.l2.lines : 0) +
          s.l3.rawCount +
          s.l4.sessions +
          (s.l5.exists ? s.l5.lines : 0),
        l4Sessions: s.l4.sessions,
        l5Lines: s.l5.exists ? s.l5.lines : 0,
      })
      setRecentSessions(recent as RailSessionItem[])
    } catch {
      // 静默失败，主区会显示完整错误
    } finally {
      setLoading(false)
    }
  }, [mode])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Reflect 下次运行时间：明天 03:00
  const nextReflect = React.useMemo(() => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(3, 0, 0, 0)
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3">
      {/* Reflect 状态卡 */}
      <div className="rounded-md border border-border/40 bg-muted/20 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground/80">Reflect 状态</span>
          <span className="text-[10px] text-muted-foreground/70">
            {reflectLastRun ? `上次 ${formatRelativeTime(reflectLastRun)}` : '从未运行'}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground/80">
          下次运行 {nextReflect.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        {stats && (
          <div className="mt-2 flex items-center gap-3 text-[10px] tabular-nums">
            <span className="text-muted-foreground/70">L4 {stats.l4Sessions}</span>
            <span className="text-muted-foreground/70">L5 {stats.l5Lines}</span>
            <span className="text-muted-foreground/70">总计 {stats.total}</span>
          </div>
        )}
      </div>

      {/* L0-L5 层级导航 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          层级
        </div>
        <div className="space-y-0.5">
          {LAYER_ITEMS.map((layer) => (
            <button
              key={layer.key}
              type="button"
              className="session-list-item-active group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
                {layer.key}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-foreground/90">{layer.label}</div>
                <div className="truncate text-[10px] text-muted-foreground/70">{layer.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* 最近会话 */}
        <div className="mb-1.5 mt-4 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          最近会话
        </div>
        {loading ? (
          <div className="px-2 py-3 text-[11px] text-muted-foreground/60">加载中…</div>
        ) : recentSessions.length === 0 ? (
          <div className="px-2 py-3 text-[11px] text-muted-foreground/60">暂无会话记录</div>
        ) : (
          <div className="space-y-0.5">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="group flex flex-col gap-0.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
              >
                <div className="truncate text-[11px] text-foreground/90">
                  {s.title || '（无标题）'}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                  <span className="tabular-nums">
                    {new Date(s.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {s.summary && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="truncate">{s.summary.slice(0, 40)}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="shrink-0 border-t border-border/40 pt-2 text-[10px] text-muted-foreground/60">
        记忆由 TAgent 自动维护
      </div>
    </div>
  )
}
