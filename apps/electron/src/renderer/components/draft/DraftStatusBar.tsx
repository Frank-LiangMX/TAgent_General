/**
 * DraftStatusBar — 底部状态栏
 *
 * 展示：状态徽章（带颜色） + 最后保存时间 + "交给 Agent"按钮
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { Rocket } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { DraftStatus } from '@tagent/shared'

import { currentDraftAtom, upgradeToReadyAtom } from '@/atoms/draft-atoms'
import { cn } from '@/lib/utils'

/** 状态颜色映射 */
const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: 'bg-foreground/12 text-foreground/55',
  ready: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  executing: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
  verified: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
}

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: '草稿',
  ready: '就绪',
  executing: '执行中',
  done: '完成',
  verified: '已验证',
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

export function DraftStatusBar(): React.ReactElement {
  const draft = useAtomValue(currentDraftAtom)
  const upgradeToReady = useSetAtom(upgradeToReadyAtom)

  if (!draft) {
    return <div className="h-[28px] border-t border-border/40" />
  }

  const status = draft.status
  const isReady = status === 'ready'

  const handleUpgradeToAgent = (): void => {
    // Phase 5 尚未实现，暂时提示
    toast.info('即将实现', { description: 'Draft → Agent 升级流程将在后续版本实现' })
  }

  const handleReadyClick = async (): Promise<void> => {
    await upgradeToReady()
  }

  return (
    <div className="h-[28px] border-t border-border/40 px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium',
            STATUS_STYLES[status]
          )}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="text-[11px] text-muted-foreground/50">
          保存于 {formatRelativeTime(draft.updatedAt)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* 如果是 draft 状态，先升到 ready */}
        {status === 'draft' && (
          <button
            type="button"
            onClick={handleReadyClick}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 transition-colors"
          >
            标记就绪
          </button>
        )}

        {/* ready 状态才能交给 Agent */}
        <button
          type="button"
          onClick={handleUpgradeToAgent}
          disabled={!isReady}
          className={cn(
            'flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium transition-colors',
            isReady
              ? 'bg-primary/10 text-primary hover:bg-primary/15'
              : 'text-muted-foreground/40 cursor-not-allowed'
          )}
        >
          <Rocket size={11} />
          交给 Agent
        </button>
      </div>
    </div>
  )
}
