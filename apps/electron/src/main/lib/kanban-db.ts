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
  type KanbanBoardMode,
  type KanbanBoardStatus,
  type KanbanTask,
  type KanbanTaskLink,
  type KanbanTaskLinkType,
  type KanbanTaskStatus,
  type CreateKanbanBoardInput,
  type CreateKanbanTaskInput,
  type UpdateKanbanTaskStatusInput,
  KANBAN_DEFAULT_MAX_CONCURRENT,
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
  parent_session_id: string | null
  title: string | null
  mode: string | null
  origin_chat_id: string | null
  origin_bridge: string | null
  status: string
  max_concurrent: number
  paused: number
  require_summary: number | null
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
    parentSessionId: row.parent_session_id ?? undefined,
    title: row.title ?? undefined,
    mode: (row.mode as KanbanBoardMode) ?? 'general',
    originChatId: row.origin_chat_id ?? undefined,
    originBridge: (row.origin_bridge as KanbanBoard['originBridge']) ?? undefined,
    status: row.status as KanbanBoardStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    maxConcurrent: row.max_concurrent ?? KANBAN_DEFAULT_MAX_CONCURRENT,
    paused: (row.paused ?? 0) === 1,
    requireSummary: (row.require_summary ?? 0) === 1 ? true : false,
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

  /** 是否已成功打开数据库连接 */
  isInitialized(): boolean {
    return this.db !== null
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
      this.migrateSchema()
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
        parent_session_id TEXT,
        title TEXT,
        mode TEXT NOT NULL DEFAULT 'general',
        origin_chat_id TEXT,
        origin_bridge TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        max_concurrent INTEGER NOT NULL DEFAULT 3,
        paused INTEGER NOT NULL DEFAULT 0,
        require_summary INTEGER NOT NULL DEFAULT 0,
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

  /**
   * Schema 迁移（幂等）
   *
   * 用 PRAGMA user_version 跟踪版本：
   * - version 0：未迁移（旧 schema，parent_session_id NOT NULL，无 title/mode 列）
   * - version 1：B4 迁移完成（parent_session_id NULLABLE，新增 title/mode 列）
   * - version 2：修复 B4 迁移遗留的 kanban_tasks 外键引用错误（指向已删除的 kanban_boards_old）
   * - version 3：B5 新增 max_concurrent / paused 列（per-board 并发 + 暂停隔离）
   * - version 4：B9 新增 require_summary 列（事件回流区分是否回调主会话）
   *
   * 新 DB 直接建到 version 4，不需要迁移。旧 DB 检测到 version < 4 时执行对应迁移。
   */
  private migrateSchema(): void {
    if (!this.db) return
    const currentVersion = this.db.pragma('user_version', { simple: true }) as number

    if (currentVersion >= 4) return

    // v0 → v1：B4 迁移（parent_session_id 改 NULLABLE + 新增 title/mode 列）
    if (currentVersion < 1) {
      this.migrateV0ToV1()
      this.db.pragma('user_version = 1')
    }

    // v1 → v2：修复 kanban_tasks 外键引用错误
    if (currentVersion < 2) {
      this.migrateV1ToV2()
      this.db.pragma('user_version = 2')
    }

    // v2 → v3：B5 新增 max_concurrent / paused 列
    if (currentVersion < 3) {
      this.migrateV2ToV3()
      this.db.pragma('user_version = 3')
    }

    // v3 → v4：B9 新增 require_summary 列
    if (currentVersion < 4) {
      this.migrateV3ToV4()
      this.db.pragma('user_version = 4')
    }
  }

  /**
   * v0 → v1 迁移：parent_session_id 改 NULLABLE + 新增 title/mode 列
   *
   * 修复点：包裹 PRAGMA foreign_keys=off，防止重建表时外键校验失败。
   * SQLite 默认 foreign_keys=off，但显式关闭更安全。
   */
  private migrateV0ToV1(): void {
    if (!this.db) return
    const tableInfo = this.db.prepare('PRAGMA table_info(kanban_boards)').all() as Array<{
      name: string
      notnull: number
      dflt_value: string | null
    }>
    const columns = new Map(tableInfo.map((c) => [c.name, c]))

    const parentSessionCol = columns.get('parent_session_id')
    const hasTitle = columns.has('title')
    const hasMode = columns.has('mode')

    if (parentSessionCol && parentSessionCol.notnull === 1) {
      this.db.pragma('foreign_keys = off')
      try {
        this.db.exec(`
          ALTER TABLE kanban_boards RENAME TO kanban_boards_old;
          CREATE TABLE kanban_boards (
            id TEXT PRIMARY KEY,
            root_goal TEXT NOT NULL,
            parent_session_id TEXT,
            title TEXT,
            mode TEXT NOT NULL DEFAULT 'general',
            origin_chat_id TEXT,
            origin_bridge TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
          INSERT INTO kanban_boards (id, root_goal, parent_session_id, title, mode, origin_chat_id, origin_bridge, status, created_at, updated_at)
          SELECT id, root_goal, parent_session_id, NULL, 'general', origin_chat_id, origin_bridge, status, created_at, updated_at
          FROM kanban_boards_old;
          DROP TABLE kanban_boards_old;
        `)
      } finally {
        this.db.pragma('foreign_keys = on')
      }
      console.log('[看板] schema 迁移完成：parent_session_id 改 NULLABLE + 新增 title/mode 列')
    } else if (!hasTitle || !hasMode) {
      if (!hasTitle) {
        this.db.exec('ALTER TABLE kanban_boards ADD COLUMN title TEXT')
      }
      if (!hasMode) {
        this.db.exec("ALTER TABLE kanban_boards ADD COLUMN mode TEXT NOT NULL DEFAULT 'general'")
      }
      console.log('[看板] schema 补列：title/mode')
    }
  }

  /**
   * v1 → v2 迁移：修复 kanban_tasks 外键引用错误
   *
   * 问题：v0→v1 迁移时 ALTER TABLE RENAME kanban_boards → kanban_boards_old，
   * SQLite 自动把 kanban_tasks 的外键引用从 kanban_boards 改成了 kanban_boards_old，
   * 但 DROP TABLE kanban_boards_old 后，kanban_tasks 的外键变成悬空引用，
   * 导致 INSERT INTO kanban_tasks 时报 "no such table: main.kanban_boards_old"。
   *
   * 修复：重建 kanban_tasks 表，外键正确指向 kanban_boards(id)。
   */
  private migrateV1ToV2(): void {
    if (!this.db) return
    // 检查 kanban_tasks 的外键是否引用了 kanban_boards_old
    const tasksSchema = this.db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='kanban_tasks'"
    ).get() as { sql: string } | undefined

    if (!tasksSchema) return
    if (!tasksSchema.sql.includes('kanban_boards_old')) {
      // 新 DB，外键正确，无需迁移
      return
    }

    console.log('[看板] 检测到 kanban_tasks 外键引用错误（kanban_boards_old），开始修复')
    this.db.pragma('foreign_keys = off')
    try {
      this.db.exec(`
        CREATE TABLE kanban_tasks_new (
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
        INSERT INTO kanban_tasks_new
          (id, board_id, parent_task_id, title, body, status, role_id, assignee_session_id,
           channel_id, model_id, priority, created_at, updated_at, started_at, finished_at,
           error, result_summary, blocked_reason, metadata)
        SELECT id, board_id, parent_task_id, title, body, status, role_id, assignee_session_id,
           channel_id, model_id, priority, created_at, updated_at, started_at, finished_at,
           error, result_summary, blocked_reason, metadata
        FROM kanban_tasks;
        DROP TABLE kanban_tasks;
        ALTER TABLE kanban_tasks_new RENAME TO kanban_tasks;
        CREATE INDEX IF NOT EXISTS idx_kanban_tasks_board ON kanban_tasks(board_id);
        CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status ON kanban_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_kanban_tasks_parent ON kanban_tasks(parent_task_id);
      `)
    } finally {
      this.db.pragma('foreign_keys = on')
    }
    console.log('[看板] kanban_tasks 外键修复完成（指向 kanban_boards）')
  }

  /**
   * v2 → v3 迁移：新增 max_concurrent / paused 列（B5 per-board 并发 + 暂停隔离）
   *
   * 用 ALTER TABLE ADD COLUMN 补列，默认值由 schema 担保（max_concurrent=3, paused=0）。
   * 旧 DB 的已有看板行会自动获得默认值。
   */
  private migrateV2ToV3(): void {
    if (!this.db) return
    const tableInfo = this.db.prepare('PRAGMA table_info(kanban_boards)').all() as Array<{
      name: string
    }>
    const columns = new Set(tableInfo.map((c) => c.name))

    if (!columns.has('max_concurrent')) {
      this.db.exec('ALTER TABLE kanban_boards ADD COLUMN max_concurrent INTEGER NOT NULL DEFAULT 3')
    }
    if (!columns.has('paused')) {
      this.db.exec('ALTER TABLE kanban_boards ADD COLUMN paused INTEGER NOT NULL DEFAULT 0')
    }
    console.log('[看板] schema 迁移完成：新增 max_concurrent / paused 列（B5）')
  }

  /**
   * v3 → v4 迁移：新增 require_summary 列（B9 事件回流区分是否回调主会话）
   *
   * 用 ALTER TABLE ADD COLUMN 补列，默认值 0（不需要汇总）。
   * 旧 DB 的已有看板行会自动获得默认值 0。
   */
  private migrateV3ToV4(): void {
    if (!this.db) return
    const tableInfo = this.db.prepare('PRAGMA table_info(kanban_boards)').all() as Array<{
      name: string
    }>
    const columns = new Set(tableInfo.map((c) => c.name))

    if (!columns.has('require_summary')) {
      this.db.exec(
        'ALTER TABLE kanban_boards ADD COLUMN require_summary INTEGER NOT NULL DEFAULT 0'
      )
    }
    console.log('[看板] schema 迁移完成：新增 require_summary 列（B9）')
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
      title: input.title,
      mode: input.mode ?? 'general',
      originChatId: input.originChatId,
      originBridge: input.originBridge,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      maxConcurrent: input.maxConcurrent ?? KANBAN_DEFAULT_MAX_CONCURRENT,
      paused: false,
      requireSummary: input.requireSummary ?? false,
    }
    db.prepare(
      `INSERT INTO kanban_boards
        (id, root_goal, parent_session_id, title, mode, origin_chat_id, origin_bridge, status, max_concurrent, paused, require_summary, created_at, updated_at)
       VALUES (@id, @root_goal, @parent_session_id, @title, @mode, @origin_chat_id, @origin_bridge, @status, @max_concurrent, @paused, @require_summary, @created_at, @updated_at)`
    ).run({
      id: board.id,
      root_goal: board.rootGoal,
      parent_session_id: board.parentSessionId ?? null,
      title: board.title ?? null,
      mode: board.mode,
      origin_chat_id: board.originChatId ?? null,
      origin_bridge: board.originBridge ?? null,
      status: board.status,
      max_concurrent: board.maxConcurrent,
      paused: board.paused ? 1 : 0,
      require_summary: board.requireSummary ? 1 : 0,
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

  /**
   * 列出所有看板（B4：全局看板视图）
   * @param filter.mode 按模式过滤（可选）
   * @param filter.status 按状态过滤（可选，默认只看 active）
   */
  listBoards(filter?: { mode?: KanbanBoardMode; status?: KanbanBoardStatus }): KanbanBoard[] {
    const db = this.requireDb()
    const where: string[] = []
    const params: Record<string, unknown> = {}
    if (filter?.mode) {
      where.push('mode = @mode')
      params.mode = filter.mode
    }
    if (filter?.status) {
      where.push('status = @status')
      params.status = filter.status
    } else {
      where.push("status = 'active'")
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const rows = db
      .prepare(`SELECT * FROM kanban_boards ${whereClause} ORDER BY updated_at DESC`)
      .all(params) as KanbanBoardRow[]
    return rows.map(rowToBoard)
  }

  /**
   * 更新看板（B4：标题/状态；B5：maxConcurrent/paused）
   * @returns 更新后的看板，不存在则返回 null
   */
  updateBoard(
    boardId: string,
    update: {
      title?: string
      status?: KanbanBoardStatus
      maxConcurrent?: number
      paused?: boolean
      requireSummary?: boolean
    }
  ): KanbanBoard | null {
    const db = this.requireDb()
    const sets: string[] = []
    const params: Record<string, unknown> = { board_id: boardId }
    if (update.title !== undefined) {
      sets.push('title = @title')
      params.title = update.title
    }
    if (update.status !== undefined) {
      sets.push('status = @status')
      params.status = update.status
    }
    if (update.maxConcurrent !== undefined) {
      sets.push('max_concurrent = @max_concurrent')
      params.max_concurrent = update.maxConcurrent
    }
    if (update.paused !== undefined) {
      sets.push('paused = @paused')
      params.paused = update.paused ? 1 : 0
    }
    if (update.requireSummary !== undefined) {
      sets.push('require_summary = @require_summary')
      params.require_summary = update.requireSummary ? 1 : 0
    }
    if (sets.length === 0) {
      return this.getBoard(boardId)
    }
    sets.push('updated_at = @updated_at')
    params.updated_at = Date.now()
    db.prepare(`UPDATE kanban_boards SET ${sets.join(', ')} WHERE id = @board_id`).run(params)
    return this.getBoard(boardId)
  }

  /**
   * 删除看板（B4）
   * @param boardId 看板 ID
   * @param hard true=硬删除（DELETE），false=软删除（status='cancelled'）
   */
  deleteBoard(boardId: string, hard = false): void {
    const db = this.requireDb()
    if (hard) {
      db.prepare('DELETE FROM kanban_boards WHERE id = ?').run(boardId)
    } else {
      db.prepare("UPDATE kanban_boards SET status = 'cancelled', updated_at = ? WHERE id = ?").run(
        Date.now(),
        boardId
      )
    }
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

  /**
   * 更新任务的 modelId（dispatcher 派工时轮询分配用，不触发状态机副作用）
   *
   * 与 updateTaskStatus 区别：只改 model_id 字段，不动 status / started_at / finished_at。
   * 用于 dispatcher 派工时把分配的 modelId 写回 task，worker 执行时读 task.modelId。
   */
  updateTaskModel(taskId: string, modelId: string | undefined): void {
    const db = this.requireDb()
    db.prepare(
      `UPDATE kanban_tasks SET model_id = ?, updated_at = ? WHERE id = ?`
    ).run(modelId ?? null, Date.now(), taskId)
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
   * 启动恢复：把残留的 running 任务重置为 ready
   *
   * 场景：程序异常退出 / 用户强关时，DB 里可能有 status=running 但实际没有工人在跑的任务。
   * 启动时调本方法，让 dispatcher 重新派工。
   *
   * 保留 startedAt（原工人已执行的时间），清空 assignee_session_id（旧子会话已失效）。
   * 返回重置的任务数，用于日志。
   */
  resetStaleRunningToReady(): number {
    const db = this.requireDb()
    const stale = db
      .prepare('SELECT id FROM kanban_tasks WHERE status = ?')
      .all('running' as KanbanTaskStatus) as Array<{ id: string }>
    if (stale.length === 0) return 0
    const now = Date.now()
    const stmt = db.prepare(
      `UPDATE kanban_tasks
       SET status = 'ready',
           assignee_session_id = NULL,
           error = NULL,
           updated_at = ?
       WHERE id = ?`
    )
    for (const { id } of stale) {
      stmt.run(now, id)
    }
    return stale.length
  }

  /**
   * 列出可调度的看板（B5：status='active' 且 paused=0）
   * dispatcher tick 时调用，跳过暂停的看板
   */
  listDispatchableBoards(): KanbanBoard[] {
    const db = this.requireDb()
    const rows = db
      .prepare(
        "SELECT * FROM kanban_boards WHERE status = 'active' AND paused = 0 ORDER BY updated_at DESC"
      )
      .all() as KanbanBoardRow[]
    return rows.map(rowToBoard)
  }

  /**
   * 按看板 + 状态列出任务（B5：dispatcher per-board 派工用）
   */
  listTasksByBoardAndStatus(boardId: string, status: KanbanTaskStatus): KanbanTask[] {
    const db = this.requireDb()
    const rows = db
      .prepare(
        'SELECT * FROM kanban_tasks WHERE board_id = ? AND status = ? ORDER BY priority DESC, created_at ASC'
      )
      .all(boardId, status) as KanbanTaskRow[]
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
           assignee_session_id = COALESCE(@assignee_session_id, assignee_session_id),
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
