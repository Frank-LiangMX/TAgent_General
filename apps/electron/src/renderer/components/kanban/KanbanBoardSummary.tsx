/**
 * KanbanBoardSummary — 对话 Tab 内的看板进度小卡片
 *
 * 显示看板进度（done/total）+ 进度条 + 执行中/阻塞数。
 * 整张卡片可点击，切换到团队 Tab 查看详情（避免和团队 Tab 按钮重复）。
 */

import * as React from 'react'

import type { KanbanTask } from '@tagent/shared'

import { Users } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface KanbanBoardSummaryProps {
  tasks: KanbanTask[]
  onOpenTeam: () => void
}

export function KanbanBoardSummary({
  tasks,
  onOpenTeam,
}: KanbanBoardSummaryProps): React.ReactElement {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const running = tasks.filter((t) => t.status === 'running').length
  const blocked = tasks.filter((t) => t.status === 'blocked').length
  const progress = total > 0 ? (done / total) * 100 : 0

  return (
    <button
      type="button"
      onClick={onOpenTeam}
      className="ml-auto flex items-center gap-2 rounded-full bg-muted/50 px-2.5 py-1 text-left transition-all hover:bg-muted hover:shadow-sm"
      title="查看看板团队详情"
    >
      <Users className="size-3.5 text-blue-600 dark:text-blue-400" />
      <span className="text-[11px] font-medium text-foreground tabular-nums">
        {done}/{total}
      </span>
      {running > 0 && (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">
          ·{running} 执行
        </span>
      )}
      {blocked > 0 && (
        <span className="text-[10px] text-red-600 dark:text-red-400 tabular-nums">
          ·{blocked} 阻塞
        </span>
      )}
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full bg-blue-500 transition-all duration-300',
            blocked > 0 && 'bg-gradient-to-r from-blue-500 to-amber-500'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  )
}
