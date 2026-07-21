/**
 * AutomationMainView — 自动任务工作场（spatial）
 *
 * rail-only：无左侧 sidebar。主区自带任务卡场 + 详情/新建。
 * 不沿用 RailInspectorHeader / 设置页白卡片。
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { ArrowLeft, Clock, Loader2, MessageSquare, Pause, Play, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { Automation } from '@tagent/shared'
import { formatScheduleLabel } from '@tagent/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  SegmentedTabs,
  SegmentedTabsItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import {
  automationsAtom,
  automationsCountAtom,
  automationsLoadingAtom,
  automationEditorModeAtom,
  blockedLogsAtom,
  deleteAutomation,
  lastBlockedEventAtom,
  loadAutomations,
  loadBlockedLogs,
  runAutomationNow,
  selectedAutomationIdAtom,
  toggleAutomation,
} from '@/atoms/automation-atoms'
import { AutomationFormView } from '@/components/automation/AutomationFormView'
import { Panel } from '@/components/app-shell/Panel'
import { detectIsMac, detectIsWindows } from '@/lib/platform'
import { cn } from '@/lib/utils'

type FilterTab = 'all' | 'enabled' | 'paused' | 'completed'

function automationStatus(a: Automation): Exclude<FilterTab, 'all'> {
  if (!a.enabled && a.completedAt) return 'completed'
  if (!a.enabled) return 'paused'
  return 'enabled'
}

function statusLabel(status: Exclude<FilterTab, 'all'>): string {
  if (status === 'enabled') return '启用中'
  if (status === 'paused') return '已暂停'
  return '已完成'
}

function statusDotClass(status: Exclude<FilterTab, 'all'>): string {
  if (status === 'enabled') return 'bg-emerald-500'
  if (status === 'paused') return 'bg-foreground/30'
  return 'bg-sky-500'
}

function formatNextRun(ts: number): string {
  if (!ts || ts <= 0) return '—'
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AutomationMainView(): React.ReactElement {
  const automations = useAtomValue(automationsAtom)
  const counts = useAtomValue(automationsCountAtom)
  const [loading, setLoading] = useAtom(automationsLoadingAtom)
  const setAutomations = useSetAtom(automationsAtom)
  const setBlockedLogs = useSetAtom(blockedLogsAtom)
  const setLastBlockedEvent = useSetAtom(lastBlockedEventAtom)
  const [selectedId, setSelectedId] = useAtom(selectedAutomationIdAtom)
  const [editorMode, setEditorMode] = useAtom(automationEditorModeAtom)
  const [filter, setFilter] = React.useState<FilterTab>('all')
  const [runningId, setRunningId] = React.useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const isMac = React.useMemo(() => detectIsMac(), [])
  const isWindows = React.useMemo(() => detectIsWindows(), [])

  const refreshAutomations = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadAutomations()
      setAutomations(data)
    } finally {
      setLoading(false)
    }
  }, [setAutomations, setLoading])

  const refreshBlockedLogs = React.useCallback(async () => {
    const data = await loadBlockedLogs()
    setBlockedLogs(data)
  }, [setBlockedLogs])

  React.useEffect(() => {
    void refreshAutomations()
    void refreshBlockedLogs()
    const cleanupAutomations = window.electronAPI.automation.onChanged(() => {
      void refreshAutomations()
    })
    const cleanupBlocked = window.electronAPI.automation.onPromptBlocked((event) => {
      setLastBlockedEvent(event)
      toast.error(
        `「${event.automationName}」指令被安全拦截: ${event.patterns.slice(0, 2).join(', ')}`
      )
      void refreshBlockedLogs()
    })
    return () => {
      cleanupAutomations()
      cleanupBlocked()
    }
  }, [refreshAutomations, refreshBlockedLogs, setLastBlockedEvent])

  const selected = automations.find((a) => a.id === selectedId) ?? null
  const showEditor = editorMode === 'create' || (editorMode === 'edit' && selected)

  const filtered = React.useMemo(() => {
    if (filter === 'all') return automations
    return automations.filter((a) => automationStatus(a) === filter)
  }, [automations, filter])

  const handleCreate = (): void => {
    setSelectedId(null)
    setEditorMode('create')
  }

  const handleSelect = (id: string): void => {
    setSelectedId(id)
    setEditorMode('edit')
  }

  const handleBack = (): void => {
    setEditorMode('edit')
    setSelectedId(null)
  }

  const handleSaved = (_automation: Automation): void => {
    // 保存后回到任务场（卡片列表），不停留在详情编辑态
    setSelectedId(null)
    setEditorMode('edit')
  }

  const handleRunNow = async (id: string): Promise<void> => {
    setRunningId(id)
    try {
      await runAutomationNow(id)
      toast.success('已触发运行')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '运行失败')
    } finally {
      setRunningId(null)
    }
  }

  const handleToggle = async (id: string): Promise<void> => {
    try {
      await toggleAutomation(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '切换失败')
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    await deleteAutomation(selected.id)
    setSelectedId(null)
    setEditorMode('edit')
    setDeleteOpen(false)
    toast.success('已删除')
  }

  return (
    <Panel variant="grow" className="content-glass relative flex min-h-0 flex-col overflow-hidden">
      {/* 头栏 */}
      <div
        className={cn(
          'relative shrink-0 px-5 pb-3 pt-4',
          !isMac && 'pt-7',
          isWindows && 'pr-[134px]'
        )}
      >
        <div
          className="absolute inset-0 z-[1] titlebar-drag-region"
          style={isWindows ? { right: 126 } : undefined}
          aria-hidden
        />
        <div className="relative z-[2] flex items-start justify-between gap-3 titlebar-no-drag">
          <div className="min-w-0">
            {showEditor ? (
              <button
                type="button"
                onClick={handleBack}
                className={cn(
                  'mb-1 inline-flex h-6 items-center gap-1 rounded-glass-popover px-2 text-[10px] font-medium tracking-[0.02em]',
                  'bg-foreground/[0.045] text-foreground/55 transition-colors hover:bg-foreground/[0.07] hover:text-foreground/80'
                )}
              >
                <ArrowLeft className="size-3" strokeWidth={1.75} />
                返回任务场
              </button>
            ) : null}
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/35">
              AUTOMATION
            </p>
            <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-[color:var(--spatial-ink,hsl(var(--foreground)))]">
              {editorMode === 'create' ? '新建定时任务' : selected ? selected.name : '自动任务'}
            </h1>
            <p className="mt-0.5 text-[11px] text-foreground/45">
              {editorMode === 'create'
                ? '配置调度、执行环境与任务指令'
                : selected
                  ? formatScheduleLabel(selected)
                  : `${counts.total} 个任务 · ${counts.enabled} 启用`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {selected && editorMode === 'edit' ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={runningId === selected.id || !selected.enabled}
                      onClick={() => void handleRunNow(selected.id)}
                      className="inline-flex size-8 items-center justify-center rounded-glass-popover text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground disabled:opacity-40"
                      aria-label="立即运行"
                    >
                      {runningId === selected.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" strokeWidth={1.75} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">立即运行</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => void handleToggle(selected.id)}
                      className="inline-flex size-8 items-center justify-center rounded-glass-popover text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground"
                      aria-label={selected.enabled ? '暂停' : '恢复'}
                    >
                      {selected.enabled ? (
                        <Pause className="size-3.5" strokeWidth={1.75} />
                      ) : (
                        <Play className="size-3.5 text-amber-500" strokeWidth={1.75} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {selected.enabled ? '暂停任务' : '恢复任务'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="inline-flex size-8 items-center justify-center rounded-glass-popover text-foreground/40 hover:bg-red-500/10 hover:text-red-500"
                      aria-label="删除"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">删除</TooltipContent>
                </Tooltip>
              </>
            ) : null}

            {!showEditor ? (
              <button
                type="button"
                onClick={handleCreate}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-glass-popover px-3 text-[12px] font-semibold tracking-tight',
                  'text-[color:var(--spatial-accent,hsl(var(--primary)))] bg-[var(--spatial-accent-soft,hsl(var(--primary)/0.12))]',
                  'hover:brightness-[1.03]'
                )}
              >
                <Plus className="size-3.5" strokeWidth={1.75} />
                新建
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 内容 */}
      {showEditor ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <AutomationFormView
            key={editorMode === 'create' ? 'create' : selected?.id}
            mode={editorMode === 'create' ? 'create' : 'edit'}
            automation={editorMode === 'edit' ? (selected ?? undefined) : undefined}
            onSaved={handleSaved}
            onCancelCreate={handleBack}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5">
          <div className="mb-3 shrink-0">
            <SegmentedTabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
              <SegmentedTabsItem value="all">全部</SegmentedTabsItem>
              <SegmentedTabsItem value="enabled">启用</SegmentedTabsItem>
              <SegmentedTabsItem value="paused">暂停</SegmentedTabsItem>
              <SegmentedTabsItem value="completed">完成</SegmentedTabsItem>
            </SegmentedTabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-5 animate-spin text-foreground/35" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyAutomationField hasAny={automations.length > 0} onCreate={handleCreate} />
            ) : (
              <div className="kanban-crew-field grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {filtered.map((item) => (
                  <AutomationTaskCard
                    key={item.id}
                    task={item}
                    running={runningId === item.id}
                    onOpen={() => handleSelect(item.id)}
                    onRun={() => void handleRunNow(item.id)}
                    onToggle={() => void handleToggle(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除定时任务？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{selected?.name}」，运行历史一并移除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  )
}

function EmptyAutomationField({
  hasAny,
  onCreate,
}: {
  hasAny: boolean
  onCreate: () => void
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-glass-popover bg-foreground/[0.04]">
        <Clock className="size-5 text-foreground/30" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-medium text-foreground/70">
        {hasAny ? '当前筛选下没有任务' : '还没有定时任务'}
      </p>
      <p className="mt-1 max-w-[280px] text-[11px] leading-relaxed text-foreground/40">
        {hasAny ? '试试切换上方筛选，或新建一条任务' : '按日程自动开 Agent 会话，跑完可通知你'}
      </p>
      {!hasAny ? (
        <button
          type="button"
          onClick={onCreate}
          className={cn(
            'mt-5 inline-flex h-8 items-center gap-1.5 rounded-glass-popover px-3.5 text-[12px] font-semibold',
            'text-[color:var(--spatial-accent,hsl(var(--primary)))] bg-[var(--spatial-accent-soft,hsl(var(--primary)/0.12))]'
          )}
        >
          <Plus className="size-3.5" strokeWidth={1.75} />
          创建第一个
        </button>
      ) : null}
    </div>
  )
}

function AutomationTaskCard({
  task,
  running,
  onOpen,
  onRun,
  onToggle,
}: {
  task: Automation
  running: boolean
  onOpen: () => void
  onRun: () => void
  onToggle: () => void
}): React.ReactElement {
  const status = automationStatus(task)

  return (
    // 外层用 div：卡片可点开详情，底部另有「运行/暂停」按钮，禁止 button 套 button
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="kanban-crew-badge group flex h-full min-h-[132px] w-full cursor-pointer flex-col p-3.5 text-left titlebar-no-drag ui-pressable"
    >
      <div className="flex w-full items-start gap-2">
        <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', statusDotClass(status))} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium tracking-tight text-foreground">
            {task.name || '未命名任务'}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-foreground/45">
            {formatScheduleLabel(task)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-foreground/[0.05] px-1.5 py-0.5 text-[9px] text-foreground/45">
          {statusLabel(status)}
        </span>
      </div>

      <div className="mt-3 flex-1 space-y-1 text-[11px] text-foreground/50">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3 shrink-0 opacity-60" strokeWidth={1.75} />
          <span className="truncate">下次 {formatNextRun(task.nextRunAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageSquare className="size-3 shrink-0 opacity-60" strokeWidth={1.75} />
          <span className="truncate">已跑 {task.runCount ?? 0} 次</span>
        </div>
      </div>

      <div
        className="mt-3 flex items-center gap-1 border-t border-foreground/[0.05] pt-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={running || !task.enabled}
          onClick={onRun}
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-glass-popover text-[11px] text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground disabled:opacity-35"
        >
          {running ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Play className="size-3" strokeWidth={1.75} />
          )}
          运行
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-glass-popover text-[11px] text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {task.enabled ? (
            <>
              <Pause className="size-3" strokeWidth={1.75} />
              暂停
            </>
          ) : (
            <>
              <Play className="size-3 text-amber-500" strokeWidth={1.75} />
              恢复
            </>
          )}
        </button>
      </div>
    </div>
  )
}
