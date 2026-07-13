/**
 * 错误反馈 Dialog 状态管理
 *
 * 错误卡片上的「反馈给开发者」按钮会把当前错误快照写入此 atom 并打开 FeedbackDialog，
 * Dialog 内基于 data 渲染脱敏后的诊断信息，供用户预览 / 编辑 / 提交。
 */

import { atom } from 'jotai'

/** 反馈 Dialog 携带的错误快照（从 SDKMessage 的 _error* 扩展字段提取） */
export interface FeedbackDialogData {
  /** 错误代码（typedError.code，如 unknown_error / invalid_request） */
  errorCode?: string
  /** 错误标题（typedError.title） */
  errorTitle?: string
  /** 错误消息（typedError.message，友好化后的文案） */
  errorMessage: string
  /** 原始错误详情（typedError.originalError / details，SDK 原始错误文本） */
  errorDetails?: string[]
  /** 模型 ID（assistant 消息的 _channelModelId） */
  modelId?: string
  /** 渠道 ID（如能从上下文拿到，便于反查渠道配置） */
  channelId?: string
  /** 会话 ID（便于开发者定位 ~/.tagent/agent-sessions/*.jsonl 日志） */
  sessionId?: string
}

/** 反馈 Dialog 开关 + 携带的错误快照 */
export const feedbackDialogAtom = atom<{ open: boolean; data: FeedbackDialogData | null }>({
  open: false,
  data: null,
})
