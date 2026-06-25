/**
 * DraftStatusBar — 底部状态栏
 *
 * 展示：状态徽章 + 最后保存时间 + 单键"下一步"按钮
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { CheckCircle2, Rocket, ShieldCheck } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { DraftStatus } from '@tagent/shared'

import { currentDraftAtom, upgradeToReadyAtom, upgradeToAgentAtom, setDraftStatusAtom } from '@/atoms/draft-atoms'
import { STATUS_STYLES, STATUS_LABELS } from './draft-status-styles'
import { cn } from '@/lib/utils'

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

function getNextAction(
  status: DraftStatus,
  upgradeToReady: () => Promise<unknown>,
  upgradeToAgent: () => Promise<unknown>,
  markVerified: () => Promise<unknown>
): { label: string; icon: React.ReactNode; action: () => Promise<unknown> } | null {
  switch (status) {
    case 'draft':
      return { label: '标记就绪', icon: <CheckCircle2 size={11} />, action: upgradeToReady }
    case 'ready':
      return { label: '交给 Agent', icon: <Rocket size={11} />, action: upgradeToAgent }
    case 'executing':
      return null
    case 'done':
      return { label: '标记已验证', icon: <ShieldCheck size={11} />, action: markVerified }
    case 'verified':
      return null
  }
}

export function DraftStatusBar(): React.ReactElement {
  const draft = useAtomValue(currentDraftAtom)
  const upgradeToReady = useSetAtom(upgradeToReadyAtom)
  const upgradeToAgent = useSetAtom(upgradeToAgentAtom)
  const setDraftStatus = useSetAtom(setDraftStatusAtom)

  if (!draft) {
    return <div className="h-[28px] border-t border-border/40" />
  }

  const status = draft.status

  const markVerified = async (): Promise<void> => {
    await setDraftStatus({ id: draft.id, status: 'verified' })
  }

  const nextAction = getNextAction(status, upgradeToReady, upgradeToAgent, markVerified)

  const handleNextAction = async (): Promise<void> => {
    if (!nextAction) return
    try {
      await nextAction.action()
    } catch (error) {
      toast.error('操作失败', { description: String(error) })
    }
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
        {nextAction ? (
          <button
            type="button"
            onClick={handleNextAction}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
          >
            {nextAction.icon}
            {nextAction.label}
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground/30">
            {status === 'verified' ? '已验收完成' : 'Agent 执行中…'}
          </span>
        )}
      </div>
    </div>
  )
}
