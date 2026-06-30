/**
 * Kanban 看板调度器
 *
 * 核心设计（参考 automation-scheduler.ts）：
 * - 30s tick 轮询 ready 任务，按 maxConcurrent 上限派工
 * - 工人完成 → 事件驱动立即重派（不等下一个 tick，提升吞吐）
 * - WorkerRunner 由外部注入（Phase A 只做内核，不绑定 Agent SDK）
 * - runningTaskIds 集合防止同一任务重入
 * - 状态机：pending → ready → running → done/failed
 *
 * 与 automation-scheduler 命名隔离：日志前缀 [看板]，不混用。
 */

import {
  KANBAN_TICK_INTERVAL_MS,
  KANBAN_DEFAULT_MAX_CONCURRENT,
  type KanbanTask,
} from '@tagent/shared'
import type { KanbanDbService } from './kanban-db'

/** 工人执行器：领取 running 任务后调用，返回摘要或错误 */
export type KanbanWorkerRunner = (
  task: KanbanTask
) => Promise<{ summary?: string; error?: string }>

/** 调度器配置（由外部注入 runner + db + 可选并发上限） */
export interface KanbanDispatcherOptions {
  /** 工人执行器 */
  runner: KanbanWorkerRunner
  /** 看板数据库服务 */
  db: KanbanDbService
  /** 最大并发任务数（默认 3，探索期保守） */
  maxConcurrent?: number
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let dispatcherOptions: KanbanDispatcherOptions | null = null
/** 正在执行中的任务 ID 集合，防止重入 + 控制并发上限 */
const runningTaskIds = new Set<string>()

/**
 * 配置调度器（注入 WorkerRunner + db + 可选并发上限）
 *
 * 必须在 startKanbanDispatcher 之前调用。
 */
export function configureKanbanDispatcher(options: KanbanDispatcherOptions): void {
  dispatcherOptions = options
  console.log(
    `[看板] 调度器已配置，最大并发 ${options.maxConcurrent ?? KANBAN_DEFAULT_MAX_CONCURRENT}`
  )
}

/**
 * 单次调度循环：
 * 1. 依赖解析（pending → ready）
 * 2. 领取 ready 任务直到达到 maxConcurrent
 *
 * 同步函数，不返回 Promise；工人异步执行，完成时事件驱动重派。
 */
export function dispatchKanbanTick(): void {
  if (!dispatcherOptions) return
  const { db, runner, maxConcurrent = KANBAN_DEFAULT_MAX_CONCURRENT } = dispatcherOptions

  // 依赖解析：将依赖已满足的 pending 任务提升为 ready
  db.resolveReadyTasks()

  // 领取 ready 任务
  const readyTasks = db.listTasksByStatus('ready')
  for (const task of readyTasks) {
    if (runningTaskIds.size >= maxConcurrent) break
    if (runningTaskIds.has(task.id)) continue

    runningTaskIds.add(task.id)
    db.updateTaskStatus(task.id, { status: 'running' })
    console.log(`[看板] 任务派工: ${task.id} (${task.title})`)
    void runWorker(task, runner, db)
  }
}

/** 工人执行：调用 runner，根据结果更新任务状态，完成后事件驱动重派 */
async function runWorker(
  task: KanbanTask,
  runner: KanbanWorkerRunner,
  db: KanbanDbService
): Promise<void> {
  try {
    const result = await runner(task)
    if (result.error) {
      db.updateTaskStatus(task.id, { status: 'failed', error: result.error })
      console.warn(`[看板] 任务失败: ${task.id} (${task.title}) — ${result.error}`)
    } else {
      db.updateTaskStatus(task.id, { status: 'done', resultSummary: result.summary })
      console.log(`[看板] 任务完成: ${task.id} (${task.title})`)
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : '未知错误'
    db.updateTaskStatus(task.id, { status: 'failed', error })
    console.error(`[看板] 任务异常: ${task.id} (${task.title}) —`, err)
  } finally {
    runningTaskIds.delete(task.id)
    // 事件驱动重派：工人释放槽位后立即尝试领取下一个 ready 任务
    dispatchKanbanTick()
  }
}

/**
 * 启动调度器
 *
 * 立即执行一次 tick（拾起启动前已就绪的任务），随后按 30s 周期轮询。
 * 幂等：重复调用不会启动多个定时器。
 */
export function startKanbanDispatcher(): void {
  if (tickTimer) return
  if (!dispatcherOptions) {
    console.warn('[看板] 调度器未配置，请先调用 configureKanbanDispatcher')
    return
  }
  // 启动时立即派工一次，避免冷启动延迟
  dispatchKanbanTick()
  tickTimer = setInterval(dispatchKanbanTick, KANBAN_TICK_INTERVAL_MS)
  console.log(`[看板] 调度器已启动，tick 周期 ${KANBAN_TICK_INTERVAL_MS / 1000}s`)
}

/** 停止调度器（清理定时器，不清空在途任务） */
export function stopKanbanDispatcher(): void {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
    console.log('[看板] 调度器已停止')
  }
}

/** 当前正在执行的任务 ID 集合（只读视图，测试用） */
export function getRunningTaskIds(): ReadonlySet<string> {
  return runningTaskIds
}

/** 重置调度器状态（清空配置 + 在途集合，测试用） */
export function resetKanbanDispatcher(): void {
  stopKanbanDispatcher()
  dispatcherOptions = null
  runningTaskIds.clear()
}
