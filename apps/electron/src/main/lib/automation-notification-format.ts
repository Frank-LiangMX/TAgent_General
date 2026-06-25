/**
 * 定时任务通知格式化（纯函数，便于单测）
 */

import type {
  Automation,
  AutomationNotificationTrigger,
  AutomationRun,
  SDKAssistantMessage,
  SDKMessage,
} from '@tagent/shared'

interface AutomationNotificationCardPayload {
  automation: Automation
  run: AutomationRun
  summary: string
}

/** 按 trigger 条件判断是否应发送通知 */
export function shouldNotifyForRun(
  trigger: AutomationNotificationTrigger | undefined,
  status: AutomationRun['status']
): boolean {
  if (status === 'skipped' || status === 'running' || status === 'cancelled') return false
  const mode = trigger ?? 'always'
  if (mode === 'always') return true
  if (mode === 'success') return status === 'succeeded'
  return status === 'failed'
}

export function extractAssistantText(messages: SDKMessage[]): string {
  const chunks: string[] = []

  for (const msg of messages) {
    if (msg.type !== 'assistant') continue
    const assistant = msg as SDKAssistantMessage
    for (const block of assistant.message.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        chunks.push(block.text)
      }
    }
  }

  return chunks.join('\n\n').trim()
}

export function formatAutomationDuration(ms?: number): string {
  if (!ms || ms < 0) return '未知'
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} 秒`
  return `${Math.round(ms / 60_000)} 分钟`
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n\n... [内容过长，请在 TAgent 中查看完整会话]`
}

export function buildAutomationSystemBody(payload: AutomationNotificationCardPayload): string {
  const { run } = payload
  if (run.status === 'skipped' && run.skipReason) return run.skipReason
  if (run.status === 'failed') return run.error ?? '未知错误'
  const summary = payload.summary.trim()
  if (summary) return truncate(summary, 500)
  return '任务已完成'
}

export function buildAutomationFeishuCard(
  payload: AutomationNotificationCardPayload
): Record<string, unknown> {
  const { automation, run } = payload
  const success = run.status === 'succeeded'
  const title = success ? '定时任务已完成' : '定时任务失败'
  const template = success ? 'green' : 'red'
  const statusLine =
    run.status === 'succeeded'
      ? '完成'
      : run.status === 'failed'
        ? '失败'
        : run.status === 'skipped'
          ? '跳过'
          : run.status
  const fallback = success ? 'Agent 已完成（无文本输出）' : '没有错误详情'

  const lines = [
    `**任务**: ${automation.name}`,
    `**状态**: ${statusLine}`,
    `**耗时**: ${formatAutomationDuration(run.durationMs)}`,
    run.sessionId ? `**会话 ID**: ${run.sessionId}` : '',
    run.skipReason ? `**跳过原因**: ${run.skipReason}` : '',
    run.error ? `**错误**: ${run.error}` : '',
    '',
    truncate(payload.summary.trim() || fallback, 12_000),
  ].filter(Boolean)

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: title },
      template,
    },
    elements: [
      {
        tag: 'markdown',
        content: lines.join('\n'),
      },
    ],
  }
}
