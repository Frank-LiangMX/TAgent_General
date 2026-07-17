import type { KanbanTask, KanbanTaskStatus, ProgressLogEntry } from '@tagent/shared'

import { DESKS } from './scene/layout/officeLayout'
import type { OfficeAgent, OfficeAgentState } from './types/office-agent'

export const MAX_OFFICE_WORKERS = DESKS.length

export const OFFICE_STATE_LABELS: Record<OfficeAgentState, string> = {
  waiting: '待命',
  walking: '移动中',
  working: '忙碌',
  talking: '交接中',
  thinking: '分析中',
  reviewing: '验收中',
  blocked: '求助中',
  completed: '已交卷',
  failed: '需复盘',
  cancelled: '已撤岗',
}

const ROLE_COLORS = [
  0x4a90d9, 0x9b6dd7, 0x4ecdc4, 0xf97316, 0xe85d4a, 0x50b86c, 0xd97706, 0x64748b,
] as const

const STATUS_PRIORITY: Record<KanbanTaskStatus, number> = {
  running: 0,
  blocked: 1,
  review: 2,
  ready: 3,
  pending: 4,
  failed: 5,
  done: 6,
  cancelled: 7,
}

export interface OfficeWorkerProjection {
  agents: OfficeAgent[]
  hiddenCount: number
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function latestProgress(
  task: KanbanTask,
  liveProgress?: ProgressLogEntry
): ProgressLogEntry | undefined {
  if (liveProgress) return liveProgress
  const logs = task.metadata?.progressLogs
  return Array.isArray(logs) && logs.length > 0 ? logs[logs.length - 1] : undefined
}

function includesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword))
}

/** running 状态继续根据 SDK progress 细分为工作 / 分析 / 验收。 */
export function resolveOfficeWorkerState(
  task: Pick<KanbanTask, 'status'>,
  progress?: Partial<Pick<ProgressLogEntry, 'status' | 'text' | 'lastToolName'>>
): OfficeAgentState {
  switch (task.status) {
    case 'pending':
    case 'ready':
      return 'waiting'
    case 'blocked':
      return 'blocked'
    case 'review':
      return 'reviewing'
    case 'done':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    case 'running': {
      const signal = [progress?.status, progress?.text, progress?.lastToolName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (
        includesAny(signal, [
          'think',
          'analy',
          'plan',
          'search',
          'research',
          '思考',
          '分析',
          '规划',
          '检索',
          '搜索',
          '调研',
        ])
      ) {
        return 'thinking'
      }
      if (
        includesAny(signal, [
          'review',
          'verify',
          'test',
          'check',
          '验收',
          '审核',
          '验证',
          '测试',
          '检查',
        ])
      ) {
        return 'reviewing'
      }
      return 'working'
    }
  }
}

function compactText(value: string, maxLength = 34): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized
}

function compareTasks(a: KanbanTask, b: KanbanTask): number {
  const statusDelta = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
  if (statusDelta !== 0) return statusDelta
  if (a.status === 'done' || a.status === 'failed' || a.status === 'cancelled') {
    return (b.finishedAt ?? b.updatedAt) - (a.finishedAt ?? a.updatedAt)
  }
  if (a.priority !== b.priority) return b.priority - a.priority
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return a.id.localeCompare(b.id)
}

/**
 * 把看板任务投影为办公室 worker。
 *
 * task.id 是稳定场景实体，roleId 决定角色身份，assigneeSessionId 绑定真实 worker 会话和形象。
 */
export function projectKanbanWorkers(
  tasks: KanbanTask[],
  roleLabels: Map<string, string>,
  liveProgressByTaskId: ReadonlyMap<string, ProgressLogEntry> = new Map()
): OfficeWorkerProjection {
  const visibleTasks = [...tasks].sort(compareTasks).slice(0, MAX_OFFICE_WORKERS)
  const agents = visibleTasks.map((task, slotIndex): OfficeAgent => {
    const desk = DESKS[slotIndex]!
    const progress = latestProgress(task, liveProgressByTaskId.get(task.id))
    const state = resolveOfficeWorkerState(task, progress)
    const roleId = task.roleId ?? 'generalist'
    const name = roleLabels.get(task.id) ?? roleId
    const detail =
      progress?.text || task.blockedReason || task.error || task.resultSummary || task.title
    const stateLabel = OFFICE_STATE_LABELS[state]
    const color = ROLE_COLORS[stableHash(roleId) % ROLE_COLORS.length]!

    return {
      id: task.id,
      taskId: task.id,
      roleId: task.roleId,
      workerSessionId: task.assigneeSessionId,
      taskStatus: task.status,
      appearanceKey: task.assigneeSessionId ?? `${roleId}:${task.id}`,
      progressText: progress?.text,
      lastToolName: progress?.lastToolName,
      name,
      color,
      x: desk.seatX,
      y: desk.seatY,
      state,
      currentTask: `${stateLabel} · ${compactText(detail)}`,
      assignedDeskId: desk.id,
      facing: slotIndex % 2 === 0 ? 1 : -1,
      viewFacing:
        state === 'working' || state === 'thinking' || state === 'reviewing' ? 'back' : 'front',
    }
  })

  return {
    agents,
    hiddenCount: Math.max(0, tasks.length - agents.length),
  }
}
