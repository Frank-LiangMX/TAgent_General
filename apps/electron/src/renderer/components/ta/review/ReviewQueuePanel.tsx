/**
 * ReviewQueuePanel - 审核队列面板
 *
 * 显示待审核资产列表、审核状态、操作按钮。
 * 数据来源：AssetStoreService（SQLite 只读）
 */

import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock size={16} />, color: 'text-amber-500', label: '待审核' },
  needs_review: { icon: <AlertCircle size={16} />, color: 'text-blue-500', label: '需复核' },
  approved: { icon: <CheckCircle size={16} />, color: 'text-emerald-500', label: '已通过' },
  rejected: { icon: <XCircle size={16} />, color: 'text-red-500', label: '已拒绝' },
}

interface ReviewItem {
  id: string
  name: string
  type: string
  path: string
  review_status: string
  review_notes?: string
  updated_at: number
  reviewHistory?: Array<{
    id: number
    action: string
    reviewer?: string
    notes?: string
    created_at: number
  }>
}

export function ReviewQueuePanel(): React.ReactElement {
  const [items, setItems] = React.useState<ReviewItem[]>([])
  const [stats, setStats] = React.useState({ pending: 0, needsReview: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // 加载审核队列数据
  const loadData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [queueResult, statsResult] = await Promise.all([
        window.electronAPI.getReviewQueue({ limit: 100 }),
        window.electronAPI.getReviewStats(),
      ])
      setItems(queueResult.items as ReviewItem[])
      setStats(statsResult)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

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
        <AlertCircle size={24} />
        <span className="text-sm">加载失败: {error}</span>
        <Button variant="outline" size="sm" onClick={loadData}>
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部统计 */}
      <div className="flex items-center gap-4 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-500" />
          <span className="text-sm">待审核: {stats.pending}</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-blue-500" />
          <span className="text-sm">需复核: {stats.needsReview}</span>
        </div>
      </div>

      {/* 审核列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">暂无待审核资产</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ReviewCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface ReviewCardProps {
  item: ReviewItem
}

function ReviewCard({ item }: ReviewCardProps): React.ReactElement {
  const statusConfig = STATUS_CONFIG[item.review_status] ?? STATUS_CONFIG.pending!

  // 获取最近的审核记录
  const lastReview = item.reviewHistory?.[0]

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
      {/* 状态图标 */}
      <div
        className={cn(
          'size-8 rounded-full flex items-center justify-center bg-muted',
          statusConfig.color
        )}
      >
        {statusConfig.icon}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{item.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{statusConfig.label}</span>
          {lastReview?.reviewer && <span>· {lastReview.reviewer}</span>}
          {item.review_notes && <span className="text-red-500">· {item.review_notes}</span>}
        </div>
      </div>

      {/* 操作按钮 */}
      {item.review_status === 'pending' && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
            开始审核
          </Button>
        </div>
      )}
    </div>
  )
}
