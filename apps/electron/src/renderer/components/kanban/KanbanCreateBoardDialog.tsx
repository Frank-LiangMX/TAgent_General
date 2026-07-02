/**
 * KanbanCreateBoardDialog — 看板新建/重命名对话框（B4）
 *
 * 替代 Electron 不可用的 window.prompt()。
 * create 模式：rootGoal（必填）+ title（可选）
 * rename 模式：title（必填，预填当前值）
 */

import * as React from 'react'
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
} from '@tagent/ui'

interface KanbanCreateBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'rename'
  /** rename 模式下预填的标题 */
  initialTitle?: string
  /** create: 创建看板；rename: 更新看板标题 */
  onSubmit: (values: { rootGoal?: string; title: string }) => Promise<void>
}

export function KanbanCreateBoardDialog({
  open,
  onOpenChange,
  mode,
  initialTitle = '',
  onSubmit,
}: KanbanCreateBoardDialogProps): React.ReactElement {
  const isCreate = mode === 'create'
  const [rootGoal, setRootGoal] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  // 打开时重置表单
  React.useEffect(() => {
    if (!open) return
    setRootGoal('')
    setTitle(initialTitle)
    setSubmitting(false)
  }, [open, initialTitle])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (isCreate) {
      const trimmedGoal = rootGoal.trim()
      if (!trimmedGoal) {
        toast.error('请输入看板目标')
        return
      }
      setSubmitting(true)
      try {
        await onSubmit({ rootGoal: trimmedGoal, title: trimmedTitle || trimmedGoal })
        onOpenChange(false)
      } catch (err) {
        console.error('[看板] 创建看板失败:', err)
        toast.error('创建看板失败', {
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setSubmitting(false)
      }
    } else {
      if (!trimmedTitle) {
        toast.error('请输入新标题')
        return
      }
      setSubmitting(true)
      try {
        await onSubmit({ title: trimmedTitle })
        onOpenChange(false)
      } catch (err) {
        console.error('[看板] 重命名看板失败:', err)
        toast.error('重命名失败', {
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setSubmitting(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? '新建看板' : '重命名看板'}</DialogTitle>
          <DialogDescription>
            {isCreate ? '输入看板目标，调度器会自动拆解任务并派工' : '输入新的看板标题'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {isCreate ? (
            <div className="space-y-1.5">
              <Label htmlFor="board-goal" className="text-xs">
                看板目标 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="board-goal"
                value={rootGoal}
                onChange={(e) => setRootGoal(e.target.value)}
                placeholder="例如：完成 v2.0 版本发布"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                看板目标会作为根任务，调度器据此拆解子任务
              </p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="board-title" className="text-xs">
              看板标题{isCreate ? '（可选）' : ' '}{' '}
              <span className="text-red-500">{!isCreate ? '*' : ''}</span>
            </Label>
            <Input
              id="board-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isCreate ? '不填则用看板目标截断' : '输入新标题'}
              autoFocus={!isCreate}
            />
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
            <Button
              type="submit"
              size="sm"
              disabled={submitting || (isCreate ? !rootGoal.trim() : !title.trim())}
            >
              {submitting ? (isCreate ? '创建中...' : '保存中...') : isCreate ? '创建看板' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
