/**
 * 是否应展示「首条 assistant 到达前」的运行占位。
 *
 * 运行中胶囊与流式 token 原先都挂在 live assistant-turn 上；
 * 首条 SDK assistant 消息到达前若不占位，会话区会出现假静默。
 */
export function shouldShowPendingStreamTurn(params: {
  streaming: boolean
  hasLiveAssistantContent: boolean
}): boolean {
  return params.streaming && !params.hasLiveAssistantContent
}
