/**
 * AutomationTaskToolbar — 任务操作条（置于标题下方，避开窗口控制区）
 */

import { Loader2, Pause, Play, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AutomationTaskToolbarProps {
  enabled: boolean
  running: boolean
  onRunNow: () => void
  onToggle: () => void
  onDelete: () => void
}

export function AutomationTaskToolbar({
  enabled,
  running,
  onRunNow,
  onToggle,
  onDelete,
}: AutomationTaskToolbarProps): React.ReactElement {
  return (
    <div className="shrink-0 border-b border-border/40 bg-muted/10 px-5 py-2.5">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          disabled={running || !enabled}
          onClick={onRunNow}
        >
          {running ? (
            <Loader2 size={14} className="mr-1.5 animate-spin" />
          ) : (
            <Play size={14} className="mr-1.5" />
          )}
          立即运行
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={onToggle}
        >
          {enabled ? (
            <>
              <Pause size={14} className="mr-1.5" />
              暂停任务
            </>
          ) : (
            <>
              <Play size={14} className="mr-1.5" />
              恢复任务
            </>
          )}
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 rounded-full px-3 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400'
          )}
          onClick={onDelete}
        >
          <Trash2 size={14} className="mr-1.5" />
          删除
        </Button>
      </div>
    </div>
  )
}
