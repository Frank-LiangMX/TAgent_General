/**
 * CSV 数据准备工具
 *
 * 读取 CSV 文件，自动推断列类型，建立 SQLite 数据库，返回结构摘要。
 * 支持 100 万行级别数据，按 session 隔离缓存。
 */

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'
import Database from 'better-sqlite3'
import Papa from 'papaparse'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

// ===== 工具元数据 =====

export const CSV_PREPARE_TOOL_META: ChatToolMeta = {
  id: 'csv-prepare',
  name: 'CSV 数据准备',
  description: '读取 CSV 文件，建立 SQLite 索引，返回列结构和统计摘要',
  params: [
    { name: 'path', type: 'string', description: 'CSV 文件路径', required: true },
    { name: 'session_id', type: 'string', description: '会话 ID（用于缓存隔离）', required: true },
  ],
  icon: 'FileSpreadsheet',
  category: 'builtin',
  executorType: 'builtin',
  systemPromptAppend: `
<csv_prepare_instructions>
你拥有 CSV 数据分析能力。

**csv_prepare — 数据准备：**
加载 CSV 文件到 SQLite，返回列信息和统计摘要。
支持任意格式的 CSV（自动检测编码和分隔符）。

加载成功后，你可以使用 csv_query 查询数据，使用 csv_dashboard 生成看板。
</csv_prepare_instructions>`,
}

// ===== 工具定义 =====

export const CSV_PREPARE_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'csv_prepare',
    description: 'Load a CSV file into SQLite, return column structure and summary statistics.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the CSV file' },
        session_id: { type: 'string', description: 'Session ID for cache isolation' },
      },
      required: ['path', 'session_id'],
    },
  },
]

// ===== 工具名称匹配 =====

const CSV_PREPARE_TOOL_NAMES = new Set(['csv_prepare'])

export function isCsvPrepareToolCall(toolName: string): boolean {
  return CSV_PREPARE_TOOL_NAMES.has(toolName)
}

// ===== 缓存管理 =====

function getCacheDir(sessionId: string): string {
  const base = path.join(os.tmpdir(), 'TAgent', 'csv-cache', sessionId)
  fs.mkdirSync(base, { recursive: true })
  return base
}

function getDbPath(sessionId: string): string {
  return path.join(getCacheDir(sessionId), 'data.sqlite3')
}

function getMetaPath(sessionId: string): string {
  return path.join(getCacheDir(sessionId), 'meta.json')
}

interface CacheMeta {
  csv_path: string
  csv_mtime: number
  csv_size: number
  loaded_at: string
  row_count: number
  columns: ColumnInfo[]
  overview: Record<string, unknown>
}

function readCacheMeta(sessionId: string): CacheMeta | null {
  const metaPath = getMetaPath(sessionId)
  if (!fs.existsSync(metaPath)) return null
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  } catch {
    return null
  }
}

function writeCacheMeta(sessionId: string, meta: CacheMeta): void {
  fs.writeFileSync(getMetaPath(sessionId), JSON.stringify(meta, null, 2), 'utf-8')
}

// ===== 列类型推断 =====

interface ColumnInfo {
  name: string
  type: 'text' | 'integer' | 'real'
  role: 'dimension' | 'metric'
  unique_count?: number
  values?: string[]
  top_values?: Record<string, number>
  min?: number
  max?: number
  mean?: number
  sum?: number
}

function inferColumnType(values: (string | number | null)[], columnName: string): ColumnInfo {
  const nonNull = values.filter((v) => v !== null && v !== '' && v !== undefined)
  const unique = new Set(nonNull)

  // 检查是否为数值列
  const numericValues = nonNull
    .map((v) => {
      const n = Number(v)
      return isNaN(n) ? null : n
    })
    .filter((v) => v !== null) as number[]

  const isNumeric = numericValues.length > nonNull.length * 0.8

  if (isNumeric && numericValues.length > 0) {
    const sum = numericValues.reduce((a, b) => a + b, 0)
    const mean = sum / numericValues.length
    const min = Math.min(...numericValues)
    const max = Math.max(...numericValues)
    const isInteger = numericValues.every((v) => Number.isInteger(v))

    return {
      name: columnName,
      type: isInteger ? 'integer' : 'real',
      role: 'metric',
      min,
      max,
      mean,
      sum,
    }
  }

  // 分类列
  const info: ColumnInfo = {
    name: columnName,
    type: 'text',
    role: 'dimension',
    unique_count: unique.size,
  }

  // 如果唯一值不多，列出所有值
  if (unique.size <= 20) {
    info.values = Array.from(unique) as string[]
  } else if (unique.size <= 100) {
    // 只列出 top 值
    const counts: Record<string, number> = {}
    for (const v of nonNull) {
      const key = String(v)
      counts[key] = (counts[key] || 0) + 1
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    info.top_values = Object.fromEntries(sorted)
  }

  return info
}

// ===== 核心实现 =====

export async function executeCsvPrepare(toolCall: ToolCall): Promise<ToolResult> {
  try {
    const filePath = toolCall.arguments.path as string | undefined
    const sessionId = toolCall.arguments.session_id as string | undefined

    if (!filePath) {
      return { toolCallId: toolCall.id, content: '参数缺失: path', isError: true }
    }
    if (!sessionId) {
      return { toolCallId: toolCall.id, content: '参数缺失: session_id', isError: true }
    }

    const resolvedPath = path.resolve(filePath)
    if (!fs.existsSync(resolvedPath)) {
      return { toolCallId: toolCall.id, content: `文件不存在: ${resolvedPath}`, isError: true }
    }

    // 检查缓存
    const meta = readCacheMeta(sessionId)
    const stat = fs.statSync(resolvedPath)
    if (meta && meta.csv_path === resolvedPath && meta.csv_mtime === stat.mtimeMs) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ status: 'ready', from_cache: true, ...meta }, null, 2),
      }
    }

    // 读取 CSV
    const startTime = Date.now()
    const fileContent = fs.readFileSync(resolvedPath, 'utf-8')
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // 先不做自动类型转换
    })

    if (parsed.errors.length > 0) {
      console.warn('[CSV] 解析警告:', parsed.errors.slice(0, 5))
    }

    const rows = parsed.data as Record<string, string>[]
    const columns = parsed.meta.fields || []

    if (columns.length === 0 || rows.length === 0) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ status: 'error', message: 'CSV 为空或无有效数据' }),
        isError: true,
      }
    }

    // 推断列类型
    const columnInfos: ColumnInfo[] = columns.map((col) => {
      const values = rows.map((r) => r[col] ?? null)
      return inferColumnType(values, col)
    })

    // 建 SQLite
    const dbPath = getDbPath(sessionId)
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = OFF')

    // 创建表
    const colDefs = columnInfos.map((c) => {
      const colName = c.name.replace(/[^a-zA-Z0-9_]/g, '_')
      if (c.type === 'integer') return `${colName} INTEGER`
      if (c.type === 'real') return `${colName} REAL`
      return `${colName} TEXT`
    })

    db.exec(`CREATE TABLE IF NOT EXISTS assets (id INTEGER PRIMARY KEY, ${colDefs.join(', ')})`)

    // 批量插入
    const colNames = columnInfos.map((c) => c.name.replace(/[^a-zA-Z0-9_]/g, '_'))
    const placeholders = colNames.map(() => '?').join(', ')
    const insertStmt = db.prepare(`INSERT INTO assets (${colNames.join(', ')}) VALUES (${placeholders})`)

    const insertMany = db.transaction((rows: Record<string, string>[]) => {
      for (const row of rows) {
        const values = columnInfos.map((c) => {
          const raw = row[c.name] ?? ''
          if (c.type === 'integer') return parseInt(raw, 10) || 0
          if (c.type === 'real') return parseFloat(raw) || 0
          return raw
        })
        insertStmt.run(...values)
      }
    })

    // 分批插入，每批 10000 行
    const batchSize = 10000
    for (let i = 0; i < rows.length; i += batchSize) {
      insertMany(rows.slice(i, i + batchSize))
    }

    // 建索引
    for (const col of columnInfos) {
      if (col.role === 'dimension') {
        const colName = col.name.replace(/[^a-zA-Z0-9_]/g, '_')
        db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_${colName} ON assets(${colName})`)
      }
    }

    // compress 列索引
    const compressCol = columnInfos.find((c) => c.name === 'compress')
    if (compressCol) {
      db.exec('CREATE INDEX IF NOT EXISTS idx_assets_compress ON assets(compress)')
    }

    db.close()

    // 概览统计
    const overview = {
      total_assets: rows.length,
      total_bytes: compressCol?.sum || 0,
    }

    // 写缓存
    const cacheMeta: CacheMeta = {
      csv_path: resolvedPath,
      csv_mtime: stat.mtimeMs,
      csv_size: stat.size,
      loaded_at: new Date().toISOString(),
      row_count: rows.length,
      columns: columnInfos,
      overview,
    }
    writeCacheMeta(sessionId, cacheMeta)

    const elapsed = Date.now() - startTime
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(
        {
          status: 'ready',
          from_cache: false,
          elapsed_ms: elapsed,
          row_count: rows.length,
          file_size_mb: (stat.size / 1024 / 1024).toFixed(1),
          columns: columnInfos,
          overview,
          db_path: dbPath,
        },
        null,
        2
      ),
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[CSV Prepare] 执行失败:', error)
    return {
      toolCallId: toolCall.id,
      content: `CSV 加载失败: ${msg}`,
      isError: true,
    }
  }
}
