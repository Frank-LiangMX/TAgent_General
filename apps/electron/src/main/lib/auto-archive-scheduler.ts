/**
 * 会话自动归档定时任务
 *
 * 独立模块以便应用退出时 clearInterval，避免托盘「退出」后进程仍被定时器挂住。
 */

import { autoArchiveAgentSessions } from './agent-session-manager'
import { autoArchiveConversations } from './conversation-manager'
import { getSettings } from './settings-service'

let autoArchiveInterval: ReturnType<typeof setInterval> | null = null

function runAutoArchive(): void {
  try {
    const settings = getSettings()
    const days = settings.archiveAfterDays ?? 7
    if (days > 0) {
      const archivedChats = autoArchiveConversations(days)
      const archivedSessions = autoArchiveAgentSessions(days)
      if (archivedChats + archivedSessions > 0) {
        console.log(
          `[自动归档] 已归档 ${archivedChats} 个对话, ${archivedSessions} 个 Agent 会话`
        )
      }
    }
  } catch (error) {
    console.error('[自动归档] 自动归档失败:', error)
  }
}

/** 启动时执行一次，并每 24 小时检查 */
export function startAutoArchiveScheduler(): void {
  runAutoArchive()
  if (autoArchiveInterval) return
  autoArchiveInterval = setInterval(runAutoArchive, 24 * 60 * 60 * 1000)
}

/** 应用退出时停止（before-quit） */
export function stopAutoArchiveScheduler(): void {
  if (autoArchiveInterval) {
    clearInterval(autoArchiveInterval)
    autoArchiveInterval = null
  }
}
