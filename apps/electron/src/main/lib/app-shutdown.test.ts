import { beforeEach, describe, expect, mock, test } from 'bun:test'

const appQuit = mock(() => {})
const setQuitting = mock(() => {})
const getIsQuitting = mock(() => false)

mock.module('electron', () => ({
  app: { quit: appQuit, exit: mock(() => {}) },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}))

mock.module('./agent-service', () => ({
  stopAllAgents: mock(() => {}),
  killOrphanedClaudeSubprocesses: mock(() => {}),
}))

mock.module('./app-lifecycle', () => ({
  getIsQuitting,
  setQuitting,
}))

mock.module('./auto-archive-scheduler', () => ({ stopAutoArchiveScheduler: mock(() => {}) }))
mock.module('./bridge-registry', () => ({
  stopAllBridges: mock(() => {}),
  stopBridgeSelfHealing: mock(() => {}),
}))
mock.module('./detached-preview-window', () => ({
  destroyAllDetachedPreviewWindows: mock(() => {}),
}))
mock.module('./feishu-sleep-blocker', () => ({ stopFeishuSyncSleepBlocker: mock(() => {}) }))
mock.module('./global-shortcut-service', () => ({
  unregisterAllGlobalShortcuts: mock(() => {}),
}))
mock.module('./quick-task-window', () => ({ destroyQuickTaskWindow: mock(() => {}) }))
mock.module('./tool-config-watcher', () => ({ stopChatToolsWatcher: mock(() => {}) }))
mock.module('./updater/auto-updater', () => ({
  cleanupUpdater: mock(() => {}),
  getIsQuittingForUpdate: () => false,
}))
mock.module('./voice-dictation-window', () => ({
  destroyVoiceDictationWindow: mock(() => {}),
}))
mock.module('./workspace-watcher', () => ({ stopWorkspaceWatcher: mock(() => {}) }))

describe('requestApplicationQuit', () => {
  beforeEach(() => {
    appQuit.mockClear()
    setQuitting.mockClear()
    getIsQuitting.mockReset()
    getIsQuitting.mockReturnValue(false)
  })

  test('退出前先设置 quitting 标志，避免 close 拦截把退出变成隐藏', async () => {
    const { requestApplicationQuit } = await import('./app-shutdown')

    requestApplicationQuit()

    expect(setQuitting).toHaveBeenCalledTimes(1)
    expect(appQuit).toHaveBeenCalledTimes(1)
  })

  test('已处于 quitting 状态时不再重复 setQuitting', async () => {
    getIsQuitting.mockReturnValue(true)
    const { requestApplicationQuit } = await import('./app-shutdown')

    requestApplicationQuit()

    expect(setQuitting).not.toHaveBeenCalled()
    expect(appQuit).toHaveBeenCalledTimes(1)
  })
})
