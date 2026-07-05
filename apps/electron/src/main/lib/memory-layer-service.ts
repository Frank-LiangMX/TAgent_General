/**
 * MemoryLayerService - 记忆 5 层服务
 *
 * 根据设计文档 §6.5 实现：
 * - L0 用户画像: L0_user.md（双视图 YAML）
 * - L1 项目画像: L1_project.md
 * - L2 稳定事实: L2_facts.md
 * - L3 纠错记录: corrections.jsonl + rules.json
 * - L4 历史会话: sessions.db（SQLite + FTS5）
 * - L5 提炼洞察: L5_insights.md
 *
 * 目录结构：
 * - 通用模式: ~/.tagent/memory/
 * - TA 模式: ~/.tagent/ta/memory/
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import Database from 'better-sqlite3'
import { app } from 'electron'

/**
 * 记忆模式：通用 / TA
 */
export type MemoryMode = 'general' | 'ta'

/**
 * 获取记忆目录路径
 */
function getMemoryDir(mode: MemoryMode): string {
  const isDev = !app.isPackaged
  const baseDir = isDev
    ? path.join(app.getPath('home'), '.tagent-dev')
    : path.join(app.getPath('home'), '.tagent')
  return mode === 'general' ? path.join(baseDir, 'memory') : path.join(baseDir, 'ta', 'memory')
}

/**
 * 获取 SDK auto-memory 重定向目录：~/.tagent[-dev]/memory/agent_self/
 *
 * SDK 0.3.153 的 autoMemoryEnabled: false 是空壳选项，无法真正禁用 auto-memory。
 * 用 autoMemoryDirectory 把 SDK 写入位置重定向到 TAgent 记忆目录的子目录 agent_self/，
 * 让 LLM 主动写的画像文件落到 TAgent 能读到的位置。与 Nudge 系统写的 L0-L5 文件名不重叠。
 */
export function getAgentSelfMemoryDir(): string {
  return path.join(getMemoryDir('general'), 'agent_self')
}

/**
 * L4 会话记录类型
 *
 * 对应 sessions 表的行结构。id 由 SQLite AUTOINCREMENT 生成；
 * key_facts / tools_used 为 JSON 序列化后的字符串。
 */
export interface SessionMemoryRecord {
  id: number
  session_slug: string
  title: string
  summary: string
  key_facts: string
  tools_used: string
  mode: string | null
  workspace_slug: string | null
  created_at: number
  ended_at: number | null
}

/**
 * recordSession 写入参数
 */
export interface RecordSessionParams {
  /** 会话 UUID，写入 session_slug 列 */
  sessionId: string
  /** 会话标题（首条 user message 截断） */
  title: string
  /** 本次流的关键事件摘要（最后一条 assistant 消息截断） */
  summary: string
  /** 关键事实（v1.5 由 Reflect 提炼后回填） */
  keyFacts: string[]
  /** 本次流中使用的工具名去重列表 */
  toolsUsed: string[]
  /** 记忆模式 */
  mode: MemoryMode
  /** 工作区 slug */
  workspaceSlug: string
}

/**
 * 记忆层统计
 */
export interface MemoryLayerStats {
  l0: { exists: boolean; lines: number; lastUpdated: number | null }
  l1: { exists: boolean; lines: number; lastUpdated: number | null }
  l2: { exists: boolean; lines: number; lastUpdated: number | null }
  l3: { rawCount: number; rulesCount: number; lastUpdated: number | null }
  l4: { sessions: number; oldestDate: number | null; newestDate: number | null }
  l5: { exists: boolean; lines: number; lastUpdated: number | null }
}

/**
 * MemoryLayerService
 */
export class MemoryLayerService {
  private l4DbGeneral: Database.Database | null = null
  private l4DbTa: Database.Database | null = null

  /**
   * 初始化服务
   *
   * @param options.dbPathOverride 测试注入：覆盖默认 getMemoryDir 计算的 db 路径。
   *   生产不传，走 `~/.tagent[-dev]/memory/sessions.db`；测试可传 `:memory:` 或临时路径。
   */
  initialize(options?: { dbPathOverride?: Partial<Record<MemoryMode, string>> }): {
    success: boolean
    error?: string
  } {
    try {
      // 确保目录存在（仅在生产路径下创建；测试 :memory: 路径跳过）
      if (!options?.dbPathOverride?.general) {
        const generalDir = getMemoryDir('general')
        if (!fs.existsSync(generalDir)) {
          fs.mkdirSync(generalDir, { recursive: true })
        }
      }
      if (!options?.dbPathOverride?.ta) {
        const taDir = getMemoryDir('ta')
        if (!fs.existsSync(taDir)) {
          fs.mkdirSync(taDir, { recursive: true })
        }
      }

      // 初始化 L4 SQLite（自动建库 + schema）
      this.initL4Db('general', options?.dbPathOverride?.general)
      this.initL4Db('ta', options?.dbPathOverride?.ta)

      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[MemoryLayerService] 初始化失败:', error)
      return { success: false, error: msg }
    }
  }

  /**
   * 初始化 L4 SQLite 数据库（可写 + 自动建库）
   *
   * - 不存在时自动创建（better-sqlite3 默认行为）
   * - 建 sessions 表 + FTS5 全文索引 + 同步触发器（幂等）
   * - WAL 模式提升并发读
   *
   * @param dbPathOverride 测试注入路径（:memory: 或临时文件）
   */
  private initL4Db(mode: MemoryMode, dbPathOverride?: string): void {
    const dbPath = dbPathOverride ?? path.join(getMemoryDir(mode), 'sessions.db')

    // 可写模式打开（不存在则创建）
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')

    // 建 schema（幂等）：sessions 主表 + FTS5 全文索引 + 触发器同步
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_slug TEXT NOT NULL,
        title TEXT,
        summary TEXT,
        key_facts TEXT,
        tools_used TEXT,
        mode TEXT,
        workspace_slug TEXT,
        created_at INTEGER NOT NULL,
        ended_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_mode ON sessions(mode);

      CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
        title, summary, key_facts,
        content='sessions',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON sessions BEGIN
        INSERT INTO sessions_fts(rowid, title, summary, key_facts)
        VALUES (new.id, new.title, new.summary, new.key_facts);
      END;

      CREATE TRIGGER IF NOT EXISTS sessions_ad AFTER DELETE ON sessions BEGIN
        INSERT INTO sessions_fts(sessions_fts, rowid, title, summary, key_facts)
        VALUES ('delete', old.id, old.title, old.summary, old.key_facts);
      END;

      CREATE TRIGGER IF NOT EXISTS sessions_au AFTER UPDATE ON sessions BEGIN
        INSERT INTO sessions_fts(sessions_fts, rowid, title, summary, key_facts)
        VALUES ('delete', old.id, old.title, old.summary, old.key_facts);
        INSERT INTO sessions_fts(rowid, title, summary, key_facts)
        VALUES (new.id, new.title, new.summary, new.key_facts);
      END;
    `)

    if (mode === 'general') {
      this.l4DbGeneral = db
    } else {
      this.l4DbTa = db
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.l4DbGeneral) {
      this.l4DbGeneral.close()
      this.l4DbGeneral = null
    }
    if (this.l4DbTa) {
      this.l4DbTa.close()
      this.l4DbTa = null
    }
  }

  /**
   * 获取 L4 数据库
   */
  private getL4Db(mode: MemoryMode): Database.Database | null {
    return mode === 'general' ? this.l4DbGeneral : this.l4DbTa
  }

  /**
   * 获取记忆层统计
   */
  getStats(mode: MemoryMode): MemoryLayerStats {
    const dir = getMemoryDir(mode)

    // L0 用户画像
    const l0Path = path.join(dir, 'L0_user.md')
    const l0Exists = fs.existsSync(l0Path)
    const l0Stats = l0Exists
      ? this.getMdFileStats(l0Path)
      : { exists: false, lines: 0, lastUpdated: null }

    // L1 项目画像
    const l1Path = path.join(dir, 'L1_project.md')
    const l1Exists = fs.existsSync(l1Path)
    const l1Stats = l1Exists
      ? this.getMdFileStats(l1Path)
      : { exists: false, lines: 0, lastUpdated: null }

    // L2 稳定事实
    const l2Path = path.join(dir, 'L2_facts.md')
    const l2Exists = fs.existsSync(l2Path)
    const l2Stats = l2Exists
      ? this.getMdFileStats(l2Path)
      : { exists: false, lines: 0, lastUpdated: null }

    // L3 纠错记录
    const l3RawPath = path.join(dir, 'corrections.jsonl')
    const l3RulesPath = path.join(dir, 'rules.json')
    const l3RawExists = fs.existsSync(l3RawPath)
    const l3RulesExists = fs.existsSync(l3RulesPath)
    const l3Stats = {
      rawCount: l3RawExists ? this.countJsonlLines(l3RawPath) : 0,
      rulesCount: l3RulesExists ? this.countJsonRules(l3RulesPath) : 0,
      lastUpdated: l3RawExists ? fs.statSync(l3RawPath).mtimeMs : null,
    }

    // L4 历史会话
    const l4Stats = this.getL4Stats(mode)

    // L5 提炼洞察
    const l5Path = path.join(dir, 'L5_insights.md')
    const l5Exists = fs.existsSync(l5Path)
    const l5Stats = l5Exists
      ? this.getMdFileStats(l5Path)
      : { exists: false, lines: 0, lastUpdated: null }

    return {
      l0: { exists: l0Exists, ...l0Stats },
      l1: { exists: l1Exists, ...l1Stats },
      l2: { exists: l2Exists, ...l2Stats },
      l3: l3Stats,
      l4: l4Stats,
      l5: { exists: l5Exists, ...l5Stats },
    }
  }

  /**
   * 获取 Markdown 文件统计
   */
  private getMdFileStats(filePath: string): { lines: number; lastUpdated: number } {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#') && !line.startsWith('---')).length
    const lastUpdated = fs.statSync(filePath).mtimeMs
    return { lines, lastUpdated }
  }

  /**
   * 计算 JSONL 行数
   */
  private countJsonlLines(filePath: string): number {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.split('\n').filter((line) => line.trim()).length
  }

  /**
   * 计算 JSON rules 数量
   */
  private countJsonRules(filePath: string): number {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      return Array.isArray(data.rules) ? data.rules.length : 0
    } catch {
      return 0
    }
  }

  /**
   * 获取 L4 会话统计
   */
  private getL4Stats(mode: MemoryMode): {
    sessions: number
    oldestDate: number | null
    newestDate: number | null
  } {
    const db = this.getL4Db(mode)
    if (!db) {
      return { sessions: 0, oldestDate: null, newestDate: null }
    }

    try {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM sessions')
      const countResult = countStmt.get() as { count: number }

      const dateStmt = db.prepare(
        'SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM sessions'
      )
      const dateResult = dateStmt.get() as { oldest: number | null; newest: number | null }

      return {
        sessions: countResult.count,
        oldestDate: dateResult.oldest,
        newestDate: dateResult.newest,
      }
    } catch {
      // 表可能不存在
      return { sessions: 0, oldestDate: null, newestDate: null }
    }
  }

  /**
   * 搜索 L4 会话（FTS5）
   */
  searchSessions(mode: MemoryMode, query: string, limit: number = 20): SessionMemoryRecord[] {
    const db = this.getL4Db(mode)
    if (!db) {
      return []
    }

    try {
      // 检查 FTS5 表是否存在
      const tableCheck = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions_fts'"
      )
      const tableExists = tableCheck.get()
      if (!tableExists) {
        // FTS5 表不存在，fallback 到 LIKE 搜索
        return this.searchSessionsFallback(mode, query, limit)
      }

      // FTS5 搜索
      const ftsQuery = query.trim().split(/\s+/).join(' OR ')
      const stmt = db.prepare(`
        SELECT s.* FROM sessions s
        JOIN sessions_fts fts ON s.rowid = fts.rowid
        WHERE fts MATCH ?
        ORDER BY bm25(fts) ASC
        LIMIT ?
      `)
      return stmt.all(ftsQuery, limit) as SessionMemoryRecord[]
    } catch (error) {
      console.warn('[MemoryLayerService] FTS5 搜索失败，fallback:', error)
      return this.searchSessionsFallback(mode, query, limit)
    }
  }

  /**
   * LIKE 搜索（fallback）
   */
  private searchSessionsFallback(
    mode: MemoryMode,
    query: string,
    limit: number
  ): SessionMemoryRecord[] {
    const db = this.getL4Db(mode)
    if (!db) {
      return []
    }

    try {
      const searchPattern = `%${query}%`
      const stmt = db.prepare(`
        SELECT * FROM sessions
        WHERE title LIKE ? OR summary LIKE ? OR key_facts LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      return stmt.all(searchPattern, searchPattern, searchPattern, limit) as SessionMemoryRecord[]
    } catch {
      return []
    }
  }

  /**
   * 列出最近的 L4 会话
   */
  listRecentSessions(mode: MemoryMode, limit: number = 20): SessionMemoryRecord[] {
    const db = this.getL4Db(mode)
    if (!db) {
      return []
    }

    try {
      const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?')
      return stmt.all(limit) as SessionMemoryRecord[]
    } catch {
      return []
    }
  }

  /**
   * 记录一次会话到 L4 sessions.db
   *
   * 在 Agent 流结束后调用，写入会话元数据。
   * FTS5 触发器会自动同步全文索引，无需手动维护。
   *
   * 失败不抛异常，仅打印 warn —— 不影响主流程。
   */
  async recordSession(params: RecordSessionParams): Promise<void> {
    const db = this.getL4Db(params.mode)
    if (!db) {
      console.warn(`[MemoryLayerService] L4 ${params.mode} 数据库未初始化，跳过 recordSession`)
      return
    }

    try {
      const now = Date.now()
      db.prepare(
        `
        INSERT INTO sessions
          (session_slug, title, summary, key_facts, tools_used, mode, workspace_slug, created_at, ended_at)
        VALUES (@session_slug, @title, @summary, @key_facts, @tools_used, @mode, @workspace_slug, @created_at, @ended_at)
      `
      ).run({
        session_slug: params.sessionId,
        title: params.title || null,
        summary: params.summary || null,
        key_facts: JSON.stringify(params.keyFacts),
        tools_used: JSON.stringify(params.toolsUsed),
        mode: params.mode,
        workspace_slug: params.workspaceSlug || null,
        created_at: now,
        ended_at: now,
      })
    } catch (error) {
      console.error('[MemoryLayerService] recordSession 失败:', error)
    }
  }

  /**
   * 获取 Markdown 文件内容
   */
  getMdContent(mode: MemoryMode, layer: 'L0' | 'L1' | 'L2' | 'L5'): string | null {
    const dir = getMemoryDir(mode)
    const fileName =
      layer === 'L0'
        ? 'L0_user.md'
        : layer === 'L1'
          ? 'L1_project.md'
          : layer === 'L2'
            ? 'L2_facts.md'
            : 'L5_insights.md'
    const filePath = path.join(dir, fileName)

    if (!fs.existsSync(filePath)) {
      return null
    }

    return fs.readFileSync(filePath, 'utf-8')
  }

  /**
   * 列出 SDK auto-memory 重定向目录 agent_self/ 下的所有 .md 文件
   *
   * SDK auto-memory 不可禁用（0.3.153 autoMemoryEnabled:false 是空壳），改用 autoMemoryDirectory
   * 重定向到 ~/.tagent[-dev]/memory/agent_self/。此方法列目录供 UI 渲染"LLM 自动记录"分区。
   * 返回相对文件名 + 完整内容（文件通常很小，直接读内容避免 N 次 IPC）。
   */
  listAgentSelfFiles(): Array<{ filename: string; content: string; mtime: number }> {
    const dir = getAgentSelfMemoryDir()
    if (!fs.existsSync(dir)) return []
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const result: Array<{ filename: string; content: string; mtime: number }> = []
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (!entry.name.endsWith('.md')) continue
        const filePath = path.join(dir, entry.name)
        try {
          const stat = fs.statSync(filePath)
          const content = fs.readFileSync(filePath, 'utf-8')
          result.push({ filename: entry.name, content, mtime: stat.mtimeMs })
        } catch {
          // 单文件读失败跳过，不影响其他文件
        }
      }
      // 按 mtime 倒序（最新在前）
      result.sort((a, b) => b.mtime - a.mtime)
      return result
    } catch {
      return []
    }
  }

  /**
   * 获取 L3 纠错记录
   */
  getCorrections(
    mode: MemoryMode,
    limit: number = 50
  ): Array<{ timestamp: number; correction: string; context: string }> {
    const dir = getMemoryDir(mode)
    const filePath = path.join(dir, 'corrections.jsonl')

    if (!fs.existsSync(filePath)) {
      return []
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content
        .split('\n')
        .filter((line) => line.trim())
        .slice(-limit)
      return lines.map((line) => JSON.parse(line))
    } catch {
      return []
    }
  }
}

// 导出单例
export const memoryLayerService = new MemoryLayerService()
