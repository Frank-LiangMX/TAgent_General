import { beforeEach, describe, expect, test, vi } from 'vitest'

const appQuit = vi.fn(() => {})
const setQuitting = vi.fn(() => {})
const getIsQuitting = vi.fn(() => false)

vi.mock('electron', () => ({
  app: { quit: appQuit, exit: vi.fn(() => {}) },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}))

vi.mock('./agent-service', () => ({
  stopAllAgents: vi.fn(() => {}),
  killOrphanedClaudeSubprocesses: vi.fn(() => {}),
}))

vi.mock('./app-lifecycle', () => ({
  getIsQuitting,
  setQuitting,
}))

vi.mock('./auto-archive-scheduler', () => ({ stopAutoArchiveScheduler: vi.fn(() => {}) }))
vi.mock('./bridge-registry', () => ({
  stopAllBridges: vi.fn(() => {}),
  stopBridgeSelfHealing: vi.fn(() => {}),
}))
vi.mock('./detached-preview-window', () => ({
  destroyAllDetachedPreviewWindows: vi.fn(() => {}),
}))
vi.mock('./feishu-sleep-blocker', () => ({ stopFeishuSyncSleepBlocker: vi.fn(() => {}) }))
vi.mock('./global-shortcut-service', () => ({
  unregisterAllGlobalShortcuts: vi.fn(() => {}),
}))
vi.mock('./quick-task-window', () => ({ destroyQuickTaskWindow: vi.fn(() => {}) }))
vi.mock('./tool-config-watcher', () => ({ stopChatToolsWatcher: vi.fn(() => {}) }))
vi.mock('./updater/auto-updater', () => ({
  cleanupUpdater: vi.fn(() => {}),
  getIsQuittingForUpdate: () => false,
}))
vi.mock('./voice-dictation-window', () => ({
  destroyVoiceDictationWindow: vi.fn(() => {}),
}))
vi.mock('./workspace-watcher', () => ({ stopWorkspaceWatcher: vi.fn(() => {}) }))

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
