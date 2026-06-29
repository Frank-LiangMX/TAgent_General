import React, { useState } from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface WindowCloseConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WindowCloseConfirmDialog({ open, onOpenChange }: WindowCloseConfirmDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false)

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
          <AlertDialogDescription>
            你希望如何处理？
          </AlertDialogDescription>
        </AlertDialogHeader>

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
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => handleAction('minimize-to-tray')}
          >
            最小化到托盘
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
