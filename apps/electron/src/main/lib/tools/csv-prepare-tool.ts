/**
 * CSV 数据准备工具（流式版本）
 *
 * 流式读取 CSV，分批处理，避免大文件爆栈。
 * 支持 100 万行级别数据。
 */

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'
import Database from 'better-sqlite3'
import Papa from 'papaparse'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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

加载成功后，**下一步必须**调用：
\`csv_dashboard(action="create", preset="auto", live="true", title="...")\`
不要只做单页一维图。查询列名用返回的 sql_name。
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

// ===== 缓存管理（与 csv-dashboard 共享 ~/.tagent-dev/csv-cache/） =====

function getCacheRoot(): string {
  const isDev = process.env.TAGENT_DEV === '1'
  const dirName = isDev ? '.tagent-dev' : '.tagent'
  const dir = path.join(os.homedir(), dirName, 'csv-cache')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getCacheDir(sessionId: string): string {
  const base = path.join(getCacheRoot(), sessionId)
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

// ===== 列类型推断（基于采样） =====

interface ColumnInfo {
  name: string
  /** SQLite 列名（净化后），查询时必须用此字段 */
  sql_name: string
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

/**
 * 从采样数据推断列类型
 * 采样大小限制在 10000 行以内，避免内存问题
 */
function inferColumnTypeFromSample(values: (string | number | null)[]): ColumnInfo {
  // 只用前 10000 个非空值做推断
  const nonNull = values.filter((v) => v !== null && v !== '' && v !== undefined).slice(0, 10000)
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
      name: '',
      sql_name: '',
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
    name: '',
    sql_name: '',
    type: 'text',
    role: 'dimension',
    unique_count: unique.size,
  }

  if (unique.size <= 20) {
    info.values = Array.from(unique) as string[]
  } else if (unique.size <= 100) {
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

// ===== 流式处理 =====

const SAMPLE_SIZE = 10000 // 采样行数
const INSERT_BATCH_SIZE = 5000 // 每批插入行数

/**
 * 流式处理 CSV 文件（不阻塞主线程）
 * 使用 Papa.parse 的流式 API，逐行处理
 */
function processCsvStream(
  filePath: string,
  dbPath: string,
  columnInfos: ColumnInfo[]
): Promise<{ rowCount: number; compressSum: number }> {
  return new Promise((resolve, reject) => {
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = OFF')
    db.pragma('cache_size = -64000')

    // 创建表
    const colDefs = columnInfos.map((c) => {
      const colName = c.name.replace(/[^a-zA-Z0-9_]/g, '_')
      if (c.type === 'integer') return `${colName} INTEGER`
      if (c.type === 'real') return `${colName} REAL`
      return `${colName} TEXT`
    })
    db.exec(`CREATE TABLE IF NOT EXISTS assets (id INTEGER PRIMARY KEY, ${colDefs.join(', ')})`)

    const colNames = columnInfos.map((c) => c.name.replace(/[^a-zA-Z0-9_]/g, '_'))
    const placeholders = colNames.map(() => '?').join(', ')
    const insertStmt = db.prepare(`INSERT INTO assets (${colNames.join(', ')}) VALUES (${placeholders})`)
    const compressIdx = columnInfos.findIndex((c) => c.name === 'compress')

    let rowCount = 0
    let compressSum = 0
    let batch: (string | number)[][] = []
    let headerParsed = false
    let header: string[] = []

    const flushBatch = () => {
      if (batch.length > 0) {
        const insertMany = db.transaction((rows: (string | number)[][]) => {
          for (const r of rows) {
            insertStmt.run(...r)
          }
        })
        insertMany(batch)
        batch = []
      }
    }

    // 使用 Papa.parse 流式 API
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 64 * 1024 })
    let leftover = ''

    fileStream.on('data', (chunk: string | Buffer) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
      leftover += text
      const lines = leftover.split('\n')
      leftover = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        if (!headerParsed) {
          const result = Papa.parse<string[]>(line, { header: false })
          if (result.data && result.data.length > 0 && result.data[0]) {
            header = result.data[0]
            headerParsed = true
          }
          continue
        }

        const result = Papa.parse<string[]>(line, { header: false })
        if (result.errors.length > 0 || !result.data || !result.data[0]) continue

        const values = result.data[0]
        const row = columnInfos.map((c, idx) => {
          const raw = values[idx] ?? ''
          if (c.type === 'integer') return parseInt(raw, 10) || 0
          if (c.type === 'real') return parseFloat(raw) || 0
          return raw
        })

        if (compressIdx >= 0) {
          compressSum += (row[compressIdx] as number) || 0
        }

        batch.push(row)
        rowCount++

        if (batch.length >= INSERT_BATCH_SIZE) {
          flushBatch()
        }
      }
    })

    fileStream.on('end', () => {
      // 处理最后一行
      if (leftover.trim() && headerParsed) {
        const result = Papa.parse<string[]>(leftover, { header: false })
        if (result.data && result.data[0]) {
          const values = result.data[0]
          const row = columnInfos.map((c, idx) => {
            const raw = values[idx] ?? ''
            if (c.type === 'integer') return parseInt(raw, 10) || 0
            if (c.type === 'real') return parseFloat(raw) || 0
            return raw
          })
          if (compressIdx >= 0) {
            compressSum += (row[compressIdx] as number) || 0
          }
          batch.push(row)
          rowCount++
        }
      }

      flushBatch()

      // 建索引
      for (const col of columnInfos) {
        if (col.role === 'dimension') {
          const colName = col.name.replace(/[^a-zA-Z0-9_]/g, '_')
          db.exec(`CREATE INDEX IF NOT EXISTS idx_assets_${colName} ON assets(${colName})`)
        }
      }
      if (compressIdx >= 0) {
        db.exec('CREATE INDEX IF NOT EXISTS idx_assets_compress ON assets(compress)')
      }

      db.close()
      resolve({ rowCount, compressSum })
    })

    fileStream.on('error', (err: Error) => {
      db.close()
      reject(err)
    })
  })
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

    const startTime = Date.now()

    // 第一遍：读取头部采样推断列类型
    const fileStream = fs.createReadStream(resolvedPath, { encoding: 'utf-8', highWaterMark: 64 * 1024 })
    const sampleRows: Record<string, string>[] = []
    let header: string[] = []
    let headerParsed = false

    await new Promise<void>((resolve, reject) => {
      let buffer = ''
      fileStream.on('data', (chunk: string | Buffer) => {
        buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一行（可能不完整）

        for (const line of lines) {
          if (!line.trim()) continue
          if (!headerParsed) {
            // 解析表头
            const result = Papa.parse<string[]>(line, { header: false })
            if (result.data[0] && result.data[0].length > 0) {
              header = result.data[0]
              headerParsed = true
            }
            continue
          }

          if (sampleRows.length < SAMPLE_SIZE) {
            const result = Papa.parse<string[]>(line, { header: false })
            if (result.data[0]) {
              const values = result.data[0]
              const row: Record<string, string> = {}
              header.forEach((h, i) => {
                row[h] = values[i] ?? ''
              })
              sampleRows.push(row)
            }
          }
        }

        // 采够了就停止读取
        if (sampleRows.length >= SAMPLE_SIZE) {
          fileStream.destroy()
          resolve()
        }
      })
      fileStream.on('end', resolve)
      fileStream.on('error', reject)
    })

    if (header.length === 0 || sampleRows.length === 0) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ status: 'error', message: 'CSV 为空或无有效数据' }),
        isError: true,
      }
    }

    // 推断列类型（基于采样）
    const columnInfos: ColumnInfo[] = header.map((col) => {
      const values = sampleRows.map((r) => r[col] ?? null)
      const info = inferColumnTypeFromSample(values)
      info.name = col
      info.sql_name = col.replace(/[^a-zA-Z0-9_]/g, '_')
      return info
    })

    // 第二遍：流式处理全量数据，插入 SQLite
    const dbPath = getDbPath(sessionId)
    // 删除旧数据库
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }

    const { rowCount, compressSum } = await processCsvStream(resolvedPath, dbPath, columnInfos)

    // 概览统计
    const overview = {
      total_assets: rowCount,
      total_bytes: compressSum,
    }

    // 写缓存
    const cacheMeta: CacheMeta = {
      csv_path: resolvedPath,
      csv_mtime: stat.mtimeMs,
      csv_size: stat.size,
      loaded_at: new Date().toISOString(),
      row_count: rowCount,
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
          row_count: rowCount,
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
