/**
 * 本地确定性标题生成
 *
 * 不调用任何 Provider，从用户首条消息提取标题：
 * - 取第一条非空文本行
 * - 合并连续空白为单个空格
 * - 落盘保留完整标题（不按字符数硬截、不加 …）
 * - 无有效文本返回 null
 *
 * 视觉截断（省略号）一律交给 UI 布局：
 * TabBar / 侧栏 `min-w-0 flex-1 truncate`（text-overflow: ellipsis）。
 */

/**
 * 从用户消息文本生成确定性标题（完整首行，不截断）
 *
 * @param text 用户消息原文（可能多行、含多余空白）
 * @returns 规范化后的完整标题，无有效文本时返回 null
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
  return normalized.length > 0 ? normalized : null
}
