/**
 * Kanban 看板数据库服务
 *
 * 基于 better-sqlite3 实现，存储路径 ~/.tagent[-dev]/kanban.db（WAL 模式）。
 * 提供看板 / 任务 / 依赖关系的 CRUD，以及 pending → ready 的依赖解析。
 *
 * 设计参考：docs/plans/2026-06-30-task-kanban-orchestration-design.md §3
 *
 * 与 automation_* 模块命名隔离：表名一律 kanban_* 前缀，不混用。
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import {
  type KanbanBoard,
  type KanbanBoardStatus,
  type KanbanTask,
  type KanbanTaskLink,
  type KanbanTaskLinkType,
  type KanbanTaskStatus,
  type CreateKanbanBoardInput,
  type CreateKanbanTaskInput,
  type UpdateKanbanTaskStatusInput,
} from '@tagent/shared'
import { getConfigDir } from './config-paths'

/** 默认看板数据库路径：~/.tagent[-dev]/kanban.db */
function getDefaultKanbanDbPath(): string {
  return join(getConfigDir(), 'kanban.db')
}

/** 生成看板 ID：b_<时间base36><随机> */
function generateBoardId(): string {
  return `b_${Date.now().toString(36)}${randomBytes(4).toString('hex')}`
}

/** 生成任务 ID：t_<时间base36><随机> */
function generateTaskId(): string {
  return `t_${Date.now().toString(36)}${randomBytes(4).toString('hex')}`
}

/** 数据库行结构（snake_case，对应 SQLite 表） */
interface KanbanBoardRow {
  id: string
  root_goal: string
  parent_session_id: string
  origin_chat_id: string | null
  origin_bridge: string | null
  status: string
  created_at: number
  updated_at: number
}

interface KanbanTaskRow {
  id: string
  board_id: string
  parent_task_id: string | null
  title: string
  body: string
  status: string
  role_id: string | null
  assignee_session_id: string | null
  channel_id: string
  model_id: string | null
  priority: number
  created_at: number
  updated_at: number
  started_at: number | null
  finished_at: number | null
  error: string | null
  result_summary: string | null
  blocked_reason: string | null
  metadata: string | null
}

interface KanbanTaskLinkRow {
  from_task_id: string
  to_task_id: string
  type: string
}

/** 行 → 看板对象 */
function rowToBoard(row: KanbanBoardRow): KanbanBoard {
  return {
    id: row.id,
    rootGoal: row.root_goal,
    parentSessionId: row.parent_session_id,
    originChatId: row.origin_chat_id ?? undefined,
    originBridge: (row.origin_bridge as KanbanBoard['originBridge']) ?? undefined,
    status: row.status as KanbanBoardStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 行 → 任务对象 */
function rowToTask(row: KanbanTaskRow): KanbanTask {
  return {
    id: row.id,
    boardId: row.board_id,
    parentTaskId: row.parent_task_id ?? undefined,
    title: row.title,
    body: row.body,
    status: row.status as KanbanTaskStatus,
    roleId: row.role_id ?? undefined,
    assigneeSessionId: row.assignee_session_id ?? undefined,
    channelId: row.channel_id,
    modelId: row.model_id ?? undefined,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    error: row.error ?? undefined,
    resultSummary: row.result_summary ?? undefined,
    blockedReason: row.blocked_reason ?? undefined,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
  }
}

/**
 * Kanban 看板数据库服务
 *
 * 单例请用 `kanbanDbService`；测试可 `new KanbanDbService(':memory:')` 隔离。
 */
export class KanbanDbService {
  private db: Database.Database | null = null
  private readonly dbPath: string | null

  /** @param dbPath 数据库路径，省略时使用默认路径；测试可传 ':memory:' */
  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? null
  }

  /** 解析数据库路径：显式传入优先，否则用默认路径 */
  private resolveDbPath(): string {
    return this.dbPath ?? getDefaultKanbanDbPath()
  }

  /**
   * 初始化数据库：打开连接、设置 WAL、建表
   * @returns 成功返回 { success: true }；失败返回 { success: false, error }
   */
  initialize(): { success: boolean; error?: string } {
    try {
      const dbPath = this.resolveDbPath()
      this.db = new Database(dbPath)
      this.db.pragma('journal_mode = WAL')
      this.createSchema()
      console.log(`[看板] 数据库已就绪: ${dbPath}`)
      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('[看板] 数据库初始化失败:', error)
      return { success: false, error }
    }
  }

  /** 建表（幂等） */
  private createSchema(): void {
    if (!this.db) return
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kanban_boards (
        id TEXT PRIMARY KEY,
        root_goal TEXT NOT NULL,
        parent_session_id TEXT NOT NULL,
        origin_chat_id TEXT,
        origin_bridge TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kanban_tasks (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        parent_task_id TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        role_id TEXT,
        assignee_session_id TEXT,
        channel_id TEXT NOT NULL,
        model_id TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        finished_at INTEGER,
        error TEXT,
        result_summary TEXT,
        blocked_reason TEXT,
        metadata TEXT,
        FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_kanban_tasks_board ON kanban_tasks(board_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status ON kanban_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_kanban_tasks_parent ON kanban_tasks(parent_task_id);

      CREATE TABLE IF NOT EXISTS kanban_task_links (
        from_task_id TEXT NOT NULL,
        to_task_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'blocks',
        PRIMARY KEY (from_task_id, to_task_id),
        FOREIGN KEY (from_task_id) REFERENCES kanban_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (to_task_id) REFERENCES kanban_tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_kanban_task_links_to ON kanban_task_links(to_task_id);
      CREATE INDEX IF NOT EXISTS idx_kanban_task_links_from ON kanban_task_links(from_task_id);
    `)
  }

  /** 关闭数据库连接 */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('[看板] 数据库连接已关闭')
    }
  }

  /** 数据库是否就绪 */
  isAvailable(): boolean {
    return this.db !== null
  }

  private requireDb(): Database.Database {
    if (!this.db) {
      throw new Error('[看板] 数据库未初始化，请先调用 initialize()')
    }
    return this.db
  }

  // ===== 看板 CRUD =====

  /** 创建看板 */
  createBoard(input: CreateKanbanBoardInput): KanbanBoard {
    const db = this.requireDb()
    const now = Date.now()
    const board: KanbanBoard = {
      id: generateBoardId(),
      rootGoal: input.rootGoal,
      parentSessionId: input.parentSessionId,
      originChatId: input.originChatId,
      originBridge: input.originBridge,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    db.prepare(
      `INSERT INTO kanban_boards
        (id, root_goal, parent_session_id, origin_chat_id, origin_bridge, status, created_at, updated_at)
       VALUES (@id, @root_goal, @parent_session_id, @origin_chat_id, @origin_bridge, @status, @created_at, @updated_at)`
    ).run({
      id: board.id,
      root_goal: board.rootGoal,
      parent_session_id: board.parentSessionId,
      origin_chat_id: board.originChatId ?? null,
      origin_bridge: board.originBridge ?? null,
      status: board.status,
      created_at: board.createdAt,
      updated_at: board.updatedAt,
    })
    return board
  }

  /** 获取看板 */
  getBoard(boardId: string): KanbanBoard | null {
    const db = this.requireDb()
    const row = db
      .prepare('SELECT * FROM kanban_boards WHERE id = ?')
      .get(boardId) as KanbanBoardRow | undefined
    return row ? rowToBoard(row) : null
  }

  // ===== 任务 CRUD =====

  /** 创建任务（初始状态 = pending，由 resolveReadyTasks 提升为 ready） */
  createTask(input: CreateKanbanTaskInput): KanbanTask {
    const db = this.requireDb()
    const now = Date.now()
    const task: KanbanTask = {
      id: generateTaskId(),
      boardId: input.boardId,
      parentTaskId: input.parentTaskId,
      title: input.title,
      body: input.body ?? '',
      status: 'pending',
      roleId: input.roleId,
      channelId: input.channelId,
      modelId: input.modelId,
      priority: input.priority ?? 0,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    }
    db.prepare(
      `INSERT INTO kanban_tasks
        (id, board_id, parent_task_id, title, body, status, role_id, assignee_session_id,
         channel_id, model_id, priority, created_at, updated_at, started_at, finished_at,
         error, result_summary, blocked_reason, metadata)
       VALUES
        (@id, @board_id, @parent_task_id, @title, @body, @status, @role_id, @assignee_session_id,
         @channel_id, @model_id, @priority, @created_at, @updated_at, @started_at, @finished_at,
         @error, @result_summary, @blocked_reason, @metadata)`
    ).run({
      id: task.id,
      board_id: task.boardId,
      parent_task_id: task.parentTaskId ?? null,
      title: task.title,
      body: task.body,
      status: task.status,
      role_id: task.roleId ?? null,
      assignee_session_id: task.assigneeSessionId ?? null,
      channel_id: task.channelId,
      model_id: task.modelId ?? null,
      priority: task.priority,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      started_at: null,
      finished_at: null,
      error: null,
      result_summary: null,
      blocked_reason: null,
      metadata: task.metadata ? JSON.stringify(task.metadata) : null,
    })
    return task
  }

  /** 获取单个任务 */
  getTask(taskId: string): KanbanTask | null {
    const db = this.requireDb()
    const row = db
      .prepare('SELECT * FROM kanban_tasks WHERE id = ?')
      .get(taskId) as KanbanTaskRow | undefined
    return row ? rowToTask(row) : null
  }

  /** 列出某看板下所有任务（按优先级降序、创建时间升序） */
  listTasksByBoard(boardId: string): KanbanTask[] {
    const db = this.requireDb()
    const rows = db
      .prepare(
        'SELECT * FROM kanban_tasks WHERE board_id = ? ORDER BY priority DESC, created_at ASC'
      )
      .all(boardId) as KanbanTaskRow[]
    return rows.map(rowToTask)
  }

  /** 列出某状态的所有任务（按优先级降序、创建时间升序） */
  listTasksByStatus(status: KanbanTaskStatus): KanbanTask[] {
    const db = this.requireDb()
    const rows = db
      .prepare(
        'SELECT * FROM kanban_tasks WHERE status = ? ORDER BY priority DESC, created_at ASC'
      )
      .all(status) as KanbanTaskRow[]
    return rows.map(rowToTask)
  }

  /**
   * 更新任务状态
   *
   * 自动维护时间戳：
   * - status → running：写入 startedAt
   * - status → done/failed/cancelled：写入 finishedAt
   * - 任意更新：刷新 updatedAt
   */
  updateTaskStatus(taskId: string, update: UpdateKanbanTaskStatusInput): void {
    const db = this.requireDb()
    const now = Date.now()
    const startedAt = update.status === 'running' ? now : null
    const finishedAt =
      update.status === 'done' || update.status === 'failed' || update.status === 'cancelled'
        ? now
        : null
    db.prepare(
      `UPDATE kanban_tasks
       SET status = @status,
           error = @error,
           result_summary = @result_summary,
           blocked_reason = @blocked_reason,
           assignee_session_id = @assignee_session_id,
           started_at = COALESCE(started_at, @started_at),
           finished_at = @finished_at,
           updated_at = @updated_at
       WHERE id = @id`
    ).run({
      id: taskId,
      status: update.status,
      error: update.error ?? null,
      result_summary: update.resultSummary ?? null,
      blocked_reason: update.blockedReason ?? null,
      assignee_session_id: update.assigneeSessionId ?? null,
      started_at: startedAt,
      finished_at: finishedAt,
      updated_at: now,
    })
  }

  // ===== 依赖关系 =====

  /** 添加任务依赖（from 完成前 to 保持 pending） */
  addDependency(fromTaskId: string, toTaskId: string, type: KanbanTaskLinkType = 'blocks'): void {
    const db = this.requireDb()
    db.prepare(
      `INSERT OR IGNORE INTO kanban_task_links (from_task_id, to_task_id, type)
       VALUES (?, ?, ?)`
    ).run(fromTaskId, toTaskId, type)
  }

  /** 列出某任务的所有依赖链接（作为 to 的，即阻塞它的） */
  listBlockingLinks(taskId: string): KanbanTaskLink[] {
    const db = this.requireDb()
    const rows = db
      .prepare('SELECT * FROM kanban_task_links WHERE to_task_id = ? AND type = \'blocks\'')
      .all(taskId) as KanbanTaskLinkRow[]
    return rows.map((row) => ({
      fromTaskId: row.from_task_id,
      toTaskId: row.to_task_id,
      type: row.type as KanbanTaskLinkType,
    }))
  }

  /**
   * 依赖解析：扫描所有 pending 任务，将阻塞依赖全部 done 的提升为 ready
   *
   * 规则：任务 T 的所有 blocks 型依赖（from 完成 → to 解锁）的 from 任务状态均为 done 时，
   * T 从 pending 提升为 ready。无依赖的 pending 任务直接提升。
   *
   * @returns 本次提升为 ready 的任务列表
   */
  resolveReadyTasks(): KanbanTask[] {
    const db = this.requireDb()
    // 找出所有 pending 且没有未完成 blocks 依赖的任务
    const rows = db
      .prepare(
        `SELECT t.* FROM kanban_tasks t
         WHERE t.status = 'pending'
           AND NOT EXISTS (
             SELECT 1 FROM kanban_task_links l
             JOIN kanban_tasks blocker ON blocker.id = l.from_task_id
             WHERE l.to_task_id = t.id
               AND l.type = 'blocks'
               AND blocker.status != 'done'
           )`
      )
      .all() as KanbanTaskRow[]

    if (rows.length === 0) return []

    const now = Date.now()
    const promote = db.prepare(
      'UPDATE kanban_tasks SET status = \'ready\', updated_at = ? WHERE id = ?'
    )
    const promoted: KanbanTask[] = []
    const tx = db.transaction(() => {
      for (const row of rows) {
        promote.run(now, row.id)
        promoted.push(rowToTask(row))
      }
    })
    tx()

    if (promoted.length > 0) {
      console.log(`[看板] 依赖解析：${promoted.length} 个 pending 任务提升为 ready`)
    }
    return promoted
  }
}

/** 主进程默认单例（路径 ~/.tagent[-dev]/kanban.db） */
export const kanbanDbService = new KanbanDbService()
