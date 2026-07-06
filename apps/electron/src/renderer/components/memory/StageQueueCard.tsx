/**
 * StageQueueCard - 待审批记忆卡片（P2.2 写入门控三态）
 *
 * 展示 pending_approval.jsonl 队列，支持单条/批量 accept/reject。
 * 借鉴 Hermes 写入门控三态（allow/blocked/stage）。
 *
 * 详见 docs/plans/2026-07-06-silent-memory-research/TAgent_Memory_Master_Design.md §3.3
 */

import * as React from 'react'

import { Button } from '@tagent/ui'
import { Check, X, Loader2 } from 'lucide-react'

import type { StageEntry } from '@tagent/shared'

interface StageQueueCardProps {
  mode: 'general' | 'ta'
  onChanged: () => void
}

export function StageQueueCard({ mode, onChanged }: StageQueueCardProps): React.ReactElement | null {
  const [entries, setEntries] = React.useState<StageEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [acting, setActing] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.electronAPI.getStageQueue(mode)
      setEntries(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [mode])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleAcceptOne = async (id: string): Promise<void> => {
    setActing(`accept-${id}`)
    try {
      await window.electronAPI.acceptStageOne(mode, id)
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActing(null)
    }
  }

  const handleRejectOne = async (id: string): Promise<void> => {
    setActing(`reject-${id}`)
    try {
      await window.electronAPI.rejectStageOne(mode, id)
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActing(null)
    }
  }

  const handleAcceptAll = async (): Promise<void> => {
    setActing('accept-all')
    try {
      await window.electronAPI.acceptStageAll(mode)
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActing(null)
    }
  }

  const handleRejectAll = async (): Promise<void> => {
    setActing('reject-all')
    try {
      await window.electronAPI.rejectStageAll(mode)
      await load()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div className="session-list-row flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        加载待审批记忆...
      </div>
    )
  }

  if (entries.length === 0 && !error) {
    // 空状态不渲染（避免记忆页面出现空卡片）
    return null
  }

  return (
    <div className="session-list-row p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">待审批记忆</h3>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500 dark:text-amber-400">
            {entries.length}
          </span>
        </div>
        {entries.length > 1 && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAcceptAll}
              disabled={acting !== null}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              {acting === 'accept-all' ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              全部接受
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRejectAll}
              disabled={acting !== null}
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {acting === 'reject-all' ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <X className="size-3" />
              )}
              全部拒绝
            </Button>
          </div>
        )}
      </div>

      {error !== null && (
        <div className="mb-2 rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-500">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-2 rounded-md bg-background/30 px-2.5 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                  {entry.targetLayer}
                </span>
                <span>{entry.type}</span>
                <span>·</span>
                <span>{new Date(entry.enqueuedAt).toLocaleDateString('zh-CN')}</span>
              </div>
              <div className="mt-1 truncate text-xs text-foreground" title={entry.pattern}>
                {entry.pattern}
              </div>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAcceptOne(entry.id)}
                disabled={acting !== null}
                className="size-6 p-0 text-emerald-500 hover:text-emerald-600"
                title="接受"
              >
                {acting === `accept-${entry.id}` ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Check className="size-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRejectOne(entry.id)}
                disabled={acting !== null}
                className="size-6 p-0 text-muted-foreground hover:text-foreground"
                title="拒绝"
              >
                {acting === `reject-${entry.id}` ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <X className="size-3" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
