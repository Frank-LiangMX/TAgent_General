/**
 * Kanban 数字员工统计服务
 *
 * 主进程启动时扫描全量 kanban.db 计算一次（异步，不阻塞 UI），
 * 之后增量更新（任务状态变化时广播，渲染层自行决定是否刷新）。
 *
 * 统计结果缓存于内存，GET_CREW_STATS IPC 直接返回缓存。
 */

import type { KanbanTask, RoleWorkStats, PeriodStats, KanbanCrewStats } from '@tagent/shared'
import { kanbanDbService } from './kanban-db'

/** 时间窗口边界（ms） */
function dayStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function weekStart(): number {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function monthStart(): number {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function periodStats(tasks: KanbanTask[], since: number): PeriodStats {
  const relevant = tasks.filter(
    (t) =>
      t.status === 'done' ||
      t.status === 'failed' ||
      (t.status === 'running' && t.startedAt != null)
  )
  const doneOrFailed = relevant.filter((t) => t.status === 'done' || t.status === 'failed')
  const inWindow = doneOrFailed.filter((t) => t.finishedAt != null && t.finishedAt >= since)
  const totalDurationMs = inWindow.reduce((sum, t) => {
    if (t.startedAt == null || t.finishedAt == null) return sum
    return sum + (t.finishedAt - t.startedAt)
  }, 0)
  const count = inWindow.length
  return {
    taskCount: count,
    totalDurationMs,
    avgDurationMs: count > 0 ? Math.round(totalDurationMs / count) : 0,
  }
}

function computeRoleWorkStats(tasks: KanbanTask[], roleId: string): RoleWorkStats {
  const roleTasks = tasks.filter((t) => t.roleId === roleId)
  const doneOrFailed = roleTasks.filter((t) => t.status === 'done' || t.status === 'failed')
  const totalDurationMs = doneOrFailed.reduce((sum, t) => {
    if (t.startedAt == null || t.finishedAt == null) return sum
    return sum + (t.finishedAt - t.startedAt)
  }, 0)
  const failedCount = roleTasks.filter((t) => t.status === 'failed').length
  return {
    roleId,
    totalTasks: doneOrFailed.length,
    totalDurationMs,
    avgDurationMs: doneOrFailed.length > 0 ? Math.round(totalDurationMs / doneOrFailed.length) : 0,
    failedCount,
    windows: {
      day: periodStats(roleTasks, dayStart()),
      week: periodStats(roleTasks, weekStart()),
      month: periodStats(roleTasks, monthStart()),
    },
  }
}

/** 角色 ID 列表（去重，稳定顺序） */
function collectRoleIds(tasks: KanbanTask[]): string[] {
  const seen = new Set<string>()
  for (const t of tasks) {
    if (t.roleId) seen.add(t.roleId)
  }
  return Array.from(seen).sort()
}

function computeCrewStats(tasks: KanbanTask[]): KanbanCrewStats {
  const roleIds = collectRoleIds(tasks)
  const byRole = roleIds.map((id) => computeRoleWorkStats(tasks, id))
  const doneOrFailed = tasks.filter((t) => t.status === 'done' || t.status === 'failed')
  const totalDurationMs = doneOrFailed.reduce((sum, t) => {
    if (t.startedAt == null || t.finishedAt == null) return sum
    return sum + (t.finishedAt - t.startedAt)
  }, 0)
  const activeCount = tasks.filter((t) => t.status === 'running').length
  return {
    byRole,
    totalTasks: doneOrFailed.length,
    totalDurationMs,
    activeCount,
  }
}

class KanbanCrewStatsService {
  private cache: KanbanCrewStats | null = null
  private computing = false

  async compute(): Promise<KanbanCrewStats> {
    if (this.cache) return this.cache
    if (this.computing) {
      // 等待计算完成
      await new Promise<void>((resolve) => {
        const check = (): void => {
          if (!this.computing) resolve()
          else setTimeout(check, 50)
        }
        check()
      })
      return this.cache!
    }
    this.computing = true
    try {
      if (!kanbanDbService.isInitialized()) {
        const result = kanbanDbService.initialize()
        if (!result.success) throw new Error(result.error)
      }
      const tasks = kanbanDbService.listAllTasks()
      this.cache = computeCrewStats(tasks)
      console.log(`[看板统计] 已计算 ${tasks.length} 条任务，${this.cache.byRole.length} 个角色`)
      return this.cache
    } finally {
      this.computing = false
    }
  }

  /** 任务状态变更时调用，增量更新缓存 */
  invalidate(): void {
    this.cache = null
  }

  get(): KanbanCrewStats | null {
    return this.cache
  }
}

export const kanbanCrewStatsService = new KanbanCrewStatsService()
