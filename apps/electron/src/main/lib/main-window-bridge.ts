/**
 * 主窗口操作桥接
 *
 * 避免 ipc.ts ↔ index.ts 循环依赖，关闭确认里必须隐藏「主窗口」而非 getAllWindows()[0]。
 */

import type { BrowserWindow } from 'electron'

let mainWindowGetter: (() => BrowserWindow | null) | null = null
let hideToTrayImpl: ((win: BrowserWindow) => void) | null = null

export function registerMainWindowBridge(options: {
  getMainWindow: () => BrowserWindow | null
  hideToTray: (win: BrowserWindow) => void
}): void {
  mainWindowGetter = options.getMainWindow
  hideToTrayImpl = options.hideToTray
}

/** 隐藏主窗口到托盘（关闭确认对话框「最小化到托盘」必须走这里） */
export function hideMainWindowToTray(): void {
  const win = mainWindowGetter?.()
  if (!win || win.isDestroyed()) {
    console.warn('[窗口] 最小化到托盘失败：主窗口不可用')
    return
  }
  hideToTrayImpl?.(win)
  console.info('[窗口] 已最小化到托盘')
}
