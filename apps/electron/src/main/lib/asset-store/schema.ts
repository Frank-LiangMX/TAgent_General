/**
 * 资产库 SQLite Schema
 *
 * 设计原则：
 * - TAgent UI 只读（better-sqlite3 + readonly pragma）
 * - ta_agent MCP Server 独占写权
 * - WAL 模式避免并发冲突
 * - FTS5 支持全文搜索
 */

import type { Database } from 'better-sqlite3'

/**
 * 初始化资产库数据库
 *
 * @param db - better-sqlite3 Database 实例
 * @param readonly - 是否以只读模式打开（TAgent UI 应为 true）
 */
export function initializeAssetStoreDb(db: Database, readonly: boolean = true): void {
  // 设置 WAL 模式（即使 readonly 也需要读取 WAL 文件）
  db.pragma('journal_mode = WAL')

  // 只读模式下设置 readonly pragma
  if (readonly) {
    db.pragma('query_only = true')
  }

  // 创建 assets 表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      path TEXT NOT NULL,
      project TEXT,
      status TEXT DEFAULT 'active',
      tags TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      analyzed_at INTEGER,
      review_status TEXT DEFAULT 'pending',
      review_notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project);
    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_assets_updated_at ON assets(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assets_review_status ON assets(review_status);
  `)

  // 创建 FTS5 全文搜索索引（如果不存在）
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
      name,
      path,
      tags,
      metadata,
      content='assets',
      content_rowid='rowid'
    );

    -- 触发器：INSERT 时同步到 FTS
    CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
      INSERT INTO assets_fts(rowid, name, path, tags, metadata)
      VALUES (new.rowid, new.name, new.path, new.tags, new.metadata);
    END;

    -- 触发器：DELETE 时同步到 FTS
    CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
      INSERT INTO assets_fts(assets_fts, rowid, name, path, tags, metadata)
      VALUES ('delete', old.rowid, old.name, old.path, old.tags, old.metadata);
    END;

    -- 触发器：UPDATE 时同步到 FTS
    CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
      INSERT INTO assets_fts(assets_fts, rowid, name, path, tags, metadata)
      VALUES ('delete', old.rowid, old.name, old.path, old.tags, old.metadata);
      INSERT INTO assets_fts(rowid, name, path, tags, metadata)
      VALUES (new.rowid, new.name, new.path, new.tags, new.metadata);
    END;
  `)

  // 创建 review_history 表（审核历史）
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reviewer TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_review_history_asset_id ON review_history(asset_id);
  `)
}

/**
 * 资产类型枚举
 */
export type AssetType =
  | 'mesh'
  | 'texture'
  | 'material'
  | 'animation'
  | 'audio'
  | 'skeleton'
  | 'particle'
  | 'level'
  | 'blueprint'
  | 'other'

/**
 * 资产状态枚举
 */
export type AssetStatus = 'active' | 'archived' | 'deleted'

/**
 * 审核状态枚举
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_review'

/**
 * 资产记录类型
 */
export interface AssetRecord {
  id: string
  name: string
  type: AssetType
  path: string
  project?: string
  status: AssetStatus
  tags?: string
  metadata?: string
  created_at: number
  updated_at: number
  analyzed_at?: number
  review_status: ReviewStatus
  review_notes?: string
}

/**
 * 审核历史记录类型
 */
export interface ReviewHistoryRecord {
  id: number
  asset_id: string
  action: 'approve' | 'reject' | 'request_changes' | 'comment'
  reviewer?: string
  notes?: string
  created_at: number
}
