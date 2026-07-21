/**
 * 看板数字员工：人态文案与分组（跨 MainView / Team / 员工卡共用）
 *
 * 技术 status 仍用 KanbanTaskStatus；对用户展示用人态语言。
 */

import type { LucideIcon } from 'lucide-react'
import { BarChart3, Bot, Boxes, Code2, Eye, FileText, Search, Sparkles } from 'lucide-react'

import type { KanbanTaskStatus } from '@tagent/shared'

/** 状态 → 人态徽章 */
export const CREW_STATUS_BADGE: Record<
  KanbanTaskStatus,
  { label: string; className: string; dot: string }
> = {
  pending: {
    label: '排队中',
    className: 'bg-muted text-muted-foreground border-transparent',
    dot: 'bg-muted-foreground/50',
  },
  ready: {
    label: '待命',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-transparent',
    dot: 'bg-blue-500',
  },
  running: {
    label: '忙碌',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
    dot: 'bg-amber-500',
  },
  blocked: {
    label: '求助中',
    className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
    dot: 'bg-red-500',
  },
  review: {
    label: '待验收',
    className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-transparent',
    dot: 'bg-purple-500',
  },
  done: {
    label: '已交卷',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
    dot: 'bg-emerald-500',
  },
  failed: {
    label: '需复盘',
    className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
    dot: 'bg-red-500',
  },
  cancelled: {
    label: '已撤岗',
    className: 'bg-muted text-muted-foreground border-transparent',
    dot: 'bg-muted-foreground/30',
  },
}

/** 状态分组（班组墙顺序） */
export const CREW_STATUS_GROUPS: Array<{
  status: KanbanTaskStatus
  label: string
  desc?: string
}> = [
  { status: 'ready', label: '待命', desc: '等待上岗' },
  { status: 'pending', label: '排队中', desc: '依赖未满足' },
  { status: 'running', label: '忙碌中', desc: '数字员工执行中' },
  { status: 'blocked', label: '求助中', desc: '需要外部输入' },
  { status: 'review', label: '待验收', desc: '等待确认结果' },
  { status: 'done', label: '已交卷', desc: '任务成功结束' },
  { status: 'failed', label: '需复盘', desc: '执行出错' },
  { status: 'cancelled', label: '已撤岗', desc: '被手动停止' },
]

/**
 * 角色头像：中性玻璃底 + lucide 图标（禁止饱和色字圆）
 */
export function roleAvatarSpec(roleId: string | undefined): {
  wrap: string
  Icon: LucideIcon
} {
  const wrap = 'bg-foreground/[0.06] text-foreground/80 ring-1 ring-inset ring-foreground/[0.08]'
  switch (roleId) {
    case 'coder':
      return { wrap, Icon: Code2 }
    case 'analyst':
    case 'data-analyst':
      return { wrap, Icon: BarChart3 }
    case 'reviewer':
      return { wrap, Icon: Eye }
    case 'writer':
    case 'doc-writer':
      return { wrap, Icon: FileText }
    case 'architect':
    case 'software-architect':
      return { wrap, Icon: Boxes }
    case 'explorer':
    case 'researcher':
      return { wrap, Icon: Search }
    case 'chat':
      return { wrap, Icon: Sparkles }
    case 'generalist':
    default:
      return { wrap, Icon: Bot }
  }
}

/** 从「角色名 01」解析工号角标；无编号则 undefined */
export function parseCrewBadge(roleLabel: string | undefined): string | undefined {
  if (!roleLabel) return undefined
  const m = roleLabel.match(/\s(\d{2})$/)
  return m?.[1]
}
