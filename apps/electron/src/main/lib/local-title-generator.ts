/**
 * 本地确定性标题生成
 *
 * 不调用任何 Provider，从用户首条消息提取标题：
 * - 取第一条非空文本行
 * - 合并连续空白为单个空格
 * - 截断到最大长度
 * - 无有效文本返回 null
 */

/** 标题最大长度 */
const MAX_TITLE_LENGTH = 20

/**
 * 从用户消息文本生成确定性标题
 *
 * @param text 用户消息原文（可能多行、含多余空白）
 * @returns 截断后的标题，无有效文本时返回 null
 */
export function generateLocalTitle(text: string): string | null {
  if (!text || typeof text !== 'string') return null

  // 取第一条非空文本行
  const lines = text.split('\n')
  let firstNonEmptyLine: string | undefined
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      firstNonEmptyLine = trimmed
      break
    }
  }

  if (!firstNonEmptyLine) return null

  // 合并连续空白为单个空格
  const normalized = firstNonEmptyLine.replace(/\s+/g, ' ')

  // 截断到最大长度
  const result = normalized.slice(0, MAX_TITLE_LENGTH)
  return result.length > 0 ? result : null
}
