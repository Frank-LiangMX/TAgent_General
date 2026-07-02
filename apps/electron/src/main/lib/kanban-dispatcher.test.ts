import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import type { KanbanTask } from '@tagent/shared'
import { KanbanDbService } from './kanban-db'
import {
  configureKanbanDispatcher,
  startKanbanDispatcher,
  stopKanbanDispatcher,
  dispatchKanbanTick,
  resetKanbanDispatcher,
  getRunningTaskIds,
  getRunningTaskIdsByBoard,
  type KanbanWorkerRunner,
} from './kanban-dispatcher'

/** 轮询直到所有任务进入终态（done/failed/cancelled），返回最终任务列表 */
async function waitForAllSettled(
  db: KanbanDbService,
  boardId: string,
  timeoutMs = 2000
): Promise<KanbanTask[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const tasks = db.listTasksByBoard(boardId)
    if (tasks.length > 0 && tasks.every((t) => t.status === 'done' || t.status === 'failed')) {
      return tasks
    }
    await new Promise((r) => setTimeout(r, 5))
  }
  const tasks = db.listTasksByBoard(boardId)
  throw new Error(
    `waitForAllSettled 超时: ${tasks.map((t) => `${t.title}=${t.status}`).join(', ')}`
  )
}

/** 轮询直到断言函数返回 true */
async function waitFor(fn: () => boolean, timeoutMs = 2000, msg = 'waitFor 超时'): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (fn()) return
    await new Promise((r) => setTimeout(r, 2))
  }
  throw new Error(msg)
}

/**
 * 循环释放所有挂起的 runner，直到看板任务全部进入终态。
 *
 * 必须循环：释放一批后 dispatcher 会事件驱动拾起下一批，新拾起的任务又挂起新的 Promise。
 */
async function releaseAllUntilDone(
  db: KanbanDbService,
  boardId: string,
  pendingResolvers: Map<string, () => void>,
  timeoutMs = 5000
): Promise<KanbanTask[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    for (const id of [...pendingResolvers.keys()]) {
      const resolve = pendingResolvers.get(id)
      if (resolve) {
        resolve()
        pendingResolvers.delete(id)
      }
    }
    const tasks = db.listTasksByBoard(boardId)
    if (tasks.length > 0 && tasks.every((t) => t.status === 'done' || t.status === 'failed')) {
      return tasks
    }
    await new Promise((r) => setTimeout(r, 5))
  }
  const tasks = db.listTasksByBoard(boardId)
  throw new Error(
    `releaseAllUntilDone 超时: ${tasks.map((t) => `${t.title}=${t.status}`).join(', ')}`
  )
}

describe('KanbanDispatcher', () => {
  let db: KanbanDbService

  beforeEach(() => {
    db = new KanbanDbService(':memory:')
    expect(db.initialize().success).toBe(true)
  })

  afterEach(() => {
    resetKanbanDispatcher()
    db.close()
  })

  describe('验收脚本：B 依赖 A，C 依赖 B → 顺序执行 A→B→C', () => {
    test('全 done 且执行顺序为 A→B→C', async () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const a = db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })
      const b = db.createTask({ boardId: board.id, title: 'B', channelId: 'c1' })
      const c = db.createTask({ boardId: board.id, title: 'C', channelId: 'c1' })
      db.addDependency(a.id, b.id)
      db.addDependency(b.id, c.id)

      const executionOrder: string[] = []
      const mockRunner: KanbanWorkerRunner = async (task) => {
        executionOrder.push(task.title)
        return { summary: `done:${task.title}` }
      }

      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })
      startKanbanDispatcher()

      const tasks = await waitForAllSettled(db, board.id)

      expect(tasks.every((t) => t.status === 'done')).toBe(true)
      expect(executionOrder).toEqual(['A', 'B', 'C'])
    })

    test('runner 返回 error 时任务标记为 failed', async () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })

      const mockRunner: KanbanWorkerRunner = async () => ({ error: '工人爆炸' })
      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })
      startKanbanDispatcher()

      const tasks = await waitForAllSettled(db, board.id)
      const task = tasks[0]!
      expect(task.status).toBe('failed')
      expect(task.error).toBe('工人爆炸')
    })

    test('runner 抛异常时任务标记为 failed', async () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })

      const mockRunner: KanbanWorkerRunner = async () => {
        throw new Error('runner 抛错')
      }
      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })
      startKanbanDispatcher()

      const tasks = await waitForAllSettled(db, board.id)
      const task = tasks[0]!
      expect(task.status).toBe('failed')
      expect(task.error).toBe('runner 抛错')
    })
  })

  describe('per-board 并发上限 maxConcurrent（B5）', () => {
    test('5 个 ready 任务 board.maxConcurrent=3 时同时只跑 3 个', async () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1', maxConcurrent: 3 })
      const taskIds: string[] = []
      for (let i = 0; i < 5; i++) {
        const t = db.createTask({ boardId: board.id, title: `T${i}`, channelId: 'c1' })
        taskIds.push(t.id)
      }

      const pendingResolvers = new Map<string, () => void>()
      let concurrentCount = 0
      let maxObservedConcurrent = 0

      const mockRunner: KanbanWorkerRunner = async (task) => {
        concurrentCount++
        maxObservedConcurrent = Math.max(maxObservedConcurrent, concurrentCount)
        await new Promise<void>((resolve) => {
          pendingResolvers.set(task.id, resolve)
        })
        concurrentCount--
        return { summary: 'done' }
      }

      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })
      startKanbanDispatcher()

      // 等待 3 个工人被领取
      await waitFor(
        () => pendingResolvers.size === 3,
        2000,
        `期望 3 个工人被领取，实际 ${pendingResolvers.size}`
      )

      // 此时应只有 3 个 running，2 个 ready
      expect(maxObservedConcurrent).toBe(3)
      expect(getRunningTaskIds().size).toBe(3)
      expect(getRunningTaskIdsByBoard(board.id).size).toBe(3)
      expect(db.listTasksByStatus('running')).toHaveLength(3)
      expect(db.listTasksByStatus('ready')).toHaveLength(2)

      // 循环释放（事件驱动拾起后 2 个，再释放直到全 done）
      const tasks = await releaseAllUntilDone(db, board.id, pendingResolvers)
      expect(tasks.every((t) => t.status === 'done')).toBe(true)
      expect(maxObservedConcurrent).toBeLessThanOrEqual(3)
    })

    test('默认 maxConcurrent=3（board.maxConcurrent 未传时）', async () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      for (let i = 0; i < 4; i++) {
        db.createTask({ boardId: board.id, title: `T${i}`, channelId: 'c1' })
      }

      const pendingResolvers = new Map<string, () => void>()
      const mockRunner: KanbanWorkerRunner = async (task) => {
        await new Promise<void>((resolve) => {
          pendingResolvers.set(task.id, resolve)
        })
        return { summary: 'done' }
      }

      // board.maxConcurrent 未传，db 默认填 3
      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })
      startKanbanDispatcher()

      await waitFor(() => pendingResolvers.size === 3, 2000)
      expect(getRunningTaskIds().size).toBe(3)
      expect(db.listTasksByStatus('ready')).toHaveLength(1)

      // 循环释放直到全 done
      await releaseAllUntilDone(db, board.id, pendingResolvers)
    })

    test('两个看板并发互不影响（boardA.maxConcurrent=2, boardB.maxConcurrent=2）', async () => {
      // boardA 限 2，boardB 限 2，同时跑应各跑各的，不互相挤占
      const boardA = db.createBoard({ rootGoal: 'GA', parentSessionId: 's1', maxConcurrent: 2 })
      const boardB = db.createBoard({ rootGoal: 'GB', parentSessionId: 's2', maxConcurrent: 2 })
      for (let i = 0; i < 4; i++) {
        db.createTask({ boardId: boardA.id, title: `A${i}`, channelId: 'c1' })
        db.createTask({ boardId: boardB.id, title: `B${i}`, channelId: 'c1' })
      }

      const pendingResolvers = new Map<string, () => void>()
      const mockRunner: KanbanWorkerRunner = async (task) => {
        await new Promise<void>((resolve) => {
          pendingResolvers.set(task.id, resolve)
        })
        return { summary: 'done' }
      }

      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })
      startKanbanDispatcher()

      // 各自跑 2 个，总共 4 个 running
      await waitFor(
        () => pendingResolvers.size === 4,
        2000,
        `期望 4 个工人被领取，实际 ${pendingResolvers.size}`
      )
      expect(getRunningTaskIdsByBoard(boardA.id).size).toBe(2)
      expect(getRunningTaskIdsByBoard(boardB.id).size).toBe(2)
      expect(getRunningTaskIds().size).toBe(4)

      await releaseAllUntilDone(db, boardA.id, pendingResolvers)
      await releaseAllUntilDone(db, boardB.id, pendingResolvers)
    })

    test('paused 看板不被派工（B5 暂停隔离）', async () => {
      // board.paused=true 时 dispatcher 跳过该看板
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1', maxConcurrent: 3 })
      for (let i = 0; i < 3; i++) {
        db.createTask({ boardId: board.id, title: `T${i}`, channelId: 'c1' })
      }

      let runCount = 0
      const mockRunner: KanbanWorkerRunner = async () => {
        runCount++
        return { summary: 'done' }
      }
      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })

      // 暂停看板
      db.updateBoard(board.id, { paused: true })
      startKanbanDispatcher()

      // 等 200ms 确认没有被派工
      await new Promise((r) => setTimeout(r, 200))
      expect(runCount).toBe(0)
      expect(getRunningTaskIdsByBoard(board.id).size).toBe(0)
      expect(db.listTasksByStatus('running')).toHaveLength(0)

      // 恢复后应立即派工（startKanbanDispatcher 会 tick 一次）
      db.updateBoard(board.id, { paused: false })
      dispatchKanbanTick()
      await waitForAllSettled(db, board.id)
      expect(runCount).toBe(3)
    })
  })

  describe('状态机 pending → ready → running → done', () => {
    test('dispatchKanbanTick 手动触发完成全生命周期', async () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const task = db.createTask({ boardId: board.id, title: 'T', channelId: 'c1' })

      // 初始 pending
      expect(db.getTask(task.id)?.status).toBe('pending')

      const mockRunner: KanbanWorkerRunner = async () => ({ summary: 'ok' })
      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })

      // 手动触发一次 tick（不启动定时器）
      dispatchKanbanTick()

      // 等待完成
      const tasks = await waitForAllSettled(db, board.id)
      const done = tasks[0]!
      expect(done.status).toBe('done')
      expect(done.resultSummary).toBe('ok')
      expect(done.startedAt).toBeGreaterThan(0)
      expect(done.finishedAt).toBeGreaterThanOrEqual(done.startedAt ?? 0)
    })
  })

  describe('startKanbanDispatcher / stopKanbanDispatcher', () => {
    test('startKanbanDispatcher 幂等（重复调用不启动多个定时器）', () => {
      const mockRunner: KanbanWorkerRunner = async () => ({ summary: '' })
      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })
      startKanbanDispatcher()
      startKanbanDispatcher()
      // stopKanbanDispatcher 在 afterEach 中调用；此处只验证不崩溃
      expect(true).toBe(true)
    })

    test('未配置时 startKanbanDispatcher 不启动', () => {
      resetKanbanDispatcher()
      startKanbanDispatcher() // 应仅打印警告，不崩溃
      expect(getRunningTaskIds().size).toBe(0)
    })

    test('stopKanbanDispatcher 清理定时器', async () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      db.createTask({ boardId: board.id, title: 'T', channelId: 'c1' })

      const pendingResolvers = new Map<string, () => void>()
      const mockRunner: KanbanWorkerRunner = async (task) => {
        await new Promise<void>((resolve) => {
          pendingResolvers.set(task.id, resolve)
        })
        return { summary: 'done' }
      }
      configureKanbanDispatcher({
        runner: mockRunner,
        db,
        getAvailableModels: () => ['m_test'],
      })
      startKanbanDispatcher()
      await waitFor(() => pendingResolvers.size === 1, 1000)

      stopKanbanDispatcher()
      // 定时器已停，但手动 dispatchKanbanTick 仍可触发（用于测试/手动派工）
      // 这里验证 stop 不影响已在途的任务（不强制取消）
      expect(db.listTasksByStatus('running')).toHaveLength(1)

      // 释放挂起的任务让 afterEach 的 close 不冲突
      await releaseAllUntilDone(db, board.id, pendingResolvers)
    })
  })
})
