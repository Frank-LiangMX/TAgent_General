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

import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'node:path'
import * as fs from 'node:fs'

/**
 * 记忆模式：通用 / TA
 */
export type MemoryMode = 'general' | 'ta'

/**
 * 获取记忆目录路径
 */
function getMemoryDir(mode: MemoryMode): string {
  const isDev = !app.isPackaged
  const baseDir = isDev ? path.join(app.getPath('home'), '.tagent-dev') : path.join(app.getPath('home'), '.tagent')
  return mode === 'general' ? path.join(baseDir, 'memory') : path.join(baseDir, 'ta', 'memory')
}

/**
 * L4 会话记录类型
 */
export interface SessionMemoryRecord {
  id: string
  session_slug: string
  title: string
  summary: string
  key_facts: string // JSON array
  tools_used: string // JSON array
  created_at: number
  last_referenced_at: number
  reference_count: number
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
class MemoryLayerService {
  private l4DbGeneral: Database.Database | null = null
  private l4DbTa: Database.Database | null = null

  /**
   * 初始化服务
   */
  initialize(): { success: boolean; error?: string } {
    try {
      // 确保目录存在
      const generalDir = getMemoryDir('general')
      const taDir = getMemoryDir('ta')

      if (!fs.existsSync(generalDir)) {
        fs.mkdirSync(generalDir, { recursive: true })
      }
      if (!fs.existsSync(taDir)) {
        fs.mkdirSync(taDir, { recursive: true })
      }

      // 初始化 L4 SQLite（如果存在）
      this.initL4Db('general')
      this.initL4Db('ta')

      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[MemoryLayerService] 初始化失败:', error)
      return { success: false, error: msg }
    }
  }

  /**
   * 初始化 L4 SQLite 数据库
   */
  private initL4Db(mode: MemoryMode): void {
    const dbPath = path.join(getMemoryDir(mode), 'sessions.db')

    if (!fs.existsSync(dbPath)) {
      // 数据库不存在，不自动创建（ta_agent MCP Server 有写权）
      return
    }

    const db = new Database(dbPath, {
      readonly: true,
      fileMustExist: true,
    })

    db.pragma('journal_mode = WAL')
    db.pragma('query_only = true')

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
    const l0Stats = l0Exists ? this.getMdFileStats(l0Path) : { exists: false, lines: 0, lastUpdated: null }

    // L1 项目画像
    const l1Path = path.join(dir, 'L1_project.md')
    const l1Exists = fs.existsSync(l1Path)
    const l1Stats = l1Exists ? this.getMdFileStats(l1Path) : { exists: false, lines: 0, lastUpdated: null }

    // L2 稳定事实
    const l2Path = path.join(dir, 'L2_facts.md')
    const l2Exists = fs.existsSync(l2Path)
    const l2Stats = l2Exists ? this.getMdFileStats(l2Path) : { exists: false, lines: 0, lastUpdated: null }

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
    const l5Stats = l5Exists ? this.getMdFileStats(l5Path) : { exists: false, lines: 0, lastUpdated: null }

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
    const lines = content.split('\n').filter((line) => line.trim() && !line.startsWith('#') && !line.startsWith('---')).length
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
  private getL4Stats(mode: MemoryMode): { sessions: number; oldestDate: number | null; newestDate: number | null } {
    const db = this.getL4Db(mode)
    if (!db) {
      return { sessions: 0, oldestDate: null, newestDate: null }
    }

    try {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM sessions')
      const countResult = countStmt.get() as { count: number }

      const dateStmt = db.prepare('SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM sessions')
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
      const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions_fts'")
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
        WHERE sessions_fts MATCH ?
        ORDER BY bm25(sessions_fts) ASC
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
  private searchSessionsFallback(mode: MemoryMode, query: string, limit: number): SessionMemoryRecord[] {
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
   * 获取 Markdown 文件内容
   */
  getMdContent(mode: MemoryMode, layer: 'L0' | 'L1' | 'L2' | 'L5'): string | null {
    const dir = getMemoryDir(mode)
    const fileName = layer === 'L0' ? 'L0_user.md' : layer === 'L1' ? 'L1_project.md' : layer === 'L2' ? 'L2_facts.md' : 'L5_insights.md'
    const filePath = path.join(dir, fileName)

    if (!fs.existsSync(filePath)) {
      return null
    }

    return fs.readFileSync(filePath, 'utf-8')
  }

  /**
   * 获取 L3 纠错记录
   */
  getCorrections(mode: MemoryMode, limit: number = 50): Array<{ timestamp: number; correction: string; context: string }> {
    const dir = getMemoryDir(mode)
    const filePath = path.join(dir, 'corrections.jsonl')

    if (!fs.existsSync(filePath)) {
      return []
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter((line) => line.trim()).slice(-limit)
      return lines.map((line) => JSON.parse(line))
    } catch {
      return []
    }
  }
}

// 导出单例
export const memoryLayerService = new MemoryLayerService()