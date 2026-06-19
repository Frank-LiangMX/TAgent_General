import type { ContextUsageCategory } from '@tagent/shared'

/** 格式化 Context 分项 token 数 */
export function formatContextTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return `${tokens.toLocaleString()}`
}

const FREE_SPACE_NAMES = new Set(['Free space', 'free space', 'Remaining', '剩余'])

export function isFreeSpaceCategory(name: string): boolean {
  return FREE_SPACE_NAMES.has(name)
}

/** 从 SDK categories 中查找颜色（支持多个候选名） */
export function findCategoryColor(
  categories: ContextUsageCategory[],
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const match = categories.find((category) => category.name === name)
    if (match?.color) return match.color
  }
  return undefined
}

/** 计算占 context 窗口比例（0–100） */
export function categoryPercentOfWindow(tokens: number, maxTokens?: number): number | undefined {
  if (!maxTokens || maxTokens <= 0 || tokens <= 0) return undefined
  return Math.round((tokens / maxTokens) * 100)
}
