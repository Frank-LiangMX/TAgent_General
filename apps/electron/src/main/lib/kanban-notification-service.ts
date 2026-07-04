/**
 * 看板里程碑通知投递服务
 *
 * 推送看板关键事件到 IM（飞书/微信/WPS）：
 * - board_created：看板创建，推送「已开始，共 N 个任务」
 * - task_started：任务开始（可选，默认不推送，避免刷屏）
 * - task_done：任务完成，推送「任务名 · 完成」+ 摘要
 * - task_blocked：任务阻塞，推送「任务名 · 等你确认」+ 阻塞原因
 * - board_completed：看板全部完成，推送「全部完成」+ 汇总
 *
 * 频率控制：仅里程碑推送，禁止每个 tool call 一条（防止刷屏）
 */

import { BrowserWindow, Notification } from 'electron'

import type { KanbanBoard, KanbanTask } from '@tagent/shared'

import { getAgentSessionSDKMessages } from './agent-session-manager'
import { extractAssistantText } from './automation-notification-format'
import { feishuBridgeManager } from './feishu-bridge-manager'

// ===== 通知事件类型 =====

export type KanbanNotificationEvent =
  | 'board_created'
  | 'task_started'
  | 'task_done'
  | 'task_blocked'
  | 'board_completed'

export interface KanbanNotificationPayload {
  event: KanbanNotificationEvent
  board: KanbanBoard
  task?: KanbanTask
  /** 任务摘要（task_done/task_blocked 时从会话消息提取） */
  summary?: string
  /** 阻塞原因（task_blocked 时） */
  blockedReason?: string
  /** 看板完成统计（board_completed 时） */
  completionStats?: {
    total: number
    done: number
    failed: number
  }
}

// ===== 格式化函数 =====

/** 格式化看板持续时间 */
function formatBoardDuration(ms?: number): string {
  if (!ms || ms < 0) return '未知'
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} 秒`
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} 分钟`
  return `${Math.round(ms / 3600_000)} 小时`
}

/** 截断文本 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n\n... [内容过长，请在 TAgent 中查看完整会话]`
}

/** 从任务 assigneeSessionId 提取摘要 */
function extractTaskSummary(task: KanbanTask): string {
  if (!task.assigneeSessionId) return ''
  const messages = getAgentSessionSDKMessages(task.assigneeSessionId)
  return extractAssistantText(messages)
}

// ===== 系统通知 =====

function sendSystemNotification(payload: KanbanNotificationPayload): void {
  const { event, board, task, summary, blockedReason, completionStats } = payload

  const statusIcon = {
    board_created: '📋',
    task_started: '▶️',
    task_done: '✅',
    task_blocked: '⚠️',
    board_completed: '🎉',
  }[event]

  const title = `${statusIcon} ${board.title ?? board.rootGoal}`

  const body = buildSystemBody(payload)

  const notification = new Notification({
    title,
    body,
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

function buildSystemBody(payload: KanbanNotificationPayload): string {
  const { event, board, task, summary, blockedReason, completionStats } = payload

  switch (event) {
    case 'board_created':
      return `已开始，共 ${completionStats?.total ?? 0} 个任务`
    case 'task_started':
      return task ? `任务「${task.title}」开始执行` : ''
    case 'task_done':
      if (!task) return ''
      const taskSummary = summary ?? extractTaskSummary(task)
      return `${task.title} · 完成\n${truncate(taskSummary.trim() || '无摘要', 500)}`
    case 'task_blocked':
      if (!task) return ''
      return `${task.title} · 等你确认\n${blockedReason ?? task.blockedReason ?? '阻塞原因未知'}`
    case 'board_completed':
      const stats = completionStats ?? { total: 0, done: 0, failed: 0 }
      const duration = board.updatedAt - board.createdAt
      return `全部完成（${stats.done}/${stats.total}，失败 ${stats.failed}）\n耗时 ${formatBoardDuration(duration)}`
    default:
      return ''
  }
}

// ===== 飞书通知 =====

async function sendFeishuNotification(
  chatId: string,
  payload: KanbanNotificationPayload
): Promise<void> {
  const card = buildFeishuCard(payload)
  await feishuBridgeManager.sendCardToChat(chatId, card)
}

function buildFeishuCard(payload: KanbanNotificationPayload): Record<string, unknown> {
  const { event, board, task, summary, blockedReason, completionStats } = payload

  const colors = {
    board_created: 'blue',
    task_started: 'blue',
    task_done: 'green',
    task_blocked: 'orange',
    board_completed: 'green',
  } as const

  const titles = {
    board_created: '看板已创建',
    task_started: '任务开始执行',
    task_done: '任务完成',
    task_blocked: '任务阻塞',
    board_completed: '看板全部完成',
  } as const

  const template = colors[event]
  const title = titles[event]

  const lines = buildFeishuContentLines(payload)

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: title },
      template,
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: lines.join('\n'),
        },
      },
    ],
  }
}

function buildFeishuContentLines(payload: KanbanNotificationPayload): string[] {
  const { event, board, task, summary, blockedReason, completionStats } = payload

  const baseLines = [`**看板**: ${board.title ?? board.rootGoal}`]

  switch (event) {
    case 'board_created':
      return [
        ...baseLines,
        `**任务数**: ${completionStats?.total ?? 0}`,
        '',
        '已开始执行，可在 TAgent 中查看进度',
      ]
    case 'task_started':
      if (!task) return baseLines
      return [
        ...baseLines,
        `**任务**: ${task.title}`,
        `**状态**: 执行中`,
        task.modelId ? `**模型**: ${task.modelId}` : '',
      ]
    case 'task_done':
      if (!task) return baseLines
      const taskSummary = summary ?? extractTaskSummary(task)
      return [
        ...baseLines,
        `**任务**: ${task.title}`,
        `**状态**: ✅ 完成`,
        '',
        truncate(taskSummary.trim() || '无摘要', 12_000),
      ]
    case 'task_blocked':
      if (!task) return baseLines
      return [
        ...baseLines,
        `**任务**: ${task.title}`,
        `**状态**: ⚠️ 阻塞`,
        '',
        `**阻塞原因**: ${blockedReason ?? task.blockedReason ?? '未知'}`,
        '',
        '请在 TAgent 中处理或在 IM 回复「解除阻塞」',
      ]
    case 'board_completed':
      const stats = completionStats ?? { total: 0, done: 0, failed: 0 }
      const duration = board.updatedAt - board.createdAt
      return [
        ...baseLines,
        `**完成**: ${stats.done}/${stats.total}`,
        `**失败**: ${stats.failed}`,
        `**耗时**: ${formatBoardDuration(duration)}`,
        '',
        '全部任务已完成',
      ]
    default:
      return baseLines
  }
}

// ===== 微信/WPS 通知 =====

async function sendWechatNotification(
  chatId: string,
  payload: KanbanNotificationPayload
): Promise<void> {
  // TODO: 微信 Bridge 发送文本消息
  // 当前微信 Bridge 仅支持入站，出站待 Phase C 完善
  console.warn('[看板通知] 微信通知暂未实现，chatId:', chatId)
}

async function sendWpsNotification(
  chatId: string,
  payload: KanbanNotificationPayload
): Promise<void> {
  // TODO: WPS Bridge 发送文本消息
  // 当前 WPS Bridge 仅支持入站，出站待 Phase C 完善
  console.warn('[看板通知] WPS通知暂未实现，chatId:', chatId)
}

// ===== 主通知函数 =====

/**
 * 发送看板里程碑通知
 *
 * 根据看板 originBridge 和 originChatId 推送到对应 IM。
 * 如果 originBridge 未配置，仅发送系统通知。
 */
export async function notifyKanbanEvent(payload: KanbanNotificationPayload): Promise<void> {
  const { board } = payload

  // 1. 发送系统通知（始终）
  try {
    sendSystemNotification(payload)
  } catch (error) {
    console.error(`[看板通知] 系统通知发送失败: board=${board.id}`, error)
  }

  // 2. 发送 IM 通知（根据 originBridge）
  const originBridge = board.originBridge
  const originChatId = board.originChatId

  if (!originBridge || !originChatId) {
    // 无 IM 来源，仅系统通知
    return
  }

  try {
    switch (originBridge) {
      case 'feishu':
        await sendFeishuNotification(originChatId, payload)
        break
      case 'wechat':
        await sendWechatNotification(originChatId, payload)
        break
      case 'wps':
        await sendWpsNotification(originChatId, payload)
        break
      case 'dingtalk':
        // TODO: 钉钉通知
        console.warn('[看板通知] 钉钉通知暂未实现')
        break
      default:
        console.warn(`[看板通知] 未知的 IM 渠道: ${originBridge}`)
    }
  } catch (error) {
    console.error(
      `[看板通知] IM 通知发送失败: board=${board.id}, bridge=${originBridge}, chat=${originChatId}`,
      error
    )
  }
}

// ===== 便捷函数（dispatcher 调用） =====

/** 看板创建时推送通知 */
export async function notifyBoardCreated(
  board: KanbanBoard,
  totalTasks: number
): Promise<void> {
  await notifyKanbanEvent({
    event: 'board_created',
    board,
    completionStats: { total: totalTasks, done: 0, failed: 0 },
  })
}

/** 任务完成时推送通知 */
export async function notifyTaskDone(board: KanbanBoard, task: KanbanTask): Promise<void> {
  const summary = extractTaskSummary(task)
  await notifyKanbanEvent({
    event: 'task_done',
    board,
    task,
    summary,
  })
}

/** 任务阻塞时推送通知 */
export async function notifyTaskBlocked(
  board: KanbanBoard,
  task: KanbanTask,
  reason?: string
): Promise<void> {
  await notifyKanbanEvent({
    event: 'task_blocked',
    board,
    task,
    blockedReason: reason ?? task.blockedReason,
  })
}

/** 看板全部完成时推送通知 */
export async function notifyBoardCompleted(
  board: KanbanBoard,
  stats: { total: number; done: number; failed: number }
): Promise<void> {
  await notifyKanbanEvent({
    event: 'board_completed',
    board,
    completionStats: stats,
  })
}