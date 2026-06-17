/**
 * NudgeToast - Nudge 机制的用户通知组件
 *
 * 根据设计文档 §6.5.4：
 * - 不打断对话，5s 自动消失
 * - 用户点"记" / "不记" / "稍后"
 * - 使用 sonner toast 实现
 */

import { toast } from 'sonner'

import type { NudgeCandidate } from '@tagent/shared'

/**
 * 显示 Nudge 通知
 *
 * @param nudge Nudge 候选项
 * @param sessionId 会话 ID
 * @param mode 记忆模式
 * @returns toast ID
 */
export function showNudgeToast(
  nudge: NudgeCandidate,
  sessionId: string,
  mode: 'general' | 'ta'
): string | number {
  // 纠正类型自动记录，显示简单确认
  if (nudge.type === 'correction') {
    return toast(nudge.userMessage, {
      duration: 3000,
      position: 'bottom-right',
    })
  }

  // 其他类型显示选项
  return toast(nudge.userMessage, {
    duration: 5000,
    position: 'bottom-right',
    action: {
      label: '记住',
      onClick: async () => {
        await window.electronAPI.respondNudge(sessionId, nudge.id, 'accept', mode)
        toast.success('已记录', { duration: 2000 })
      },
    },
    cancel: {
      label: '不记',
      onClick: async () => {
        await window.electronAPI.respondNudge(sessionId, nudge.id, 'reject', mode)
      },
    },
  })
}

/**
 * 显示批量 Nudge 通知
 *
 * @param nudges Nudge 候选项列表
 * @param sessionId 会话 ID
 * @param mode 记忆模式
 */
export function showNudgeToasts(
  nudges: NudgeCandidate[],
  sessionId: string,
  mode: 'general' | 'ta'
): void {
  // 串行显示，避免重叠
  for (let i = 0; i < nudges.length; i++) {
    const nudge = nudges[i]
    if (!nudge) continue
    // 间隔 1 秒显示下一个
    setTimeout(() => {
      showNudgeToast(nudge, sessionId, mode)
    }, i * 1000)
  }
}
