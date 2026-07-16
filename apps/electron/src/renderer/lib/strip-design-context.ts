/**
 * strip-design-context.ts — 从用户消息中剥离 Design Preview 注入块
 *
 * 用于会话气泡渲染：历史消息里可能仍含 DESIGN_PREVIEW / <design-context>，
 * 对人只展示真实原文。
 */

export interface StripDesignContextResult {
  /** 剥离后供展示的正文 */
  displayText: string
  /** 原文是否含有设计上下文块 */
  hadDesignContext: boolean
}

const DESIGN_PREVIEW_BLOCK =
  /===== DESIGN_PREVIEW 上下文 START =====[\s\S]*?===== DESIGN_PREVIEW 上下文 END =====\s*/g

const DESIGN_CONTEXT_TAG = /<design-context>[\s\S]*?<\/design-context>\s*/gi

const USER_QUESTION_SEPARATOR = /(?:^|\n)----- 以下是用户的实际问题 -----\s*\n*/g

/**
 * 剥离设计上下文注入，返回用户可见正文。
 * 兼容旧格式（前置 DESIGN_PREVIEW + 分隔符）与新格式（末尾 <design-context>）。
 */
export function stripDesignContextFromUserMessage(raw: string): StripDesignContextResult {
  if (!raw) return { displayText: '', hadDesignContext: false }

  const hadDesignContext =
    /===== DESIGN_PREVIEW 上下文 START =====/.test(raw) ||
    /<design-context>/i.test(raw) ||
    /----- 以下是用户的实际问题 -----/.test(raw)

  if (!hadDesignContext) {
    return { displayText: raw, hadDesignContext: false }
  }

  let text = raw
  text = text.replace(DESIGN_PREVIEW_BLOCK, '')
  text = text.replace(DESIGN_CONTEXT_TAG, '')

  // 旧格式：前缀上下文 + 分隔符 + 用户正文 → 只保留分隔符之后
  if (/----- 以下是用户的实际问题 -----/.test(text)) {
    const parts = text.split(/----- 以下是用户的实际问题 -----\s*/)
    text =
      parts.length > 1 ? parts.slice(1).join('').trim() : text.replace(USER_QUESTION_SEPARATOR, '')
  } else {
    text = text.replace(USER_QUESTION_SEPARATOR, '')
  }

  return {
    displayText: text.trim(),
    hadDesignContext: true,
  }
}
