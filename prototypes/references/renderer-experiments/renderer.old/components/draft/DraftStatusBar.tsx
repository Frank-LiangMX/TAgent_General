/**
 * DraftStatusBar — 底部状态栏
 *
 * 展示：流程指示器 + 最后保存时间 + 单键"下一步"按钮
 */

import { useAtomValue, useSetAtom } from 'jotai'
import {
  Check,
  ChevronRight,
  Circle,
  CheckCircle2,
  Rocket,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { DraftStatus } from '@tagent/shared'

import { STATUS_STYLES, STATUS_LABELS } from './draft-status-styles'
import {
  currentDraftAtom,
  upgradeToReadyAtom,
  upgradeToAgentAtom,
  setDraftStatusAtom,
} from '@/atoms/draft-atoms'
import { cn } from '@/lib/utils'

/** 流程步骤定义 */
const FLOW_STEPS: Array<{ status: DraftStatus; label: string; icon: React.ReactNode }> = [
  { status: 'draft', label: '编写', icon: <Circle size={10} /> },
  { status: 'ready', label: '就绪', icon: <Check size={10} /> },
  { status: 'executing', label: '执行', icon: <Loader2 size={10} /> },
  { status: 'done', label: '完成', icon: <CheckCircle2 size={10} /> },
  { status: 'verified', label: '验收', icon: <ShieldCheck size={10} /> },
]

/** 状态顺序索引 */
const STATUS_ORDER: DraftStatus[] = ['draft', 'ready', 'executing', 'done', 'verified']

function getStatusIndex(status: DraftStatus): number {
  return STATUS_ORDER.indexOf(status)
}

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
): {
  label: string
  icon: React.ReactNode
  action: () => Promise<unknown>
  description: string
} | null {
  switch (status) {
    case 'draft':
      return {
        label: '标记就绪',
        icon: <CheckCircle2 size={11} />,
        action: upgradeToReady,
        description: '需求已完善，可以交给 Agent 执行',
      }
    case 'ready':
      return {
        label: '交给 Agent',
        icon: <Rocket size={11} />,
        action: upgradeToAgent,
        description: '≥2 个需求块时自动创建看板并行执行',
      }
    case 'executing':
      return null
    case 'done':
      return {
        label: '标记已验证',
        icon: <ShieldCheck size={11} />,
        action: markVerified,
        description: '验收通过，任务完成',
      }
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
  const currentIdx = getStatusIndex(status)

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
    <div className="h-[36px] border-t border-border/40 px-4 flex items-center justify-between">
      {/* 左侧：流程指示器 */}
      <div className="flex items-center gap-1">
        {FLOW_STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isPending = idx > currentIdx

          return (
            <React.Fragment key={step.status}>
              <div
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] transition-colors',
                  isCompleted && 'bg-green-500/10 text-green-600 dark:text-green-400',
                  isCurrent && cn('bg-primary/15 text-primary font-medium', STATUS_STYLES[status]),
                  isPending && 'text-muted-foreground/40'
                )}
              >
                {isCompleted ? (
                  <Check size={10} strokeWidth={3} className="text-green-600 dark:text-green-400" />
                ) : isCurrent && status === 'executing' ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  step.icon
                )}
                <span>{step.label}</span>
              </div>
              {idx < FLOW_STEPS.length - 1 && (
                <ChevronRight
                  size={10}
                  className={cn(
                    'transition-colors',
                    idx < currentIdx ? 'text-green-500/50' : 'text-muted-foreground/30'
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* 右侧：保存时间 + 下一步按钮 */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground/50">
          {formatRelativeTime(draft.updatedAt)}
        </span>

        {nextAction ? (
          <button
            type="button"
            onClick={handleNextAction}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
          >
            {nextAction.icon}
            <span>{nextAction.label}</span>
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground/30 italic">
            {status === 'verified' ? '已验收完成' : 'Agent 执行中…'}
          </span>
        )}
      </div>
    </div>
  )
}
