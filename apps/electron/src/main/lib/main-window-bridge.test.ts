import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { BrowserWindow } from 'electron'

import { hideMainWindowToTray, registerMainWindowBridge } from './main-window-bridge'

describe('hideMainWindowToTray', () => {
  const hideToTray = mock((_win: BrowserWindow) => {})

  beforeEach(() => {
    hideToTray.mockClear()
  })

  test('必须隐藏主窗口，而不是 getAllWindows 里的第一个窗口', () => {
    const mainWin = { isDestroyed: () => false } as BrowserWindow
    registerMainWindowBridge({
      getMainWindow: () => mainWin,
      hideToTray,
    })

    hideMainWindowToTray()

    expect(hideToTray).toHaveBeenCalledTimes(1)
    expect(hideToTray).toHaveBeenCalledWith(mainWin)
  })

  test('主窗口不可用时不会调用 hide', () => {
    registerMainWindowBridge({
      getMainWindow: () => null,
      hideToTray,
    })

    hideMainWindowToTray()

    expect(hideToTray).not.toHaveBeenCalled()
  })
})
