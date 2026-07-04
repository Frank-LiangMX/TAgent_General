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
  type KanbanChannelModelsGetter,
} from '@tagent/shared'
import type { KanbanDbService } from './kanban-db'
import { getRoleById } from './agent-role-service'
import { notifyTaskDone, notifyBoardCompleted } from './kanban-notification-service'

/** 工人执行器：领取 running 任务后调用，返回摘要或错误 */
export type KanbanWorkerRunner = (task: KanbanTask) => Promise<{ summary?: string; error?: string }>

/**
 * 渠道可用模型查询器（旧版，已废弃）
 *
 * @deprecated 请使用 KanbanChannelModelsGetter（支持跨渠道轮询 + kscc 合规检查）
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

  // ===== 模型分配配置（支持跨渠道轮询） =====

  /**
   * 渠道模型查询器（新版，支持跨渠道轮询 + kscc 合规检查）
   *
   * 推荐使用此接口替代旧的 getAvailableModels。
   * - kscc 看板：只从 kscc 内部分配（禁止跳外部）
   * - 外部 API 看板：可轮询所有外部渠道模型
   * - 角色库 channelId：可指定渠道，但需检查合规性
   */
  channelModelsGetter?: KanbanChannelModelsGetter

  /**
   * 根据模型 ID 反查所属渠道
   *
   * 用于检查显式指定 task.modelId 或角色库 modelPool 的合规性。
   *
   * @param modelId 模型 ID
   * @returns 该模型所属渠道 ID，找不到返回 undefined
   */
  findModelChannel?: (modelId: string) => string | undefined

  /**
   * 渠道可用模型查询器（旧版，已废弃）
   * @deprecated 请使用 channelModelsGetter
   */
  getAvailableModels?: KanbanAvailableModelsGetter

  /** 单模型最大并发数（静态值，避免降智，默认 2） */
  maxConcurrentPerModel?: number
  /** 单模型最大并发数动态查询器（设置页热更新用，优先于 maxConcurrentPerModel） */
  getMaxConcurrentPerModel?: () => number

  // ===== 看板完成回调 =====

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
 * 为任务分配模型 ID（支持跨外部渠道轮询 + kscc 合规检查）
 *
 * 核心改进（2026-07-04）：
 * - kscc 看板：只从 kscc 内部分配模型（禁止跳外部 API）
 * - 外部 API 看板：可轮询所有外部渠道模型（充分利用资源）
 * - 角色库 channelId：可指定渠道，但需检查合规性（kscc 看板不能跳外部）
 * - 显式指定 task.modelId：直接用，但 kscc 任务会检查是否合规
 *
 * 分配顺序：
 * 1. task.modelId 显式指定 → 检查合规性后直接用（kscc 任务禁止外部模型）
 * 2. task.roleId 存在 → 查角色库
 *    a. role.channelId 指定 → 检查合规性（kscc 看板不能跳外部）
 *    b. role.modelPool → 按顺序找未满的
 *    c. fallbackToChannelDefault → 回退到看板渠道范围内轮询
 * 3. 未指定 → 按看板渠道类型决定分配范围
 *    a. kscc 看板 → 只从 kscc 内部分配
 *    b. 外部 API 看板 → 轮询所有外部渠道模型
 * 4. 全满 → 返回 undefined（任务保持 ready）
 *
 * maxConcurrentPerModel 优先级：role.maxConcurrentPerModel > 全局 getMaxConcurrentPerModel() > 默认 2
 *
 * @param task 待分配的任务
 * @param boardId 看板 ID（用于模型计数）
 * @returns 分配到的 modelId，或 undefined（无可用模型，任务保持 ready）
 */
function assignModelForTask(task: KanbanTask, boardId: string): string | undefined {
  const opts = dispatcherOptions
  if (!opts) return task.modelId

  const getter = opts.channelModelsGetter
  const globalMaxPerModel = opts.getMaxConcurrentPerModel?.() ?? opts.maxConcurrentPerModel ?? 2

  // ========== 0. 无新 getter → 回退旧逻辑（兼容性） ==========
  if (!getter) {
    // 使用旧的 getAvailableModels（单渠道锁定）
    const oldGetter = opts.getAvailableModels
    if (!oldGetter) return task.modelId

    // 显式指定 → 直接用
    if (task.modelId) return task.modelId

    // 角色库逻辑（简化版）
    if (task.roleId) {
      const role = getRoleById(task.roleId)
      if (role && role.modelPool && role.modelPool.length > 0) {
        for (const modelId of role.modelPool) {
          const count = getOrCreateModelCounts(boardId).get(modelId) ?? 0
          if (count < (role.maxConcurrentPerModel ?? globalMaxPerModel)) {
            return modelId
          }
        }
        if (!role.fallbackToChannelDefault) return undefined
      }
    }

    // 单渠道轮询
    const available = oldGetter(task.channelId)
    return assignFromPool(available, undefined, boardId, globalMaxPerModel)
  }

  // ========== 1. 显式指定 task.modelId ==========
  if (task.modelId) {
    // 检查合规性：kscc 任务不能用外部模型
    // 用 task.channelId（继承自 board 或创建时指定）判断看板渠道类型
    if (getter.isKsccChannel(task.channelId)) {
      const modelChannel = opts.findModelChannel?.(task.modelId)
      if (modelChannel && !getter.isKsccChannel(modelChannel)) {
        console.warn(`[看板] kscc 任务禁止用外部模型 ${task.modelId}，忽略显式指定`)
        // 继续走下面的分配逻辑
      } else {
        return task.modelId // 合规，直接用
      }
    } else {
      // 外部看板：直接用显式指定（允许外部→kscc）
      return task.modelId
    }
  }

  // ========== 2. 角色库指定 ==========
  if (task.roleId) {
    const role = getRoleById(task.roleId)
    if (role) {
      // 2a. 检查角色 channelId 合规性
      if (role.channelId) {
        const board = opts.db.getBoard(boardId)
        // 用 task.channelId（继承自 board 或创建时指定）判断看板渠道类型
        if (board && getter.isKsccChannel(task.channelId) && !getter.isKsccChannel(role.channelId)) {
          console.warn(`[看板] kscc 看板禁止用外部角色 ${role.displayName}，回退到看板渠道`)
        } else {
          // 用角色指定的渠道（合规）
          const roleModels = getter.getModels(role.channelId)
          const assigned = assignFromPool(roleModels, role.modelPool, boardId, role.maxConcurrentPerModel ?? globalMaxPerModel)
          if (assigned) return assigned
          // 全满，继续 fallback
        }
      }

      // 2b. 无 role.channelId → 用角色 modelPool（从看板渠道范围内）
      if (role.modelPool && role.modelPool.length > 0) {
        const boardChannelModels = getBoardChannelModels(boardId, task.channelId, getter)
        const availableModels = role.modelPool.filter(m => boardChannelModels.includes(m))
        const assigned = assignFromPool(availableModels, role.modelPool, boardId, role.maxConcurrentPerModel ?? globalMaxPerModel)
        if (assigned) return assigned

        // 全满，检查是否 fallback
        if (!role.fallbackToChannelDefault) return undefined
      }
    }
  }

  // ========== 3. 未指定 → 按看板渠道类型分配 ==========
  const board = opts.db.getBoard(boardId)
  if (!board) return undefined

  if (getter.isKsccChannel(task.channelId)) {
    // kscc 看板：只从 kscc 内部分配
    const ksccModels = getter.getModels(task.channelId)
    return assignFromPool(ksccModels, undefined, boardId, globalMaxPerModel)
  } else {
    // 外部 API 看板：轮询所有外部渠道
    const externalChannels = getter.getExternalChannels()
    const allExternalModels = externalChannels.flatMap(ch => getter.getModels(ch))
    return assignFromPool(allExternalModels, undefined, boardId, globalMaxPerModel)
  }
}

/**
 * 从模型池分配模型（支持 modelPool 顺序优先 + round-robin 轮询）
 *
 * @param availableModels 可用模型列表（已过滤）
 * @param modelPool 角色库优先顺序（可选，按此顺序优先分配）
 * @param boardId 看板 ID（用于模型计数）
 * @param maxPerModel 单模型最大并发
 * @returns 分配到的 modelId，或 undefined（全满）
 */
function assignFromPool(
  availableModels: string[],
  modelPool: string[] | undefined,
  boardId: string,
  maxPerModel: number
): string | undefined {
  if (availableModels.length === 0) return undefined

  const modelCounts = getOrCreateModelCounts(boardId)

  // 1. 若有 modelPool，按顺序找第一个未满的
  if (modelPool && modelPool.length > 0) {
    for (const modelId of modelPool) {
      // 只考虑在 availableModels 内的（合规过滤）
      if (!availableModels.includes(modelId)) continue
      const count = modelCounts.get(modelId) ?? 0
      if (count < maxPerModel) return modelId
    }
  }

  // 2. 无 modelPool 或全满 → round-robin 轮询
  const cursor = modelRotationCursorByBoard.get(boardId) ?? 0
  for (let i = 0; i < availableModels.length; i++) {
    const idx = (cursor + i) % availableModels.length
    const modelId = availableModels[idx]!
    const count = modelCounts.get(modelId) ?? 0
    if (count < maxPerModel) {
      // 记录游标为下一个位置（下次从这里继续轮询）
      modelRotationCursorByBoard.set(boardId, (idx + 1) % availableModels.length)
      return modelId
    }
  }

  // 3. 全满
  return undefined
}

/**
 * 获取看板渠道范围内可用模型
 *
 * - kscc 看板 → 只返回 kscc 渠道模型
 * - 外部看板 → 返回所有外部渠道模型
 *
 * @param boardId 看板 ID（用于日志）
 * @param taskChannelId 任务渠道 ID（继承自 board 或创建时指定）
 * @param getter 渠道模型查询器
 */
function getBoardChannelModels(
  boardId: string,
  taskChannelId: string,
  getter: KanbanChannelModelsGetter
): string[] {
  if (getter.isKsccChannel(taskChannelId)) {
    return getter.getModels(taskChannelId)
  } else {
    const externalChannels = getter.getExternalChannels()
    return externalChannels.flatMap(ch => getter.getModels(ch))
  }
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

  // 看板完成通知（Phase C）
  if (board) {
    void notifyBoardCompleted(board, { total: allTasks.length, done, failed })
  }

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

      // 任务完成通知（Phase C）
      const board = db.getBoard(boardId)
      if (board) {
        // 重新读取任务以获取最新状态（含 assigneeSessionId）
        const updatedTask = db.getTask(task.id)
        if (updatedTask) {
          void notifyTaskDone(board, updatedTask)
        }
      }
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
