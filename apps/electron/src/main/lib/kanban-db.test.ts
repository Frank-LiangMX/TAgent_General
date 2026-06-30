import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import type { KanbanTask } from '@tagent/shared'
import { KanbanDbService } from './kanban-db'

describe('KanbanDbService', () => {
  let db: KanbanDbService

  beforeEach(() => {
    db = new KanbanDbService(':memory:')
    const result = db.initialize()
    expect(result.success).toBe(true)
  })

  afterEach(() => {
    db.close()
  })

  describe('看板 CRUD', () => {
    test('createBoard 写入字段并通过 getBoard 读回', () => {
      const board = db.createBoard({
        rootGoal: '完成登录功能',
        parentSessionId: 'sess_001',
        originChatId: 'chat_wx_001',
        originBridge: 'wechat',
      })
      expect(board.id).toMatch(/^b_/)
      expect(board.status).toBe('active')
      expect(board.rootGoal).toBe('完成登录功能')

      const fetched = db.getBoard(board.id)
      expect(fetched).not.toBeNull()
      expect(fetched?.rootGoal).toBe('完成登录功能')
      expect(fetched?.parentSessionId).toBe('sess_001')
      expect(fetched?.originChatId).toBe('chat_wx_001')
      expect(fetched?.originBridge).toBe('wechat')
    })

    test('getBoard 不存在时返回 null', () => {
      expect(db.getBoard('b_nonexistent')).toBeNull()
    })
  })

  describe('任务 CRUD + 状态机', () => {
    test('createTask 初始状态为 pending', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const task = db.createTask({
        boardId: board.id,
        title: '任务 A',
        body: '做 A',
        channelId: 'ch_1',
      })
      expect(task.id).toMatch(/^t_/)
      expect(task.status).toBe('pending')
      expect(task.priority).toBe(0)

      const fetched = db.getTask(task.id)
      expect(fetched).not.toBeNull()
      expect(fetched?.status).toBe('pending')
      expect(fetched?.title).toBe('任务 A')
      expect(fetched?.boardId).toBe(board.id)
    })

    test('updateTaskStatus 维护 startedAt / finishedAt 时间戳', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const task = db.createTask({ boardId: board.id, title: 'T', channelId: 'c1' })

      // pending → ready
      db.updateTaskStatus(task.id, { status: 'ready' })
      expect(db.getTask(task.id)?.status).toBe('ready')
      expect(db.getTask(task.id)?.startedAt).toBeUndefined()

      // ready → running：写入 startedAt
      db.updateTaskStatus(task.id, { status: 'running' })
      const running = db.getTask(task.id)
      expect(running?.status).toBe('running')
      expect(running?.startedAt).toBeGreaterThan(0)
      expect(running?.finishedAt).toBeUndefined()

      // running → done：写入 finishedAt + resultSummary
      db.updateTaskStatus(task.id, { status: 'done', resultSummary: '完成了' })
      const done = db.getTask(task.id)
      expect(done?.status).toBe('done')
      expect(done?.finishedAt).toBeGreaterThan(0)
      expect(done?.resultSummary).toBe('完成了')
    })

    test('updateTaskStatus failed 写入 error', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const task = db.createTask({ boardId: board.id, title: 'T', channelId: 'c1' })
      db.updateTaskStatus(task.id, { status: 'failed', error: '炸了' })
      const failed = db.getTask(task.id)
      expect(failed?.status).toBe('failed')
      expect(failed?.error).toBe('炸了')
      expect(failed?.finishedAt).toBeGreaterThan(0)
    })

    test('listTasksByBoard 按优先级降序返回', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      db.createTask({ boardId: board.id, title: '低', channelId: 'c1', priority: 1 })
      db.createTask({ boardId: board.id, title: '高', channelId: 'c1', priority: 10 })
      db.createTask({ boardId: board.id, title: '中', channelId: 'c1', priority: 5 })

      const tasks = db.listTasksByBoard(board.id)
      expect(tasks.map((t) => t.title)).toEqual(['高', '中', '低'])
    })

    test('listTasksByStatus 按状态过滤', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const a = db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })
      const b = db.createTask({ boardId: board.id, title: 'B', channelId: 'c1' })
      db.updateTaskStatus(a.id, { status: 'ready' })
      db.updateTaskStatus(b.id, { status: 'running' })

      expect(db.listTasksByStatus('pending').map((t) => t.title)).toEqual([])
      expect(db.listTasksByStatus('ready').map((t) => t.title)).toEqual(['A'])
      expect(db.listTasksByStatus('running').map((t) => t.title)).toEqual(['B'])
    })

    test('metadata JSON 往返', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const task = db.createTask({
        boardId: board.id,
        title: 'T',
        channelId: 'c1',
        metadata: { ref: 'doc-1', count: 3 },
      })
      const fetched = db.getTask(task.id)
      expect(fetched?.metadata).toEqual({ ref: 'doc-1', count: 3 })
    })
  })

  describe('依赖解析 resolveReadyTasks', () => {
    test('无依赖的 pending 任务直接提升为 ready', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })
      db.createTask({ boardId: board.id, title: 'B', channelId: 'c1' })

      const promoted = db.resolveReadyTasks()
      expect(promoted).toHaveLength(2)
      expect(db.listTasksByStatus('ready')).toHaveLength(2)
      expect(db.listTasksByStatus('pending')).toHaveLength(0)
    })

    test('DAG A→B→C：按依赖顺序逐个提升 ready', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const a = db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })
      const b = db.createTask({ boardId: board.id, title: 'B', channelId: 'c1' })
      const c = db.createTask({ boardId: board.id, title: 'C', channelId: 'c1' })
      // B 依赖 A，C 依赖 B
      db.addDependency(a.id, b.id)
      db.addDependency(b.id, c.id)

      // 初始：只有 A 可提升
      let promoted = db.resolveReadyTasks()
      expect(promoted.map((t) => t.title)).toEqual(['A'])
      expect(db.listTasksByStatus('ready').map((t) => t.title)).toEqual(['A'])
      expect(db.listTasksByStatus('pending').map((t) => t.title).sort()).toEqual(['B', 'C'])

      // A 完成 → B 可提升
      db.updateTaskStatus(a.id, { status: 'done' })
      promoted = db.resolveReadyTasks()
      expect(promoted.map((t) => t.title)).toEqual(['B'])
      expect(db.listTasksByStatus('pending').map((t) => t.title)).toEqual(['C'])

      // B 完成 → C 可提升
      db.updateTaskStatus(b.id, { status: 'done' })
      promoted = db.resolveReadyTasks()
      expect(promoted.map((t) => t.title)).toEqual(['C'])
      expect(db.listTasksByStatus('pending')).toHaveLength(0)
    })

    test('A 未完成时 B 保持 pending', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const a = db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })
      const b = db.createTask({ boardId: board.id, title: 'B', channelId: 'c1' })
      db.addDependency(a.id, b.id)

      // A 还在 pending，B 不应提升
      const promoted = db.resolveReadyTasks()
      expect(promoted.map((t) => t.title)).toEqual(['A'])
      expect(db.getTask(b.id)?.status).toBe('pending')
    })

    test('A failed 时 B 不会被提升（failed ≠ done）', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const a = db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })
      const b = db.createTask({ boardId: board.id, title: 'B', channelId: 'c1' })
      db.addDependency(a.id, b.id)

      db.resolveReadyTasks() // A → ready
      db.updateTaskStatus(a.id, { status: 'failed', error: 'A 炸了' })

      const promoted = db.resolveReadyTasks()
      expect(promoted).toHaveLength(0)
      expect(db.getTask(b.id)?.status).toBe('pending')
    })

    test('5 个独立任务全部提升为 ready（为 dispatcher 并发上限测试铺路）', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      for (let i = 0; i < 5; i++) {
        db.createTask({ boardId: board.id, title: `T${i}`, channelId: 'c1' })
      }

      const promoted = db.resolveReadyTasks()
      expect(promoted).toHaveLength(5)
      expect(db.listTasksByStatus('ready')).toHaveLength(5)
      expect(db.listTasksByStatus('pending')).toHaveLength(0)
    })

    test('listBlockingLinks 返回任务的 blocks 依赖', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const a = db.createTask({ boardId: board.id, title: 'A', channelId: 'c1' })
      const b = db.createTask({ boardId: board.id, title: 'B', channelId: 'c1' })
      db.addDependency(a.id, b.id, 'blocks')

      const links = db.listBlockingLinks(b.id)
      expect(links).toHaveLength(1)
      const link = links[0]!
      expect(link.fromTaskId).toBe(a.id)
      expect(link.toTaskId).toBe(b.id)
      expect(link.type).toBe('blocks')
    })
  })

  describe('完整状态机 pending → ready → running → done', () => {
    test('独立任务全生命周期', () => {
      const board = db.createBoard({ rootGoal: 'G', parentSessionId: 's1' })
      const task = db.createTask({ boardId: board.id, title: 'T', channelId: 'c1' })

      // pending
      expect(db.getTask(task.id)?.status).toBe('pending')

      // pending → ready
      db.resolveReadyTasks()
      expect(db.getTask(task.id)?.status).toBe('ready')

      // ready → running
      db.updateTaskStatus(task.id, { status: 'running' })
      expect(db.getTask(task.id)?.status).toBe('running')

      // running → done
      db.updateTaskStatus(task.id, { status: 'done', resultSummary: 'OK' })
      const done = db.getTask(task.id)
      expect(done?.status).toBe('done')
      expect(done?.resultSummary).toBe('OK')
      expect(done?.startedAt).toBeGreaterThan(0)
      expect(done?.finishedAt).toBeGreaterThanOrEqual(done?.startedAt ?? 0)
    })
  })
})
