import type { KanbanTask, KanbanTaskStatus, ProgressLogEntry } from '@tagent/shared'

import { DESKS } from './scene/layout/officeLayout'
import type { OfficeAgent, OfficeAgentState } from './types/office-agent'
import type { OfficeActor, OfficeAssignment, OfficeSemanticState } from './types/office-actor'

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

export const OFFICE_SEMANTIC_LABELS: Record<OfficeSemanticState, string> = {
  listening: '倾听中',
  thinking: '分析中',
  planning: '规划中',
  summoning: '召集中',
  briefing: '任务沟通',
  working: '工作中',
  supervising: '巡视验收',
  blocked: '等待协助',
  awaiting_review: '等待验收',
  delivering: '正在交付',
  reworking: '返工中',
  reporting: '汇报中',
  ambient: '空闲活动',
  failed: '需要复盘',
  off_duty: '已撤岗',
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
  unassignedCount: number
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

function semanticStateFor(task: KanbanTask, state: OfficeAgentState): OfficeSemanticState {
  if (task.status === 'blocked') return 'blocked'
  if (task.status === 'review') return 'awaiting_review'
  if (task.status === 'done') return 'ambient'
  if (task.status === 'failed') return 'failed'
  if (task.status === 'cancelled') return 'off_duty'
  if (task.status === 'pending' || task.status === 'ready') return 'briefing'
  if (state === 'thinking') return 'thinking'
  if (state === 'reviewing') return 'awaiting_review'
  return 'working'
}

function buildAssignment(
  task: KanbanTask,
  progress: ProgressLogEntry | undefined
): OfficeAssignment {
  return {
    taskId: task.id,
    title: task.title,
    status: task.status,
    detail: progress?.text || task.blockedReason || task.error || task.resultSummary || task.title,
    progressText: progress?.text,
    lastToolName: progress?.lastToolName,
  }
}

function staffedTaskGroups(tasks: KanbanTask[]): Map<string, KanbanTask[]> {
  const groups = new Map<string, KanbanTask[]>()
  for (const task of tasks) {
    if (!task.assigneeSessionId) continue
    const current = groups.get(task.assigneeSessionId) ?? []
    current.push(task)
    groups.set(task.assigneeSessionId, current)
  }
  return groups
}

/**
 * 把看板任务投影为办公室 worker。
 *
 * assigneeSessionId 是稳定员工身份，task.id 只表示当前 assignment。
 * 尚未领取的任务不会提前创建“幽灵员工”。
 */
export function projectKanbanWorkers(
  tasks: KanbanTask[],
  roleLabels: Map<string, string>,
  liveProgressByTaskId: ReadonlyMap<string, ProgressLogEntry> = new Map()
): OfficeWorkerProjection {
  const groups = staffedTaskGroups(tasks)
  const staffedWorkers = [...groups.entries()]
    .map(([sessionId, workerTasks]) => ({
      sessionId,
      task: [...workerTasks].sort(compareTasks)[0]!,
    }))
    .sort((a, b) => compareTasks(a.task, b.task))
  const visibleWorkers = staffedWorkers.slice(0, MAX_OFFICE_WORKERS)
  const agents = visibleWorkers.map(({ sessionId, task }, slotIndex): OfficeAgent => {
    const desk = DESKS[slotIndex]!
    const progress = latestProgress(task, liveProgressByTaskId.get(task.id))
    const state = resolveOfficeWorkerState(task, progress)
    const roleId = task.roleId ?? 'generalist'
    const name = roleLabels.get(task.id) ?? roleId
    const assignment = buildAssignment(task, progress)
    const stateLabel = OFFICE_STATE_LABELS[state]
    const color = ROLE_COLORS[stableHash(roleId) % ROLE_COLORS.length]!
    const actor: OfficeActor = {
      actorId: `worker:${sessionId}`,
      kind: 'worker',
      sessionId,
      roleId: task.roleId,
      appearanceKey: sessionId,
      displayName: name,
    }

    return {
      kind: 'worker',
      actor,
      assignment,
      semanticState: semanticStateFor(task, state),
      id: actor.actorId,
      taskId: task.id,
      roleId: task.roleId,
      workerSessionId: sessionId,
      taskStatus: task.status,
      appearanceKey: actor.appearanceKey,
      progressText: progress?.text,
      lastToolName: progress?.lastToolName,
      name,
      color,
      x: desk.seatX,
      y: desk.seatY,
      state,
      currentTask: `${stateLabel} · ${compactText(assignment.detail)}`,
      assignedDeskId: desk.id,
      facing: slotIndex % 2 === 0 ? 1 : -1,
      viewFacing:
        state === 'working' || state === 'thinking' || state === 'reviewing' ? 'back' : 'front',
    }
  })

  return {
    agents,
    hiddenCount: Math.max(0, staffedWorkers.length - agents.length),
    unassignedCount: tasks.filter((task) => !task.assigneeSessionId).length,
  }
}
