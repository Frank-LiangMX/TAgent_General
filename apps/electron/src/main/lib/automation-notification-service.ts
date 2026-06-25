/**
 * 定时任务完成通知投递服务
 */

import { BrowserWindow, Notification } from 'electron'

import type { Automation, AutomationRun } from '@tagent/shared'

import { getAgentSessionSDKMessages } from './agent-session-manager'
import {
  buildAutomationFeishuCard,
  buildAutomationSystemBody,
  extractAssistantText,
  shouldNotifyForRun,
} from './automation-notification-format'
import { feishuBridgeManager } from './feishu-bridge-manager'

interface AutomationNotificationPayload {
  automation: Automation
  run: AutomationRun
}

function buildSummary(payload: AutomationNotificationPayload): string {
  const { run } = payload
  if (run.status === 'failed') return run.error ?? '未知错误'
  if (run.status === 'skipped') return run.skipReason ?? '已跳过'
  if (!run.sessionId) return ''
  return extractAssistantText(getAgentSessionSDKMessages(run.sessionId))
}

function sendSystemNotification(payload: AutomationNotificationPayload): void {
  const { automation, run } = payload
  const summary = buildSummary(payload)
  const statusPrefix = run.status === 'succeeded' ? '✅' : run.status === 'failed' ? '❌' : '⏭️'

  const notification = new Notification({
    title: `${statusPrefix} ${automation.name}`,
    body: buildAutomationSystemBody({ ...payload, summary }),
    silent: false,
  })

  notification.on('click', () => {
    const mainWindow = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed())
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  notification.show()
}

async function sendFeishuNotification(payload: AutomationNotificationPayload): Promise<void> {
  const feishu = payload.automation.notification?.feishu
  if (!feishu?.enabled || !feishu.chatId) return

  const summary = buildSummary(payload)
  await feishuBridgeManager.sendCardToChat(
    feishu.chatId,
    buildAutomationFeishuCard({ ...payload, summary })
  )
}

/** 定时任务运行结束后按配置投递通知 */
export async function notifyAutomationRunFinished(
  payload: AutomationNotificationPayload
): Promise<void> {
  const notification = payload.automation.notification
  if (!notification) return

  const trigger = notification.trigger
  if (!shouldNotifyForRun(trigger, payload.run.status)) return

  const hasSystem = notification.system === true
  const hasFeishu = notification.feishu?.enabled === true && !!notification.feishu.chatId
  if (!hasSystem && !hasFeishu) return

  if (hasSystem) {
    try {
      sendSystemNotification(payload)
    } catch (error) {
      console.error(`[定时任务] 系统通知发送失败: automation=${payload.automation.id}`, error)
    }
  }

  if (hasFeishu) {
    try {
      await sendFeishuNotification(payload)
    } catch (error) {
      console.error(
        `[定时任务] 飞书通知发送失败: automation=${payload.automation.id}, chat=${notification.feishu?.chatId}`,
        error
      )
    }
  }
}
