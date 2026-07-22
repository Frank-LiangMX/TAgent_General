/**
 * CSV 工具共享层：路径、列名净化、SQL 构建、只读查询
 */

import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface CsvFilter {
  column: string
  op: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN'
  value: string | number
}

export interface CsvColumnMeta {
  name: string
  sql_name?: string
  type: 'text' | 'integer' | 'real'
  role: 'dimension' | 'metric'
  unique_count?: number
  values?: string[]
  top_values?: Record<string, number>
}

export interface CsvCacheMeta {
  csv_path: string
  csv_mtime: number
  csv_size: number
  loaded_at: string
  row_count: number
  columns: CsvColumnMeta[]
  overview: Record<string, unknown>
}

export interface CsvQueryInput {
  groupby?: string | string[]
  agg?: string
  filters?: CsvFilter[]
  select?: string
  sort?: string
  sort_dir?: 'asc' | 'desc' | string
  limit?: number
  offset?: number
}

export interface CsvQueryResult {
  query: string
  row_count: number
  columns: string[]
  rows: Record<string, unknown>[]
  total_before_limit: number
}

/** 列名净化：与建表规则一致 */
export function sanitizeColumnName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_')
}

export function getCsvCacheRoot(): string {
  const isDev = process.env.TAGENT_DEV === '1'
  const dirName = isDev ? '.tagent-dev' : '.tagent'
  const dir = path.join(os.homedir(), dirName, 'csv-cache')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getCsvSessionDir(sessionId: string): string {
  const dir = path.join(getCsvCacheRoot(), sessionId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getCsvDbPath(sessionId: string): string {
  return path.join(getCsvSessionDir(sessionId), 'data.sqlite3')
}

export function getCsvMetaPath(sessionId: string): string {
  return path.join(getCsvSessionDir(sessionId), 'meta.json')
}

export function readCsvCacheMeta(sessionId: string): CsvCacheMeta | null {
  const metaPath = getCsvMetaPath(sessionId)
  if (!fs.existsSync(metaPath)) return null
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as CsvCacheMeta
  } catch {
    return null
  }
}

/** 解析 groupby：支持 "a,b" 或 ["a","b"] */
export function parseGroupByColumns(groupby: string | string[] | undefined): string[] {
  if (!groupby) return []
  if (Array.isArray(groupby)) {
    return groupby.map((g) => g.trim()).filter(Boolean)
  }
  return groupby
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
}

export function buildWhereClause(filters: CsvFilter[] | undefined): {
  sql: string
  params: (string | number)[]
} {
  if (!filters || filters.length === 0) return { sql: '', params: [] }

  const conditions: string[] = []
  const params: (string | number)[] = []

  for (const f of filters) {
    const col = sanitizeColumnName(f.column)
    const op = String(f.op || '=').toUpperCase()

    if (op === 'IN' && typeof f.value === 'string') {
      const values = f.value.split(',').map((v) => v.trim()).filter(Boolean)
      if (values.length === 0) continue
      const placeholders = values.map(() => '?').join(',')
      conditions.push(`${col} IN (${placeholders})`)
      params.push(...values)
    } else if (op === 'LIKE') {
      conditions.push(`${col} LIKE ?`)
      params.push(`%${f.value}%`)
    } else {
      conditions.push(`${col} ${op} ?`)
      params.push(f.value)
    }
  }

  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export function buildAggSelect(groupbyCols: string[], agg: string | undefined): string {
  const parts: string[] = []
  for (const col of groupbyCols) {
    parts.push(sanitizeColumnName(col))
  }

  if (!agg) {
    if (groupbyCols.length === 0) return '*'
    parts.push('COUNT(*) AS count')
    return parts.join(', ')
  }

  const aggExprs = agg.split(',').map((a) => a.trim()).filter(Boolean)
  for (const expr of aggExprs) {
    const match = expr.match(/^(\w+)\(([^)]+)\)$/)
    if (match && match[1] && match[2]) {
      const func = match[1].toLowerCase()
      const col = sanitizeColumnName(match[2].trim())
      parts.push(`${func}(${col}) AS ${func}_${col}`)
    } else if (expr.toLowerCase() === 'count') {
      parts.push('COUNT(*) AS count')
    } else {
      parts.push(sanitizeColumnName(expr))
    }
  }

  return parts.join(', ')
}

/** 对 session 的 SQLite 执行只读查询 */
export function runCsvQuery(sessionId: string, input: CsvQueryInput): CsvQueryResult {
  const dbPath = getCsvDbPath(sessionId)
  if (!fs.existsSync(dbPath)) {
    throw new Error('数据未加载。请先调用 csv_prepare 加载 CSV 文件。')
  }

  const db = new Database(dbPath, { readonly: true })
  try {
    const groupbyCols = parseGroupByColumns(input.groupby)
    const agg = input.agg
    const selectCols = input.select
    const sort = input.sort
    const sortDir = (input.sort_dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const limit = Math.max(1, Math.min(input.limit ?? 100, 5000))
    const offset = Math.max(0, input.offset ?? 0)
    const filters = input.filters || []

    let select: string
    if (groupbyCols.length > 0 || agg) {
      select = buildAggSelect(groupbyCols, agg)
    } else if (selectCols) {
      select = selectCols
        .split(',')
        .map((c) => sanitizeColumnName(c.trim()))
        .filter(Boolean)
        .join(', ')
    } else {
      select = '*'
    }

    const { sql: whereSql, params: whereParams } = buildWhereClause(filters)
    const groupBySql =
      groupbyCols.length > 0
        ? ` GROUP BY ${groupbyCols.map((c) => sanitizeColumnName(c)).join(', ')}`
        : ''

    let orderBy = ''
    if (sort) {
      const sortCol =
        sort.startsWith('count') || sort.startsWith('sum_') || sort.startsWith('avg_') || sort.startsWith('min_') || sort.startsWith('max_')
          ? sort
          : sanitizeColumnName(sort)
      orderBy = ` ORDER BY ${sortCol} ${sortDir}`
    }

    const sql = `SELECT ${select} FROM assets${whereSql}${groupBySql}${orderBy} LIMIT ${limit} OFFSET ${offset}`

    let totalBeforeLimit = 0
    if (groupbyCols.length > 0) {
      const innerSelect = groupbyCols.map((c) => sanitizeColumnName(c)).join(', ')
      const countSql = `SELECT COUNT(*) as cnt FROM (SELECT ${innerSelect} FROM assets${whereSql} GROUP BY ${innerSelect})`
      const countRow = db.prepare(countSql).get(...whereParams) as { cnt: number } | undefined
      totalBeforeLimit = countRow?.cnt || 0
    } else {
      const countSql = `SELECT COUNT(*) as cnt FROM assets${whereSql}`
      const countRow = db.prepare(countSql).get(...whereParams) as { cnt: number } | undefined
      totalBeforeLimit = countRow?.cnt || 0
    }

    const rows = db.prepare(sql).all(...whereParams) as Record<string, unknown>[]
    const columns = rows.length > 0 ? Object.keys(rows[0]!) : []

    return {
      query: sql,
      row_count: rows.length,
      columns,
      rows,
      total_before_limit: totalBeforeLimit,
    }
  } finally {
    db.close()
  }
}

/** 取维度列的 distinct 值（用于筛选下拉） */
export function getFacetValues(
  sessionId: string,
  column: string,
  limit = 50
): { column: string; values: string[]; truncated: boolean } {
  const dbPath = getCsvDbPath(sessionId)
  if (!fs.existsSync(dbPath)) {
    throw new Error('数据未加载')
  }
  const col = sanitizeColumnName(column)
  const db = new Database(dbPath, { readonly: true })
  try {
    const rows = db
      .prepare(
        `SELECT ${col} AS v, COUNT(*) AS c FROM assets WHERE ${col} IS NOT NULL AND ${col} != '' GROUP BY ${col} ORDER BY c DESC LIMIT ?`
      )
      .all(limit + 1) as Array<{ v: string; c: number }>
    const truncated = rows.length > limit
    return {
      column: col,
      values: rows.slice(0, limit).map((r) => String(r.v)),
      truncated,
    }
  } finally {
    db.close()
  }
}
