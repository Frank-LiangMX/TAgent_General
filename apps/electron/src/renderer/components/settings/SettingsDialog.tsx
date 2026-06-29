/**
 * SettingsDialog - 设置浮窗
 *
 * 以 Dialog 浮窗形式展示设置面板，不覆盖主内容区。
 * 使用低级 Dialog 原语实现轻遮罩 + 无默认关闭按钮（关闭按钮由 SettingsPanel 内部提供）。
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useAtom } from 'jotai'
import * as React from 'react'

import { SettingsPanel } from './SettingsPanel'

import { settingsOpenAtom } from '@/atoms/settings-tab'

export function SettingsDialog(): React.ReactElement {
  const [open, setOpen] = useAtom(settingsOpenAtom)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        {/* 轻遮罩：淡入淡出 */}
        <DialogPrimitive.Overlay className="session-glass-overlay fixed inset-0 z-[100] titlebar-no-drag data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200" />
        <DialogPrimitive.Content className="settings-dialog-animate session-glass-surface session-glass-modal-lg fixed left-[50%] top-[50%] z-[100] translate-x-[-50%] translate-y-[-50%] w-[85vw] max-w-[992px] h-[85vh] max-h-[752px] text-dialog-foreground overflow-hidden titlebar-no-drag">
          <DialogPrimitive.Title className="sr-only">设置</DialogPrimitive.Title>
          <SettingsPanel onClose={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
