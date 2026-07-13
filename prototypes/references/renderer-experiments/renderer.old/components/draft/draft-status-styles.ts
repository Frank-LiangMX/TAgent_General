import type { DraftStatus } from '@tagent/shared'

/** 状态颜色映射 */
export const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: 'bg-foreground/12 text-foreground/55',
  ready: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  executing: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
  verified: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
}

/** 状态中文标签 */
export const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: '草稿',
  ready: '就绪',
  executing: '执行中',
  done: '完成',
  verified: '已验证',
}

/** 状态排列顺序 */
export const STATUS_ORDER: DraftStatus[] = ['draft', 'ready', 'executing', 'done', 'verified']
