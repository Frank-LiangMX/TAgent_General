/**
 * Kanban 看板调度器
 *
 * 核心设计（参考 automation-scheduler.ts）：
 * - 30s tick 轮询 ready 任务，按 per-board maxConcurrent 上限派工
 * - 工人完成 → 事件驱动立即重派（不等下一个 tick，提升吞吐）
 * - WorkerRunner 由外部注入（Phase A 只做内核，不绑定 Agent SDK）
 * - runningTasksByBoard Map 防止同一任务重入 + 控制 per-board 并发上限
 * - 状态机：pending → ready → running → done/failed
 *
 * B5：per-board 并发隔离 + 暂停隔离
 * - 全局单 timer，tick 时遍历所有 dispatchable boards（status=active && !paused）
 * - 每个 board 按 own maxConcurrent 派工，互不影响
 * - pauseKanbanBoard 改为标记 board.paused=true，不再停全局 timer
 *
 * 模型分配（避免并行降智）：
 * - runningModelsByBoard: Map<boardId, Map<modelId, count>> 跟踪每 board 各模型在途数
 * - 派工时若 task.modelId 显式指定 → 直接用
 * - 未指定 → 按 getAvailableModels(channelId) 返回的渠道已有模型 round-robin
 * - 单模型并发超 maxConcurrentPerModel → 换下一个可用模型
 * - 全满 → 任务保持 ready，等下一个 worker 释放
 *
 * 与 automation-scheduler 命名隔离：日志前缀 [看板]，不混用。
 */

import {
  KANBAN_TICK_INTERVAL_MS,
  KANBAN_DEFAULT_MAX_CONCURRENT,
  type KanbanTask,
} from '@tagent/shared'
import type { KanbanDbService } from './kanban-db'
import { getRoleById } from './agent-role-service'

/** 工人执行器：领取 running 任务后调用，返回摘要或错误 */
export type KanbanWorkerRunner = (task: KanbanTask) => Promise<{ summary?: string; error?: string }>

/**
 * 渠道可用模型查询器
 *
 * 返回指定渠道的所有已启用模型 ID 列表（用于 dispatcher 轮询分配，避免同模型过度并发降智）。
 * 调用方注入真实实现（读 channel.models），测试可注入 mock。
 */
export type KanbanAvailableModelsGetter = (channelId: string) => string[]

/** 调度器配置（由外部注入 runner + db + 可选变更回调） */
export interface KanbanDispatcherOptions {
  /** 工人执行器 */
  runner: KanbanWorkerRunner
  /** 看板数据库服务 */
  db: KanbanDbService
  /** 状态变更回调（用于触发 UI 广播，避免 dispatcher 直接依赖 kanban-ipc） */
  onTaskStatusChanged?: (taskId: string, status: string) => void
  /** 渠道可用模型查询器（用于模型轮询分配，可选，未注入则用 task.modelId 或渠道默认） */
  getAvailableModels?: KanbanAvailableModelsGetter
  /** 单模型最大并发数（静态值，避免降智，默认 2） */
  maxConcurrentPerModel?: number
  /** 单模型最大并发数动态查询器（设置页热更新用，优先于 maxConcurrentPerModel） */
  getMaxConcurrentPerModel?: () => number
  /** 看板全部任务完成回调（事件回流方案 B）
   *
   * 触发条件：某 worker 完成后，检测该 board 下所有任务均进入终态（done/failed/cancelled），
   * 且 board 之前不是已完成状态。回调参数：
   * - boardId：完成的看板 ID
   * - parentSessionId：看板绑定的主会话 ID（无则 undefined）
   * - requireSummary：是否需要主会话汇总（B9，true 时回调方应自动注入 user 消息触发主会话）
   * - summary：完成统计 { total, done, failed }
   */
  onBoardCompleted?: (
    boardId: string,
    parentSessionId: string | undefined,
    requireSummary: boolean,
    summary: { total: number; done: number; failed: number }
  ) => void
}

let tickTimer: ReturnType<typeof setInterval> | null = null
let dispatcherOptions: KanbanDispatcherOptions | null = null
/** per-board 在途任务集合：boardId → Set<taskId>（B5 并发隔离） */
const runningTasksByBoard = new Map<string, Set<string>>()
/** per-board 各模型在途计数：boardId → Map<modelId, count>（避免同模型过度并发降智） */
const runningModelsByBoard = new Map<string, Map<string, number>>()
/** per-board 模型轮询游标：boardId → 上次分配的模型 index（round-robin） */
const modelRotationCursorByBoard = new Map<string, number>()
/** 已触发 onBoardCompleted 的 boardId 集合（避免重复通知） */
const notifiedCompletedBoards = new Set<string>()

/**
 * 配置调度器（注入 WorkerRunner + db）
 *
 * 必须在 startKanbanDispatcher 之前调用。
 */
export function configureKanbanDispatcher(options: KanbanDispatcherOptions): void {
  dispatcherOptions = options
  console.log('[看板] 调度器已配置（per-board 并发隔离 + 模型轮询）')
}

/**
 * 为任务分配模型 ID（避免同模型过度并发降智）
 *
 * 分配顺序：
 * 1. task.modelId 显式指定 → 直接用（用户/Agent 手动指定，最高优先级）
 * 2. task.roleId 存在 → 查角色库，按 role.modelPool 顺序找未满 role.maxConcurrentPerModel 的
 *    a. modelPool 全满且 fallbackToChannelDefault=true → 回退到渠道可用模型 round-robin
 *    b. modelPool 全满且 fallbackToChannelDefault=false → 返回 undefined（任务保持 ready）
 * 3. task.roleId 为空 → 从渠道可用模型 round-robin（现有逻辑）
 * 4. 全满 → 返回 undefined（任务保持 ready，等下一个 worker 释放）
 *
 * maxConcurrentPerModel 优先级：role.maxConcurrentPerModel > 全局 getMaxConcurrentPerModel() > 默认 2
 *
 * @returns 分配到的 modelId，或 undefined（无可用模型，任务保持 ready）
 */
function assignModelForTask(task: KanbanTask, boardId: string): string | undefined {
  const opts = dispatcherOptions
  if (!opts) return task.modelId
  // 动态读全局 maxConcurrentPerModel（支持设置页热更新）
  const globalMaxPerModel = opts.getMaxConcurrentPerModel?.() ?? opts.maxConcurrentPerModel ?? 2

  // 1. 显式指定 → 直接用（不检查并发上限，用户显式指定优先级最高）
  if (task.modelId) return task.modelId

  // 2. task 绑定 roleId → 查角色库，按 modelPool 分配
  if (task.roleId) {
    const role = getRoleById(task.roleId)
    if (role) {
      const modelCounts = getOrCreateModelCounts(boardId)
      const roleMaxPerModel = role.maxConcurrentPerModel ?? globalMaxPerModel

      // 按 modelPool 顺序找第一个未满的
      for (const modelId of role.modelPool) {
        const count = modelCounts.get(modelId) ?? 0
        if (count < roleMaxPerModel) {
          return modelId
        }
      }

      // modelPool 全满，检查是否回退到渠道默认
      if (!role.fallbackToChannelDefault) {
        return undefined // 不回退，任务保持 ready
      }
      // fallback 到渠道可用模型 round-robin（继续走下面的逻辑）
    } else {
      console.warn(`[看板] 角色 ${task.roleId} 不存在，回退到渠道模型轮询`)
    }
  }

  // 3. 未指定 roleId 或角色不存在或 fallback → 从渠道可用模型轮询
  const getter = opts.getAvailableModels
  if (!getter) return undefined
  const available = getter(task.channelId)
  if (available.length === 0) return undefined

  const modelCounts = getOrCreateModelCounts(boardId)
  const cursor = modelRotationCursorByBoard.get(boardId) ?? 0

  // round-robin 从游标位置开始找第一个未满的
  for (let i = 0; i < available.length; i++) {
    const idx = (cursor + i) % available.length
    const modelId = available[idx]!
    const count = modelCounts.get(modelId) ?? 0
    if (count < globalMaxPerModel) {
      // 记录游标为下一个位置（下次从这里继续轮询）
      modelRotationCursorByBoard.set(boardId, (idx + 1) % available.length)
      return modelId
    }
  }
  // 全满
  return undefined
}

/** 获取或创建某 board 的模型在途计数 Map */
function getOrCreateModelCounts(boardId: string): Map<string, number> {
  let map = runningModelsByBoard.get(boardId)
  if (!map) {
    map = new Map()
    runningModelsByBoard.set(boardId, map)
  }
  return map
}

/** 递增某 board 的某模型在途计数 */
function incrementModelCount(boardId: string, modelId: string): void {
  const map = getOrCreateModelCounts(boardId)
  map.set(modelId, (map.get(modelId) ?? 0) + 1)
}

/** 递减某 board 的某模型在途计数（清理空 key） */
function decrementModelCount(boardId: string, modelId: string): void {
  const map = getOrCreateModelCounts(boardId)
  const next = (map.get(modelId) ?? 0) - 1
  if (next <= 0) {
    map.delete(modelId)
  } else {
    map.set(modelId, next)
  }
}

/**
 * 检测 board 是否全部任务终态，是则触发 onBoardCompleted 回调
 *
 * 触发条件：
 * - board 下所有任务均为终态（done/failed/cancelled）
 * - 且该 board 之前未触发过完成回调（避免重复通知）
 *
 * 不触发的情况：
 * - board 没有任务（total=0）
 * - 还有 pending/ready/running/blocked/review 任务
 * - 已通知过（notifiedCompletedBoards 里有）
 *
 * 在 worker 完成后调用，用于事件回流通知主会话。
 */
function checkBoardCompletion(boardId: string): void {
  const opts = dispatcherOptions
  if (!opts?.onBoardCompleted) return
  // 避免重复通知：已通知过的 board 跳过
  if (notifiedCompletedBoards.has(boardId)) return
  const db = opts.db
  const allTasks = db.listTasksByBoard(boardId)
  if (allTasks.length === 0) return
  const terminalStatuses = new Set(['done', 'failed', 'cancelled'])
  const allTerminal = allTasks.every((t) => terminalStatuses.has(t.status))
  if (!allTerminal) return
  // 全部终态，触发回调
  const done = allTasks.filter((t) => t.status === 'done').length
  const failed = allTasks.filter((t) => t.status === 'failed').length
  const board = db.getBoard(boardId)
  const requireSummary = board?.requireSummary === true
  notifiedCompletedBoards.add(boardId)
  try {
    opts.onBoardCompleted(boardId, board?.parentSessionId, requireSummary, {
      total: allTasks.length,
      done,
      failed,
    })
    console.log(
      `[看板] 看板完成: ${boardId} (${done}/${allTasks.length} done, ${failed} failed, requireSummary=${requireSummary})`
    )
  } catch (err) {
    console.error(`[看板] onBoardCompleted 回调异常: ${boardId}`, err)
  }
}

/**
 * 单次调度循环（B5：per-board 派工 + 模型轮询）：
 * 1. 依赖解析（pending → ready）
 * 2. 列出所有 dispatchable boards（status=active && !paused）
 * 3. 对每个 board：领取 ready 任务直到达到该 board 的 maxConcurrent
 *    - 任务分配模型（显式指定优先，否则轮询渠道模型避免降智）
 *    - 无可用模型时任务保持 ready，等下一个 worker 释放
 *
 * 同步函数，不返回 Promise；工人异步执行，完成时事件驱动重派。
 */
export function dispatchKanbanTick(): void {
  if (!dispatcherOptions) return
  const { db, runner, onTaskStatusChanged } = dispatcherOptions

  // 依赖解析：将依赖已满足的 pending 任务提升为 ready
  const promoted = db.resolveReadyTasks()
  if (promoted.length > 0 && onTaskStatusChanged) {
    // 依赖晋升也是状态变更，通知 UI 刷新
    onTaskStatusChanged('', 'ready')
  }

  // 列出所有可调度的看板（status=active && !paused）
  const boards = db.listDispatchableBoards()
  for (const board of boards) {
    const runningSet = getOrCreateRunningSet(board.id)
    const maxConcurrent = board.maxConcurrent ?? KANBAN_DEFAULT_MAX_CONCURRENT
    if (runningSet.size >= maxConcurrent) continue

    const readyTasks = db.listTasksByBoardAndStatus(board.id, 'ready')
    for (const task of readyTasks) {
      if (runningSet.size >= maxConcurrent) break
      if (runningSet.has(task.id)) continue

      // 分配模型：显式指定优先，否则轮询渠道模型避免降智
      const assignedModelId = assignModelForTask(task, board.id)
      if (!assignedModelId && !task.modelId) {
        // 无可用模型（渠道模型全满），任务保持 ready，跳过本轮派工
        continue
      }

      runningSet.add(task.id)
      // 记录模型在途计数（用于降智预防）
      if (assignedModelId) {
        incrementModelCount(board.id, assignedModelId)
      }
      // 把分配的 modelId 写回 task 对象 + DB（worker 执行时读 task.modelId）
      // 注：用 db.updateTaskModel 不触发状态机副作用
      db.updateTaskModel(task.id, assignedModelId)
      // 更新内存中的 task 对象，确保 runWorker 拿到的是分配后的 modelId
      task.modelId = assignedModelId
      db.updateTaskStatus(task.id, { status: 'running' })
      onTaskStatusChanged?.(task.id, 'running')
      console.log(
        `[看板] 任务派工: ${task.id} (${task.title}) | board=${board.id} ${runningSet.size}/${maxConcurrent} | model=${assignedModelId ?? '未分配'}`
      )
      void runWorker(task, board.id, runner, db)
    }
  }
}

/** 获取或创建某 board 的在途任务集合 */
function getOrCreateRunningSet(boardId: string): Set<string> {
  let set = runningTasksByBoard.get(boardId)
  if (!set) {
    set = new Set()
    runningTasksByBoard.set(boardId, set)
  }
  return set
}

/** 工人执行：调用 runner，根据结果更新任务状态，完成后事件驱动重派 */
async function runWorker(
  task: KanbanTask,
  boardId: string,
  runner: KanbanWorkerRunner,
  db: KanbanDbService
): Promise<void> {
  const { onTaskStatusChanged } = dispatcherOptions ?? {}
  try {
    const result = await runner(task)
    if (result.error) {
      db.updateTaskStatus(task.id, { status: 'failed', error: result.error })
      onTaskStatusChanged?.(task.id, 'failed')
      console.warn(`[看板] 任务失败: ${task.id} (${task.title}) — ${result.error}`)
    } else {
      db.updateTaskStatus(task.id, { status: 'done', resultSummary: result.summary })
      onTaskStatusChanged?.(task.id, 'done')
      console.log(`[看板] 任务完成: ${task.id} (${task.title})`)
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : '未知错误'
    db.updateTaskStatus(task.id, { status: 'failed', error })
    onTaskStatusChanged?.(task.id, 'failed')
    console.error(`[看板] 任务异常: ${task.id} (${task.title}) —`, err)
  } finally {
    const runningSet = runningTasksByBoard.get(boardId)
    if (runningSet) {
      runningSet.delete(task.id)
      // 清理空集合，避免 Map 无限增长
      if (runningSet.size === 0) runningTasksByBoard.delete(boardId)
    }
    // 递减模型在途计数（worker 完成释放模型槽位）
    const assignedModel = task.modelId
    if (assignedModel) {
      decrementModelCount(boardId, assignedModel)
    }
    // 检测 board 是否全部任务终态，触发 onBoardCompleted 事件回流
    checkBoardCompletion(boardId)
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

/** 当前所有 board 的在途任务 ID 并集（只读视图，测试用） */
export function getRunningTaskIds(): ReadonlySet<string> {
  const all = new Set<string>()
  for (const set of runningTasksByBoard.values()) {
    for (const id of set) all.add(id)
  }
  return all
}

/** 某 board 的在途任务 ID（只读视图，测试用） */
export function getRunningTaskIdsByBoard(boardId: string): ReadonlySet<string> {
  return runningTasksByBoard.get(boardId) ?? new Set()
}

/** 重置调度器状态（清空配置 + 在途集合 + 模型计数 + 完成通知记录，测试用） */
export function resetKanbanDispatcher(): void {
  stopKanbanDispatcher()
  dispatcherOptions = null
  runningTasksByBoard.clear()
  runningModelsByBoard.clear()
  modelRotationCursorByBoard.clear()
  notifiedCompletedBoards.clear()
}
