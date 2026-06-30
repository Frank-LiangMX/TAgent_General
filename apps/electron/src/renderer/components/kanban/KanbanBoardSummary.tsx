/**
 * KanbanBoardSummary — 对话 Tab 内的看板进度小卡片
 *
 * 显示看板进度（done/total）+ 进度条 + 「打开团队」按钮。
 * 点击「打开团队」切换二级 Tab 到团队视图。
 */

import * as React from 'react'

import type { KanbanTask } from '@tagent/shared'

import { Button } from '@tagent/ui'
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
    <div className="session-glass mx-4 mt-2 mb-1 rounded-glass-popover px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
          <Users className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">看板团队</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {done}/{total} 完成
              {running > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">{running} 执行中</span>}
              {blocked > 0 && <span className="ml-2 text-red-600 dark:text-red-400">{blocked} 阻塞</span>}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full bg-blue-500 transition-all duration-300',
                blocked > 0 && 'bg-gradient-to-r from-blue-500 to-amber-500'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenTeam}
          className="h-7 px-2 text-[11px] text-foreground/70 hover:text-foreground"
        >
          打开团队
        </Button>
      </div>
    </div>
  )
}
