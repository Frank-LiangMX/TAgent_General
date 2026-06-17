/**
 * switch_mode 工具
 *
 * 允许 LLM 建议切换到另一个模式继续工作。
 * 这是一个"伪工具"——调用时不会真正执行，而是触发 UI 弹窗让用户确认。
 *
 * 调用流程：
 * 1. LLM 在 TA 模式调 `switch_mode({target_mode:'general', reason, context_summary})`
 * 2. Renderer 捕获，弹 modal
 * 3. 用户确认 → 序列化当前 session → 在 general 模式建新 session → 切 Tab → 新 session 自动开始
 * 4. 取消 → 工具返回 `{cancelled:true}`，LLM 继续原任务
 */

import type { ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'

// ===== 工具元数据 =====

export const SWITCH_MODE_TOOL_META: ChatToolMeta = {
  id: 'switch_mode',
  name: '切换模式',
  description: '建议将当前对话切换到另一个模式继续',
  params: [
    { name: 'target_mode', type: 'string', description: '目标模式: general 或 ta', required: true },
    { name: 'reason', type: 'string', description: '为什么建议切换（1 句话）', required: true },
    {
      name: 'context_summary',
      type: 'string',
      description: '到目前为止的关键上下文（3-5 句）',
      required: true,
    },
  ],
  icon: 'ArrowRightLeft',
  category: 'builtin',
  executorType: 'builtin',
}

// ===== 工具定义 =====

export const SWITCH_MODE_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'switch_mode',
    description:
      '建议将当前对话切换到另一个模式继续。target_mode: "general" 用于代码/写工具/办公；"ta" 用于游戏资产/TA 工作流。调用此工具会弹窗请求用户确认，用户可以接受或拒绝。',
    parameters: {
      type: 'object',
      properties: {
        target_mode: {
          type: 'string',
          enum: ['general', 'ta'],
          description: '目标模式：general（通用）或 ta（技术美术）',
        },
        reason: {
          type: 'string',
          description: '为什么建议切换（1 句话，用于弹窗展示）',
        },
        context_summary: {
          type: 'string',
          description: '到目前为止的关键上下文（3-5 句，用于新会话继承）',
        },
      },
      required: ['target_mode', 'reason', 'context_summary'],
    },
  },
]

// ===== 工具调用参数类型 =====

export interface SwitchModeToolInput {
  target_mode: 'general' | 'ta'
  reason: string
  context_summary: string
}

// ===== 工具调用结果类型 =====

export interface SwitchModeToolResult {
  /** 用户是否接受切换 */
  accepted: boolean
  /** 如果接受，新会话 ID */
  newSessionId?: string
  /** 如果拒绝，原因 */
  cancelReason?: string
  /** 错误信息 */
  error?: string
}

/**
 * 检查工具调用是否是 switch_mode
 */
export function isSwitchModeToolCall(toolName: string): boolean {
  return toolName === 'switch_mode'
}

/**
 * 验证 switch_mode 工具输入
 */
export function validateSwitchModeInput(input: unknown): input is SwitchModeToolInput {
  if (typeof input !== 'object' || input === null) return false
  const { target_mode, reason, context_summary } = input as Record<string, unknown>
  return (
    (target_mode === 'general' || target_mode === 'ta') &&
    typeof reason === 'string' &&
    reason.length > 0 &&
    typeof context_summary === 'string' &&
    context_summary.length > 0
  )
}
