/**
 * TASidebarAssets — 资产库概览
 *
 * 顶部：2 张计数卡（资产总数 / 待审核数）
 * 底部：最近 5 个资产列表
 */

import { useSetAtom } from 'jotai'
import { Database, ChevronRight } from 'lucide-react'
import * as React from 'react'

import { taActiveTabAtom } from '@/atoms/app-mode'
import { Button } from '@/components/ui/button'

interface AssetRecord {
  id: string
  name: string
  type: string
  path: string
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

export function TASidebarAssets(): React.ReactElement {
  const setActiveTab = useSetAtom(taActiveTabAtom)
  const [stats, setStats] = React.useState<{ total: number; pending: number } | null>(null)
  const [recent, setRecent] = React.useState<AssetRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setIsLoading(true)
      try {
        const [statsResult, listResult, reviewStats] = await Promise.all([
          window.electronAPI.getAssetStoreStats(),
          window.electronAPI.listAssets({ limit: 5, orderBy: 'updated_at', orderDir: 'DESC' }),
          window.electronAPI.getReviewStats(),
        ])
        if (!mounted) return
        setStats({ total: statsResult.totalAssets, pending: reviewStats.pending + reviewStats.needsReview })
        setRecent((listResult.assets as unknown as AssetRecord[]) ?? [])
      } catch (error) {
        console.error('[TASidebarAssets] 加载失败:', error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* 计数卡 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">资产</div>
          <div className="text-xl font-semibold text-foreground mt-1">
            {isLoading ? '—' : (stats?.total ?? 0)}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">待审</div>
          <div className="text-xl font-semibold text-amber-500 mt-1">
            {isLoading ? '—' : (stats?.pending ?? 0)}
          </div>
        </div>
      </div>

      {/* 最近 5 个资产 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[11px] font-medium text-muted-foreground">最近资产</div>
          <button
            type="button"
            onClick={() => setActiveTab('assets')}
            className="text-[11px] text-primary/70 hover:text-primary transition-colors flex items-center gap-0.5"
          >
            全部 <ChevronRight size={10} />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {isLoading ? (
            <div className="text-[12px] text-muted-foreground/60 text-center py-3">加载中...</div>
          ) : recent.length === 0 ? (
            <div className="text-[12px] text-muted-foreground/60 text-center py-3">
              暂无资产
            </div>
          ) : (
            recent.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveTab('assets')}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-left hover:bg-foreground/[0.04] transition-colors"
              >
                <Database size={12} className="flex-shrink-0 text-foreground/40" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-foreground/85">{a.name}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {getTimeAgo(a.updated_at)}
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
