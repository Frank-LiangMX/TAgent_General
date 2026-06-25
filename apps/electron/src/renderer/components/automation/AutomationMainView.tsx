/**
 * AutomationMainView - 自动任务主区（Inspector）
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Clock } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import {
  automationsAtom,
  automationEditorModeAtom,
  deleteAutomation,
  loadAutomations,
  runAutomationNow,
  selectedAutomationIdAtom,
  toggleAutomation,
} from '@/atoms/automation-atoms'
import { AutomationFormView } from '@/components/automation/AutomationFormView'
import { AutomationTaskToolbar } from '@/components/automation/AutomationTaskToolbar'
import { Panel } from '@/components/app-shell/Panel'
import { RailInspectorHeader } from '@/components/app-shell/RailInspectorHeader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatScheduleLabel } from '@tagent/shared'

import { detectIsMac } from '@/lib/platform'

export function AutomationMainView(): React.ReactElement {
  const automations = useAtomValue(automationsAtom)
  const setAutomations = useSetAtom(automationsAtom)
  const [selectedId, setSelectedId] = useAtom(selectedAutomationIdAtom)
  const [editorMode, setEditorMode] = useAtom(automationEditorModeAtom)
  const [running, setRunning] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const refreshAutomations = React.useCallback(async () => {
    const data = await loadAutomations()
    setAutomations(data)
  }, [setAutomations])

  React.useEffect(() => {
    void refreshAutomations()
    const cleanup = window.electronAPI.automation.onChanged(() => {
      void refreshAutomations()
    })
    return cleanup
  }, [refreshAutomations])

  const isMac = React.useMemo(() => detectIsMac(), [])

  const selected = automations.find((a) => a.id === selectedId)

  const handleSaved = (automation: typeof selected): void => {
    if (!automation) return
    setSelectedId(automation.id)
    setEditorMode('edit')
  }

  const handleRunNow = async (): Promise<void> => {
    if (!selected) return
    setRunning(true)
    try {
      await runAutomationNow(selected.id)
      toast.success('已触发运行')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '运行失败')
    } finally {
      setRunning(false)
    }
  }

  const handleToggle = async (): Promise<void> => {
    if (!selected) return
    await toggleAutomation(selected.id)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    await deleteAutomation(selected.id)
    setSelectedId(null)
    setEditorMode('edit')
    setDeleteOpen(false)
    toast.success('已删除')
  }

  if (editorMode === 'create') {
    return (
      <Panel variant="grow" className="content-glass">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <RailInspectorHeader
            crumbs={[{ label: '自动任务' }]}
            title="新建定时任务"
            description="配置调度、执行环境与任务指令"
          />
          <AutomationFormView
            mode="create"
            onSaved={(automation) => handleSaved(automation)}
            onCancelCreate={() => {
              setEditorMode('edit')
              if (selectedId) return
              setSelectedId(null)
            }}
          />
        </div>
      </Panel>
    )
  }

  if (!selected) {
    return (
      <Panel variant="grow" className="content-glass relative">
        {!isMac ? (
          <div
            className="pointer-events-none absolute inset-0 right-[126px] titlebar-drag-region"
            aria-hidden
          />
        ) : null}
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <Clock size={40} className="opacity-30" />
          <p className="text-sm">从左侧选择任务，或点击 + 创建新任务</p>
        </div>
      </Panel>
    )
  }

  return (
    <Panel variant="grow" className="content-glass">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <RailInspectorHeader
          crumbs={[{ label: '自动任务' }]}
          title={selected.name}
          description={formatScheduleLabel(selected)}
        />
        <AutomationTaskToolbar
          enabled={selected.enabled}
          running={running}
          onRunNow={() => void handleRunNow()}
          onToggle={() => void handleToggle()}
          onDelete={() => setDeleteOpen(true)}
        />
        <AutomationFormView
          key={selected.id}
          mode="edit"
          automation={selected}
          onSaved={(automation) => handleSaved(automation)}
        />
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除定时任务？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{selected.name}」，运行历史一并移除，此操作不可撤销。
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
