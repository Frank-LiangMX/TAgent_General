/**
 * KanbanCreateTaskDialog — 看板新建任务对话框（B5）
 *
 * 替代 window.prompt，提供标题 + 渠道 + 描述 + 优先级表单。
 * 渠道默认从全局选中模型兜底，用户可在 Dialog 内切换。
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { toast } from 'sonner'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@tagent/ui'

import { channelsAtom, selectedModelAtom } from '@/atoms/model-atoms'

interface KanbanCreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  onCreated?: () => void
}

export function KanbanCreateTaskDialog({
  open,
  onOpenChange,
  boardId,
  onCreated,
}: KanbanCreateTaskDialogProps): React.ReactElement {
  const channels = useAtomValue(channelsAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const enabledChannels = React.useMemo(() => channels.filter((c) => c.enabled), [channels])

  const [title, setTitle] = React.useState('')
  const [channelId, setChannelId] = React.useState('')
  const [body, setBody] = React.useState('')
  const [priority, setPriority] = React.useState('0')
  const [goalMode, setGoalMode] = React.useState(false)
  const [acceptanceCriteria, setAcceptanceCriteria] = React.useState('')
  const [goalMaxTurns, setGoalMaxTurns] = React.useState('20')
  const [submitting, setSubmitting] = React.useState(false)

  // 打开时初始化 channelId（全局选中兜底 → 第一个可用渠道）
  React.useEffect(() => {
    if (!open) return
    setTitle('')
    setBody('')
    setPriority('0')
    setGoalMode(false)
    setAcceptanceCriteria('')
    setGoalMaxTurns('20')
    if (selectedModel?.channelId) {
      setChannelId(selectedModel.channelId)
    } else if (enabledChannels.length > 0) {
      setChannelId(enabledChannels[0]!.id)
    } else {
      setChannelId('')
    }
  }, [open, selectedModel, enabledChannels])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      toast.error('请输入任务标题')
      return
    }
    if (!channelId) {
      toast.error('请选择渠道')
      return
    }
    setSubmitting(true)
    try {
      const priorityNum = Number.parseInt(priority, 10)
      const turnsNum = Number.parseInt(goalMaxTurns, 10)
      await window.electronAPI.kanban.createTask({
        boardId,
        title: trimmedTitle,
        channelId,
        body: body.trim() || undefined,
        priority: Number.isFinite(priorityNum) ? priorityNum : 0,
        goalMode: goalMode || undefined,
        acceptanceCriteria:
          goalMode && acceptanceCriteria.trim() ? acceptanceCriteria.trim() : undefined,
        goalMaxTurns: goalMode && Number.isFinite(turnsNum) && turnsNum > 0 ? turnsNum : undefined,
      })
      toast.success(goalMode ? 'Goal 任务已创建' : '任务已创建')
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      console.error('[看板] 创建任务失败:', err)
      toast.error('创建任务失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
          <DialogDescription>创建一个看板任务，调度器会自动派工给工人执行</DialogDescription>
        </DialogHeader>
        {enabledChannels.length === 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
            暂无可用渠道。请先到「设置 → 渠道」启用一个渠道，再创建任务。
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-xs">
                任务标题 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="一行简述任务目标"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-channel" className="text-xs">
                渠道 <span className="text-red-500">*</span>
              </Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger id="task-channel">
                  <SelectValue placeholder="选择渠道" />
                </SelectTrigger>
                <SelectContent>
                  {enabledChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-body" className="text-xs">
                任务描述（可选）
              </Label>
              <Textarea
                id="task-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="给工人的完整 prompt（不填则只传标题）"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority" className="text-xs">
                优先级（可选）
              </Label>
              <Input
                id="task-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="数字越大越优先，默认 0"
              />
            </div>

            {/* Goal 模式：多轮 + complete 闸门 + aux judge */}
            <div className="rounded-glass-popover border border-border/40 bg-muted/20 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <Label htmlFor="task-goal-mode" className="text-xs font-medium">
                    Goal 模式
                  </Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    多轮验收 + complete 闸门，防假完成
                  </p>
                </div>
                <Switch id="task-goal-mode" checked={goalMode} onCheckedChange={setGoalMode} />
              </div>
              {goalMode && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-criteria" className="text-xs">
                      验收标准
                    </Label>
                    <Textarea
                      id="task-criteria"
                      value={acceptanceCriteria}
                      onChange={(e) => setAcceptanceCriteria(e.target.value)}
                      placeholder="不填则用标题+描述作为验收标准"
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-max-turns" className="text-xs">
                      最大轮次
                    </Label>
                    <Input
                      id="task-max-turns"
                      type="number"
                      min={1}
                      max={50}
                      value={goalMaxTurns}
                      onChange={(e) => setGoalMaxTurns(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      耗尽仍未通过验收则阻塞，默认 20
                    </p>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                取消
              </Button>
              <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
                {submitting ? '创建中...' : '创建任务'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
