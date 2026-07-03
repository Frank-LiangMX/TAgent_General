/**
 * AutomationBlockedHistory - 定时任务指令拦截历史
 *
 * 展示 ~/.tagent[-dev]/automation/logs/ 下的拦截记录：
 * - 列表：时间 / automationName / 命中模式 / 来源 stage
 * - 详情：点击展开 originalPrompt 与 sanitizedPrompt 对比
 *
 * 数据来源：main 进程 automation-blocked-log.ts 通过 IPC 暴露
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { AutomationBlockedLogSummary } from '@tagent/shared'
import { Button, ScrollArea } from '@tagent/ui'

import {
  blockedLogsAtom,
  blockedLogsLoadingAtom,
  deleteBlockedLog,
  getBlockedLogDetail,
  loadBlockedLogs,
} from '@/atoms/automation-atoms'
import { cn } from '@/lib/utils'

/** stage 中文标签 */
const STAGE_LABEL: Record<AutomationBlockedLogSummary['stage'], string> = {
  create: '创建时',
  update: '更新时',
  runtime: '执行时',
}

/** stage 颜色 */
const STAGE_CLASS: Record<AutomationBlockedLogSummary['stage'], string> = {
  create: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  update: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  runtime: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

export function AutomationBlockedHistory(): React.ReactElement {
  const blockedLogs = useAtomValue(blockedLogsAtom)
  const loading = useAtomValue(blockedLogsLoadingAtom)
  const setBlockedLogs = useSetAtom(blockedLogsAtom)

  const refresh = React.useCallback(async () => {
    const data = await loadBlockedLogs()
    setBlockedLogs(data)
  }, [setBlockedLogs])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const handleDelete = async (fileName: string): Promise<void> => {
    const ok = await deleteBlockedLog(fileName)
    if (ok) {
      toast.success('已删除拦截记录')
      await refresh()
    } else {
      toast.error('删除失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (blockedLogs.length === 0) {
    return (
      <div className="rounded-xl bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
        暂无拦截记录
      </div>
    )
  }

  return (
    <ScrollArea className="max-h-[420px]">
      <div className="space-y-2 pr-1">
        {blockedLogs.map((log) => (
          <BlockedHistoryItem
            key={log.fileName}
            log={log}
            onDelete={() => void handleDelete(log.fileName)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

interface BlockedHistoryItemProps {
  log: AutomationBlockedLogSummary
  onDelete: () => void
}

function BlockedHistoryItem({ log, onDelete }: BlockedHistoryItemProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const [detail, setDetail] = React.useState<{
    originalPrompt: string
    sanitizedPrompt: string
    strippedInvisibleCount: number
  } | null>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  const handleExpand = async (): Promise<void> => {
    if (expanded) {
      setExpanded(false)
      return
    }
    if (!detail) {
      setLoadingDetail(true)
      try {
        const d = await getBlockedLogDetail(log.fileName)
        if (d) {
          setDetail({
            originalPrompt: d.originalPrompt,
            sanitizedPrompt: d.sanitizedPrompt,
            strippedInvisibleCount: d.strippedInvisibleCount,
          })
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '加载详情失败')
      } finally {
        setLoadingDetail(false)
      }
    }
    setExpanded(true)
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-foreground">
              {log.automationName}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(log.timestamp).toLocaleString('zh-CN')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                STAGE_CLASS[log.stage]
              )}
            >
              {STAGE_LABEL[log.stage]}
            </span>
            {log.strippedInvisibleCount > 0 ? (
              <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                剥离不可见字符 × {log.strippedInvisibleCount}
              </span>
            ) : null}
            {log.patterns.slice(0, 2).map((p) => (
              <span
                key={p}
                className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {p}
              </span>
            ))}
            {log.patterns.length > 2 ? (
              <span className="text-[10px] text-muted-foreground">+{log.patterns.length - 2}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 rounded-md text-muted-foreground hover:text-foreground"
            onClick={handleExpand}
            aria-label={expanded ? '收起' : '展开详情'}
          >
            {loadingDetail ? (
              <Loader2 size={12} className="animate-spin" />
            ) : expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 rounded-md text-muted-foreground hover:text-red-500"
            onClick={onDelete}
            aria-label="删除"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      {expanded && detail ? (
        <div className="mt-2 space-y-2 pl-5">
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">原始 prompt</p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-red-500/5 px-2 py-1 text-[10px] text-red-700 dark:text-red-300">
              {detail.originalPrompt}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">剥离不可见字符后</p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-700 dark:text-emerald-300">
              {detail.sanitizedPrompt}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}
