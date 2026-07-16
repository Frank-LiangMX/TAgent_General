/**
 * chat-input-bridge.ts — 跨组件注入 chat input 文本（v2）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.3
 *
 * 为什么不直接 import jotai store + 改 atom？
 *  - RichTextInput 的 draft 是会话级 atom（agentSessionDraftsAtom），
 *    改了它之后还会触发其他 effect 链（HTML、token 计数等）。
 *  - 跨组件直接写 atom 容易和 AgentView 的初始化逻辑打架。
 *
 * 解法：dispatch 一个 CustomEvent，AgentView 监听并按其内部规则追加。
 * 这是项目里 tagent:focus-input / tagent:stop-generation 的同款做法。
 */

/** 全局事件名 */
export const APPEND_CHAT_INPUT_EVENT = 'tagent:append-chat-input'

/** 事件 detail 类型 */
export interface AppendChatInputDetail {
  /** 追加到 chat input 末尾的纯文本。 */
  text: string
  /**
   * 追加前是否先聚焦输入框。默认 true（用户体验最佳）。
   * 设为 false 可在不希望抢焦点的场景使用。
   */
  focus?: boolean
}

/**
 * 触发追加：把 text 追加到当前会话的 chat input 末尾。
 *
 * 用法：
 *   dispatchAppendChatInput('把「登录」按钮改成圆角')
 */
export function dispatchAppendChatInput(text: string, options: { focus?: boolean } = {}): void {
  if (!text) return
  const detail: AppendChatInputDetail = {
    text,
    focus: options.focus ?? true,
  }
  window.dispatchEvent(new CustomEvent(APPEND_CHAT_INPUT_EVENT, { detail }))
}
