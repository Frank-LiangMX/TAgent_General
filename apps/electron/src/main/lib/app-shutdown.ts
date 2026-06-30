/**
 * 应用退出清扫
 *
 * 托盘「退出 TAgent」、设置里选退出、以及 app.quit() 均走同一套 before-quit 清扫。
 * 若仍有定时器/子进程拖住事件循环，will-quit 后会触发强制 app.exit(0)。
 */

import { app, BrowserWindow } from 'electron'

import { stopAllAgents, killOrphanedClaudeSubprocesses } from './agent-service'
import { stopAutoArchiveScheduler } from './auto-archive-scheduler'
import { setQuitting } from './app-lifecycle'
import { stopAllBridges, stopBridgeSelfHealing } from './bridge-registry'
import { destroyAllDetachedPreviewWindows } from './detached-preview-window'
import { stopFeishuSyncSleepBlocker } from './feishu-sleep-blocker'
import { unregisterAllGlobalShortcuts } from './global-shortcut-service'
import { destroyQuickTaskWindow } from './quick-task-window'
import { stopChatToolsWatcher } from './tool-config-watcher'
import { cleanupUpdater } from './updater/auto-updater'
import { destroyVoiceDictationWindow } from './voice-dictation-window'
import { stopWorkspaceWatcher } from './workspace-watcher'

const FORCE_EXIT_MS = 5_000

let shutdownStarted = false
let forceExitTimer: ReturnType<typeof setTimeout> | null = null

/** 关闭所有 BrowserWindow（含隐藏主窗 / 独立预览），避免 close 拦截导致 quit 卡住 */
export function destroyAllAppWindows(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.removeAllListeners('close')
    win.close()
  }
}

/** 托盘 / 菜单等入口：发起正常退出，并注册超时强退兜底 */
export function requestApplicationQuit(): void {
  scheduleForceExitFallback()
  app.quit()
}

/** before-quit 调用：释放所有会阻止进程退出的资源 */
export function runApplicationShutdown(): void {
  if (shutdownStarted) return
  shutdownStarted = true

  setQuitting()
  destroyAllDetachedPreviewWindows()
  stopAllAgents()
  killOrphanedClaudeSubprocesses()
  cleanupUpdater()
  stopAutoArchiveScheduler()
  stopWorkspaceWatcher()
  stopChatToolsWatcher()
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { stopScheduler } = require('./automation-scheduler') as typeof import('./automation-scheduler')
    stopScheduler()
  } catch (err) {
    console.error('[退出] 停止定时任务调度器失败:', err)
  }
  stopBridgeSelfHealing()
  stopAllBridges()
  stopFeishuSyncSleepBlocker()
  unregisterAllGlobalShortcuts()
  destroyQuickTaskWindow()
  destroyVoiceDictationWindow()
  destroyAllAppWindows()
}

/** 正常退出若被遗留 handle 拖住，超时后强杀子进程并 app.exit(0) */
export function scheduleForceExitFallback(): void {
  if (forceExitTimer) return
  forceExitTimer = setTimeout(() => {
    console.error('[退出] 正常退出超时，强制结束进程')
    killOrphanedClaudeSubprocesses()
    app.exit(0)
  }, FORCE_EXIT_MS)
}

export function clearForceExitFallback(): void {
  if (forceExitTimer) {
    clearTimeout(forceExitTimer)
    forceExitTimer = null
  }
}
