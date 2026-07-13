/**
 * TASidebarReview — 审核队列概览
 *
 * 顶部：4 个状态计数（pending / needs_review / approved / rejected）
 * 底部：最近 5 条待审核记录
 */

import { useSetAtom } from 'jotai'
import { ClipboardCheck } from 'lucide-react'
import * as React from 'react'

import { taActiveTabAtom } from '@/atoms/app-mode'
import { cn } from '@/lib/utils'

interface ReviewStats {
  pending: number
  needsReview: number
  approved: number
  rejected: number
}
interface ReviewItem {
  id: string
  name: string
  updated_at: number
  review_status: string
}

function getTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

export function TASidebarReview(): React.ReactElement {
  const setActiveTab = useSetAtom(taActiveTabAtom)
  const [stats, setStats] = React.useState<ReviewStats | null>(null)
  const [recent, setRecent] = React.useState<ReviewItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setIsLoading(true)
      try {
        const [statsResult, listResult] = await Promise.all([
          window.electronAPI.getReviewStats(),
          window.electronAPI.getReviewQueue({ status: 'pending', limit: 5 }),
        ])
        if (!mounted) return
        setStats(statsResult)
        setRecent(listResult.items as unknown as ReviewItem[])
      } catch (error) {
        console.error('[TASidebarReview] 加载失败:', error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* 4 状态计数卡 */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="待审" value={stats?.pending} loading={isLoading} color="amber" />
        <StatCard label="需复核" value={stats?.needsReview} loading={isLoading} color="blue" />
        <StatCard label="已通过" value={stats?.approved} loading={isLoading} color="emerald" />
        <StatCard label="已驳回" value={stats?.rejected} loading={isLoading} color="red" />
      </div>

      {/* 最近 5 条待审 */}
      <div>
        <div className="text-[11px] font-medium text-muted-foreground mb-1.5">最近待审</div>
        <div className="flex flex-col gap-0.5">
          {isLoading ? (
            <div className="text-[12px] text-muted-foreground/60 text-center py-3">加载中...</div>
          ) : recent.length === 0 ? (
            <div className="text-[12px] text-muted-foreground/60 text-center py-3">队列已清空</div>
          ) : (
            recent.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveTab('review')}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-left hover:bg-foreground/[0.04] transition-colors"
              >
                <ClipboardCheck size={12} className="flex-shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-foreground/85">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {getTimeAgo(r.updated_at)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  loading,
  color,
}: {
  label: string
  value: number | undefined
  loading: boolean
  color: 'amber' | 'blue' | 'emerald' | 'red'
}): React.ReactElement {
  const colorClass = {
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    red: 'text-red-500',
  }[color]
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={cn('text-xl font-semibold mt-1', colorClass)}>
        {loading ? '—' : (value ?? 0)}
      </div>
    </div>
  )
}
