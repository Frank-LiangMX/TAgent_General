/**
 * AssetStoreService - 资产库服务
 *
 * 负责读取 TA 资产库 SQLite 数据库。
 * 设计原则：
 * - 只读模式（query_only pragma）
 * - WAL 模式读取
 * - 提供列表、搜索、详情查询
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import Database from 'better-sqlite3'
import { app } from 'electron'

import { initializeAssetStoreDb, type AssetRecord, type AssetType, type ReviewStatus, type ReviewHistoryRecord } from './schema'

/**
 * 资产库数据库路径
 *
 * 根据设计文档 §3.3：
 * - 生产环境: ~/.tagent/ta/tag_store/tags.db
 * - 开发环境: ~/.tagent-dev/ta/tag_store/tags.db
 */
function getAssetStoreDbPath(): string {
  const isDev = !app.isPackaged
  const baseDir = isDev ? path.join(app.getPath('home'), '.tagent-dev') : path.join(app.getPath('home'), '.tagent')
  return path.join(baseDir, 'ta', 'tag_store', 'tags.db')
}

/**
 * 资产列表查询参数
 */
export interface ListAssetsParams {
  /** 资产类型筛选 */
  type?: AssetType
  /** 项目筛选 */
  project?: string
  /** 审核状态筛选 */
  reviewStatus?: ReviewStatus
  /** 分页：偏移量 */
  offset?: number
  /** 分页：每页数量 */
  limit?: number
  /** 排序字段 */
  orderBy?: 'name' | 'updated_at' | 'created_at'
  /** 排序方向 */
  orderDir?: 'ASC' | 'DESC'
}

/**
 * 资产列表结果
 */
export interface ListAssetsResult {
  assets: AssetRecord[]
  total: number
  hasMore: boolean
}

/**
 * 搜索资产参数
 */
export interface SearchAssetsParams {
  /** 搜索关键词（FTS5 全文搜索） */
  query: string
  /** 资产类型筛选 */
  type?: AssetType
  /** 分页：每页数量 */
  limit?: number
}

/**
 * 资产库统计信息
 */
export interface AssetStoreStats {
  totalAssets: number
  byType: Record<AssetType, number>
  byReviewStatus: Record<ReviewStatus, number>
  lastUpdatedAt: number | null
}

/**
 * AssetStoreService 单例
 */
class AssetStoreService {
  private db: Database.Database | null = null
  private dbPath: string | null = null

  /**
   * 初始化服务
   *
   * @returns 数据库是否存在
   */
  initialize(): { success: boolean; dbExists: boolean; error?: string } {
    try {
      this.dbPath = getAssetStoreDbPath()

      // 检查数据库文件是否存在
      const dbExists = fs.existsSync(this.dbPath)

      if (!dbExists) {
        // 数据库不存在，返回成功但标记 dbExists = false
        // UI 可以显示"请先运行 ta_agent MCP Server 初始化资产库"
        return { success: true, dbExists: false }
      }

      // 打开数据库（只读模式）
      this.db = new Database(this.dbPath, {
        readonly: true,
        fileMustExist: true,
      })

      // 设置 WAL 模式和只读 pragma
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('query_only = true')

      return { success: true, dbExists: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[AssetStoreService] 初始化失败:', error)
      return { success: false, dbExists: false, error: msg }
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.db !== null
  }

  /**
   * 获取数据库路径
   */
  getDbPath(): string | null {
    return this.dbPath
  }

  /**
   * 列出资产
   */
  listAssets(params: ListAssetsParams = {}): ListAssetsResult {
    if (!this.db) {
      return { assets: [], total: 0, hasMore: false }
    }

    const {
      type,
      project,
      reviewStatus,
      offset = 0,
      limit = 50,
      orderBy = 'updated_at',
      orderDir = 'DESC',
    } = params

    // 构建 WHERE 条件
    const conditions: string[] = ["status = 'active'"]
    const bindParams: (string | number)[] = []

    if (type) {
      conditions.push('type = ?')
      bindParams.push(type)
    }

    if (project) {
      conditions.push('project = ?')
      bindParams.push(project)
    }

    if (reviewStatus) {
      conditions.push('review_status = ?')
      bindParams.push(reviewStatus)
    }

    const whereClause = conditions.join(' AND ')

    // 查询总数
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM assets WHERE ${whereClause}`)
    const countResult = countStmt.get(...bindParams) as { total: number }
    const total = countResult.total

    // 查询列表
    const validOrderBy = ['name', 'updated_at', 'created_at'].includes(orderBy) ? orderBy : 'updated_at'
    const validOrderDir = orderDir === 'ASC' ? 'ASC' : 'DESC'

    const listStmt = this.db.prepare(`
      SELECT * FROM assets
      WHERE ${whereClause}
      ORDER BY ${validOrderBy} ${validOrderDir}
      LIMIT ? OFFSET ?
    `)

    const assets = listStmt.all(...bindParams, limit + 1, offset) as AssetRecord[]

    // 判断是否有更多
    const hasMore = assets.length > limit
    if (hasMore) {
      assets.pop()
    }

    return { assets, total, hasMore }
  }

  /**
   * 搜索资产（FTS5 全文搜索）
   */
  searchAssets(params: SearchAssetsParams): ListAssetsResult {
    if (!this.db) {
      return { assets: [], total: 0, hasMore: false }
    }

    const { query, type, limit = 50 } = params

    // FTS5 搜索
    // 使用 MATCH 查询，按相关性排序
    const ftsQuery = query.trim().split(/\s+/).join(' OR ')

    let sql: string
    const bindParams: (string | number)[] = []

    if (type) {
      sql = `
        SELECT a.* FROM assets a
        JOIN assets_fts fts ON a.rowid = fts.rowid
        WHERE assets_fts MATCH ? AND a.type = ? AND a.status = 'active'
        ORDER BY bm25(assets_fts) ASC
        LIMIT ?
      `
      bindParams.push(ftsQuery, type, limit + 1)
    } else {
      sql = `
        SELECT a.* FROM assets a
        JOIN assets_fts fts ON a.rowid = fts.rowid
        WHERE assets_fts MATCH ? AND a.status = 'active'
        ORDER BY bm25(assets_fts) ASC
        LIMIT ?
      `
      bindParams.push(ftsQuery, limit + 1)
    }

    try {
      const stmt = this.db.prepare(sql)
      const assets = stmt.all(...bindParams) as AssetRecord[]

      const hasMore = assets.length > limit
      if (hasMore) {
        assets.pop()
      }

      // 注意：FTS5 搜索不返回准确的 total，这里用 hasMore 判断
      return { assets, total: assets.length + (hasMore ? 1 : 0), hasMore }
    } catch (error) {
      // FTS5 查询可能失败（如特殊字符），fallback 到 LIKE 搜索
      console.warn('[AssetStoreService] FTS5 搜索失败，fallback 到 LIKE:', error)
      return this.searchAssetsFallback(params)
    }
  }

  /**
   * LIKE 搜索（fallback）
   */
  private searchAssetsFallback(params: SearchAssetsParams): ListAssetsResult {
    if (!this.db) {
      return { assets: [], total: 0, hasMore: false }
    }

    const { query, type, limit = 50 } = params
    const searchPattern = `%${query}%`

    const conditions: string[] = ["status = 'active'", "(name LIKE ? OR path LIKE ? OR tags LIKE ?)"]
    const bindParams: (string | number)[] = [searchPattern, searchPattern, searchPattern]

    if (type) {
      conditions.push('type = ?')
      bindParams.push(type)
    }

    const whereClause = conditions.join(' AND ')

    const stmt = this.db.prepare(`
      SELECT * FROM assets
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ?
    `)

    const assets = stmt.all(...bindParams, limit + 1) as AssetRecord[]

    const hasMore = assets.length > limit
    if (hasMore) {
      assets.pop()
    }

    return { assets, total: assets.length + (hasMore ? 1 : 0), hasMore }
  }

  /**
   * 获取资产详情
   */
  getAssetById(id: string): AssetRecord | null {
    if (!this.db) {
      return null
    }

    const stmt = this.db.prepare('SELECT * FROM assets WHERE id = ?')
    return stmt.get(id) as AssetRecord | null
  }

  /**
   * 获取统计信息
   */
  getStats(): AssetStoreStats {
    if (!this.db) {
      return {
        totalAssets: 0,
        byType: {} as Record<AssetType, number>,
        byReviewStatus: {} as Record<ReviewStatus, number>,
        lastUpdatedAt: null,
      }
    }

    // 总数
    const totalStmt = this.db.prepare("SELECT COUNT(*) as total FROM assets WHERE status = 'active'")
    const totalResult = totalStmt.get() as { total: number }
    const totalAssets = totalResult.total

    // 按类型统计
    const typeStmt = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM assets
      WHERE status = 'active'
      GROUP BY type
    `)
    const typeRows = typeStmt.all() as { type: string; count: number }[]
    const byType = typeRows.reduce(
      (acc, row) => {
        acc[row.type as AssetType] = row.count
        return acc
      },
      {} as Record<AssetType, number>
    )

    // 按审核状态统计
    const reviewStmt = this.db.prepare(`
      SELECT review_status, COUNT(*) as count
      FROM assets
      WHERE status = 'active'
      GROUP BY review_status
    `)
    const reviewRows = reviewStmt.all() as { review_status: string; count: number }[]
    const byReviewStatus = reviewRows.reduce(
      (acc, row) => {
        acc[row.review_status as ReviewStatus] = row.count
        return acc
      },
      {} as Record<ReviewStatus, number>
    )

    // 最后更新时间
    const lastUpdateStmt = this.db.prepare(`
      SELECT MAX(updated_at) as last_updated_at
      FROM assets
      WHERE status = 'active'
    `)
    const lastUpdateResult = lastUpdateStmt.get() as { last_updated_at: number | null }
    const lastUpdatedAt = lastUpdateResult.last_updated_at

    return { totalAssets, byType, byReviewStatus, lastUpdatedAt }
  }

  /**
   * 获取所有项目列表
   */
  listProjects(): string[] {
    if (!this.db) {
      return []
    }

    const stmt = this.db.prepare(`
      SELECT DISTINCT project
      FROM assets
      WHERE status = 'active' AND project IS NOT NULL AND project != ''
      ORDER BY project
    `)
    const rows = stmt.all() as { project: string }[]
    return rows.map((row) => row.project)
  }

  /**
   * 获取审核队列
   *
   * 返回待审核/审核中/已通过/已拒绝的资产列表
   */
  getReviewQueue(params: {
    status?: 'pending' | 'approved' | 'rejected' | 'needs_review'
    offset?: number
    limit?: number
  }): { items: Array<AssetRecord & { reviewHistory?: ReviewHistoryRecord[] }>; total: number; hasMore: boolean } {
    if (!this.db) {
      return { items: [], total: 0, hasMore: false }
    }

    const { status, offset = 0, limit = 50 } = params

    // 构建 WHERE 条件
    const conditions: string[] = ["status = 'active'"]
    const bindParams: (string | number)[] = []

    if (status) {
      conditions.push('review_status = ?')
      bindParams.push(status)
    } else {
      // 默认查询所有需要审核的（pending + needs_review）
      conditions.push("review_status IN ('pending', 'needs_review', 'approved', 'rejected')")
    }

    const whereClause = conditions.join(' AND ')

    // 查询总数
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM assets WHERE ${whereClause}`)
    const countResult = countStmt.get(...bindParams) as { total: number }
    const total = countResult.total

    // 查询列表
    const listStmt = this.db.prepare(`
      SELECT * FROM assets
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `)

    const assets = listStmt.all(...bindParams, limit + 1, offset) as AssetRecord[]

    // 判断是否有更多
    const hasMore = assets.length > limit
    if (hasMore) {
      assets.pop()
    }

    // 查询每个资产的审核历史（最近一条）
    const items = assets.map((asset) => {
      const historyStmt = this.db!.prepare(`
        SELECT * FROM review_history
        WHERE asset_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `)
      const reviewHistory = historyStmt.all(asset.id) as ReviewHistoryRecord[]
      return { ...asset, reviewHistory }
    })

    return { items, total, hasMore }
  }

  /**
   * 获取审核统计
   */
  getReviewStats(): {
    pending: number
    needsReview: number
    approved: number
    rejected: number
  } {
    if (!this.db) {
      return { pending: 0, needsReview: 0, approved: 0, rejected: 0 }
    }

    const stmt = this.db.prepare(`
      SELECT review_status, COUNT(*) as count
      FROM assets
      WHERE status = 'active'
      GROUP BY review_status
    `)
    const rows = stmt.all() as { review_status: string; count: number }[]

    const result = { pending: 0, needsReview: 0, approved: 0, rejected: 0 }
    for (const row of rows) {
      if (row.review_status === 'pending') result.pending = row.count
      else if (row.review_status === 'needs_review') result.needsReview = row.count
      else if (row.review_status === 'approved') result.approved = row.count
      else if (row.review_status === 'rejected') result.rejected = row.count
    }

    return result
  }
}

// 导出单例
export const assetStoreService = new AssetStoreService()
