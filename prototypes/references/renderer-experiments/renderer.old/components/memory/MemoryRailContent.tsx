/**
 * MemoryRailContent - 记忆页左栏（v2 快捷入口 + 最近活动）
 *
 * 设计：
 * 1. 顶部 3 个快捷入口（待审批/最近记忆/Graph）
 * 2. 下方最近活动时间线（按日期分组：今天/昨天/本周/更早）
 *
 * 信息密度低，视觉干净，不堆叠。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { Bell, Clock, GitBranch, Layers } from 'lucide-react'
import * as React from 'react'

import { topLevelModeAtom } from '@/atoms/app-mode'
import {
  memorySelectedSessionAtom,
  memoryViewModeAtom,
  type MemoryViewMode,
} from '@/atoms/memory-atoms'
import { cn } from '@/lib/utils'

// ===== 类型 =====

interface RailSessionItem {
  id: number
  session_slug: string
  title: string
  summary: string
  created_at: number
}

/** 日期分组 */
interface DayGroup {
  label: string
  sessions: RailSessionItem[]
}

// ===== 工具函数 =====

function getDateGroup(ts: number): 'today' | 'yesterday' | 'thisWeek' | 'earlier' {
  const now = new Date()
  const date = new Date(ts)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000

  if (ts >= startOfToday) return 'today'
  if (ts >= startOfYesterday) return 'yesterday'
  if (ts >= startOfWeek) return 'thisWeek'
  return 'earlier'
}

function groupSessionsByDate(sessions: RailSessionItem[]): DayGroup[] {
  const groups: Record<string, RailSessionItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }

  for (const s of sessions) {
    const key = getDateGroup(s.created_at)
    const arr = groups[key]
    if (arr) arr.push(s)
  }

  const result: DayGroup[] = []
  const today = groups.today ?? []
  const yesterday = groups.yesterday ?? []
  const thisWeek = groups.thisWeek ?? []
  const earlier = groups.earlier ?? []
  if (today.length > 0) result.push({ label: '今天', sessions: today })
  if (yesterday.length > 0) result.push({ label: '昨天', sessions: yesterday })
  if (thisWeek.length > 0) result.push({ label: '本周', sessions: thisWeek })
  if (earlier.length > 0) result.push({ label: '更早', sessions: earlier })
  return result
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

// ===== 快捷入口配置 =====

interface QuickEntry {
  key: string
  label: string
  icon: React.ReactNode
  color: string
  badge?: number
  active?: boolean
  onClick: () => void
}

// ===== 主组件 =====

export function MemoryRailContent(): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const mode = topLevelMode === 'ta' ? 'ta' : 'general'
  const selectedSessionId = useAtomValue(memorySelectedSessionAtom)
  const setSelectedSessionId = useSetAtom(memorySelectedSessionAtom)
  const viewMode = useAtomValue(memoryViewModeAtom)
  const setViewMode = useSetAtom(memoryViewModeAtom)

  const [sessions, setSessions] = React.useState<RailSessionItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [pendingCount, setPendingCount] = React.useState(0)

  // 加载数据
  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        await window.electronAPI.initMemoryLayers()
        const [recent, pending] = await Promise.all([
          window.electronAPI.listRecentMemorySessions(mode, 30),
          window.electronAPI.getStageQueue(mode).catch(() => []),
        ])
        if (!cancelled) {
          setSessions(recent as RailSessionItem[])
          setPendingCount(pending.length)
        }
      } catch {
        // 静默失败
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [mode])

  const handleSessionClick = React.useCallback(
    (sessionId: number) => {
      setSelectedSessionId(selectedSessionId === sessionId ? null : sessionId)
    },
    [selectedSessionId, setSelectedSessionId]
  )

  const dayGroups = React.useMemo(() => groupSessionsByDate(sessions), [sessions])

  // 快捷入口
  const quickEntries: QuickEntry[] = [
    {
      key: 'pending',
      label: '待审批',
      icon: <Bell className="size-3.5" />,
      color: 'text-amber-500',
      badge: pendingCount,
      active: viewMode === 'pending',
      onClick: () => setViewMode('pending'),
    },
    {
      key: 'recent',
      label: '层',
      icon: <Layers className="size-3.5" />,
      color: 'text-muted-foreground/70',
      active: viewMode === 'layers',
      onClick: () => setViewMode('layers'),
    },
    {
      key: 'graph',
      label: '图',
      icon: <GitBranch className="size-3.5" />,
      color: 'text-violet-500',
      active: viewMode === 'graph',
      onClick: () => setViewMode('graph'),
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* 快捷入口 — Minimalism: 大留白 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/15 px-3 py-3">
        {quickEntries.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={entry.onClick}
            className={cn(
              'relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors',
              entry.active
                ? 'bg-primary/10 text-foreground font-medium'
                : 'text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground'
            )}
          >
            <span className={entry.color}>{entry.icon}</span>
            <span>{entry.label}</span>
            {entry.badge !== undefined && entry.badge > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-amber-500/15 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                {entry.badge > 9 ? '9+' : entry.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 最近活动 */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground/40">
            加载中…
          </div>
        ) : dayGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/40">
            <Layers className="size-5" />
            <span className="text-[11px]">暂无活动记录</span>
          </div>
        ) : (
          <div className="px-2 py-2">
            {dayGroups.map((group) => (
              <div key={group.label} className="mb-3">
                {/* 日期标题 */}
                <div className="mb-1.5 flex items-center gap-2 px-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-border/20" />
                  <span className="text-[9px] tabular-nums text-muted-foreground/30">
                    {group.sessions.length}
                  </span>
                </div>

                {/* 会话列表 */}
                <div className="space-y-0.5">
                  {group.sessions.map((s) => {
                    const isActive = selectedSessionId === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSessionClick(s.id)}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-all',
                          isActive
                            ? 'bg-primary/5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
                            : 'hover:bg-muted/15'
                        )}
                      >
                        {/* 时间 */}
                        <span className="shrink-0 pt-px text-[10px] tabular-nums text-muted-foreground/40 w-10">
                          {group.label === '今天' || group.label === '昨天'
                            ? formatTime(s.created_at)
                            : formatDate(s.created_at)}
                        </span>

                        {/* 内容 */}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] text-foreground/80">
                            {s.title || '（无标题）'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部 */}
      <div className="shrink-0 border-t border-border/20 px-3 py-1.5 text-[9px] text-muted-foreground/30">
        {sessions.length} 个会话
      </div>
    </div>
  )
}
