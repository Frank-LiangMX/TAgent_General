import React, { useState } from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface WindowCloseConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 正在执行的看板任务数（>0 时提示用户优先最小化） */
  runningTaskCount?: number
}

export function WindowCloseConfirmDialog({
  open,
  onOpenChange,
  runningTaskCount = 0,
}: WindowCloseConfirmDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false)
  const hasRunningTasks = runningTaskCount > 0

  const handleAction = (action: 'minimize-to-tray' | 'quit') => {
    console.info('[WindowCloseConfirmDialog] 用户选择:', action, '记住:', rememberChoice)
    window.electronAPI.sendWindowCloseResponse({ action, remember: rememberChoice })
    setRememberChoice(false)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[400px]">
        <AlertDialogHeader>
          <AlertDialogTitle>关闭窗口</AlertDialogTitle>
          <AlertDialogDescription>你希望如何处理？</AlertDialogDescription>
        </AlertDialogHeader>

        {/* 有任务在跑时显示提示 */}
        {hasRunningTasks && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <span className="text-sm font-medium">
                ⚠️ 有 {runningTaskCount} 个看板任务正在执行
              </span>
            </div>
            <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
              最小化到托盘可让任务继续执行；退出会中断所有任务（下次启动会自动恢复为 ready
              重新派工）。
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary accent-primary"
          />
          <span className="text-sm text-muted-foreground">记住我的选择</span>
        </label>

        <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
          <button
            type="button"
            className={cn(
              'flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              hasRunningTasks
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400'
                : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            onClick={() => handleAction('minimize-to-tray')}
          >
            最小化到托盘
            {hasRunningTasks && <span className="ml-1 text-xs">（推荐）</span>}
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            onClick={() => handleAction('quit')}
          >
            退出程序
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
