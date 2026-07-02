/**
 * 应用退出清扫
 *
 * 托盘「退出 TAgent」、设置里选退出、以及 app.quit() 均走同一套 before-quit 清扫。
 * 若仍有定时器/子进程拖住事件循环，will-quit 后会触发强制 app.exit(0)。
 */

import { app, BrowserWindow } from 'electron'

import { stopAllAgents, killOrphanedClaudeSubprocesses } from './agent-service'
import { stopAutoArchiveScheduler } from './auto-archive-scheduler'
import { getIsQuitting, setQuitting } from './app-lifecycle'
import { stopAllBridges, stopBridgeSelfHealing } from './bridge-registry'
import { destroyAllDetachedPreviewWindows } from './detached-preview-window'
import { stopFeishuSyncSleepBlocker } from './feishu-sleep-blocker'
import { unregisterAllGlobalShortcuts } from './global-shortcut-service'
import { destroyQuickTaskWindow } from './quick-task-window'
import { stopChatToolsWatcher } from './tool-config-watcher'
import { cleanupUpdater, getIsQuittingForUpdate } from './updater/auto-updater'
import { destroyVoiceDictationWindow } from './voice-dictation-window'
import { stopWorkspaceWatcher } from './workspace-watcher'

const FORCE_EXIT_MS = 5_000

let shutdownStarted = false
let forceExitTimer: ReturnType<typeof setTimeout> | null = null

/** 关闭所有 BrowserWindow（含隐藏主窗 / 独立预览），避免 close 拦截导致 quit 卡住
 *
 * 先 hide() 再 destroy()：close() 会触发 Chromium 页面卸载流程，经历白屏→黑屏→销毁的闪烁；
 * hide() 让窗口对用户瞬间消失，destroy() 立即释放资源且不触发 close 事件/beforeunload。
 */
export function destroyAllAppWindows(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.removeAllListeners('close')
    win.hide()
    win.destroy()
  }
}

/** 托盘 / 菜单等入口：发起正常退出，并注册超时强退兜底 */
export function requestApplicationQuit(): void {
  // 必须先标记退出，否则 Windows/macOS 主窗 close 拦截会 preventDefault 并隐藏到托盘
  if (!getIsQuitting()) {
    setQuitting()
  }
  scheduleForceExitFallback()
  app.quit()
}

/** before-quit 调用：释放所有会阻止进程退出的资源 */
export function runApplicationShutdown(): void {
  if (shutdownStarted) return
  shutdownStarted = true

  setQuitting()

  // 安装更新：仅释放可能锁住安装目录的 Agent 子进程，其余交给 NSIS 安装器
  if (getIsQuittingForUpdate()) {
    stopAllAgents()
    killOrphanedClaudeSubprocesses()
    cleanupUpdater()
    return
  }

  destroyAllDetachedPreviewWindows()
  stopAllAgents()
  killOrphanedClaudeSubprocesses()
  cleanupUpdater()
  stopAutoArchiveScheduler()
  stopWorkspaceWatcher()
  stopChatToolsWatcher()
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { stopScheduler } =
      require('./automation-scheduler') as typeof import('./automation-scheduler')
    stopScheduler()
  } catch (err) {
    console.error('[退出] 停止定时任务调度器失败:', err)
  }
  try {
    // 停止看板调度器（worker 子会话由 stopAllAgents 统一停，dispatcher 只清 tick timer）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { stopKanbanDispatcher } =
      require('./kanban-dispatcher') as typeof import('./kanban-dispatcher')
    stopKanbanDispatcher()
  } catch (err) {
    console.error('[退出] 停止看板调度器失败:', err)
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
