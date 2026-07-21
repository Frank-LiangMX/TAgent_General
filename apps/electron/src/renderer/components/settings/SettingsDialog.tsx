/**
 * SettingsDialog - 设置浮层
 *
 * 对齐主壳 spatial：panel 玻璃 + 模糊遮罩 + 平滑进退场。
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useAtom } from 'jotai'
import * as React from 'react'

import { SettingsPanel } from './SettingsPanel'

import './settings-shell.css'

import { settingsOpenAtom } from '@/atoms/settings-tab'

export function SettingsDialog(): React.ReactElement {
  const [open, setOpen] = useAtom(settingsOpenAtom)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="settings-dialog-overlay fixed inset-0 z-[100] titlebar-no-drag data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300" />
        <DialogPrimitive.Content
          className="settings-dialog-shell fixed left-1/2 top-1/2 z-[100] text-dialog-foreground titlebar-no-drag outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">设置</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            应用偏好、渠道、外观与集成配置
          </DialogPrimitive.Description>
          <SettingsPanel onClose={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
