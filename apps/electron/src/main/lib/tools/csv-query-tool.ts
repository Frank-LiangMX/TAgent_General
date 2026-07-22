/**
 * CSV 查询工具
 *
 * 对已加载的 CSV 数据进行聚合、筛选、排序查询。
 * 所有查询通过 SQLite 执行，确保数据严谨性。
 */

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ===== 工具元数据 =====

export const CSV_QUERY_TOOL_META: ChatToolMeta = {
  id: 'csv-query',
  name: 'CSV 数据查询',
  description: '对已加载的 CSV 数据进行聚合、筛选、排序查询',
  params: [
    { name: 'session_id', type: 'string', description: '会话 ID', required: true },
    { name: 'groupby', type: 'string', description: '分组字段（可选）' },
    { name: 'agg', type: 'string', description: '聚合函数，逗号分隔，如 "count,sum(compress),avg(compress)"' },
    { name: 'filters', type: 'string', description: '筛选条件 JSON 数组，如 [{"column":"fcat","op":"=","value":"贴图"}]' },
    { name: 'select', type: 'string', description: '选择字段，逗号分隔（不填则返回所有）' },
    { name: 'sort', type: 'string', description: '排序字段' },
    { name: 'sort_dir', type: 'string', description: '排序方向 asc/desc' },
    { name: 'limit', type: 'string', description: '返回条数' },
    { name: 'offset', type: 'string', description: '偏移量' },
  ],
  icon: 'Search',
  category: 'builtin',
  executorType: 'builtin',
  systemPromptAppend: `
<csv_query_instructions>
你拥有 CSV 数据查询能力。

**csv_query — 数据查询：**
对已加载的 CSV 数据执行 SQL 聚合/筛选查询。

查询结果天然是严谨的，你必须：
- 在回答中引用查询结果
- 不得使用"大概"、"估计"等模糊词
- 无法回答时说"需要查询数据"
</csv_query_instructions>`,
}

// ===== 工具定义 =====

export const CSV_QUERY_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'csv_query',
    description:
      'Query aggregated/filtered data from loaded CSV. Supports groupby, aggregation, filtering, sorting.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID' },
        groupby: { type: 'string', description: 'Group by column name' },
        agg: {
          type: 'string',
          description: 'Aggregation functions, comma-separated. e.g. "count,sum(compress)"',
        },
        filters: {
          type: 'string',
          description:
            'JSON array of filter objects. e.g. [{"column":"fcat","op":"=","value":"贴图"}]',
        },
        select: { type: 'string', description: 'Columns to select, comma-separated' },
        sort: { type: 'string', description: 'Sort column' },
        sort_dir: { type: 'string', description: 'Sort direction: asc or desc' },
        limit: { type: 'string', description: 'Max rows to return' },
        offset: { type: 'string', description: 'Offset for pagination' },
      },
      required: ['session_id'],
    },
  },
]

// ===== 工具名称匹配 =====

const CSV_QUERY_TOOL_NAMES = new Set(['csv_query'])

export function isCsvQueryToolCall(toolName: string): boolean {
  return CSV_QUERY_TOOL_NAMES.has(toolName)
}

// ===== 缓存路径 =====

function getDbPath(sessionId: string): string {
  return path.join(os.tmpdir(), 'TAgent', 'csv-cache', sessionId, 'data.sqlite3')
}

// ===== SQL 构建 =====

interface Filter {
  column: string
  op: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN'
  value: string | number
}

function sanitizeColumnName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_')
}

function buildWhereClause(filters: Filter[]): { sql: string; params: (string | number)[] } {
  if (!filters || filters.length === 0) return { sql: '', params: [] }

  const conditions: string[] = []
  const params: (string | number)[] = []

  for (const f of filters) {
    const col = sanitizeColumnName(f.column)
    const op = f.op.toUpperCase()

    if (op === 'IN' && typeof f.value === 'string') {
      const values = f.value.split(',').map((v) => v.trim())
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

  return { sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '', params }
}

function buildAggSelect(groupby: string | undefined, agg: string | undefined): string {
  if (!agg) return groupby ? `${sanitizeColumnName(groupby)}, COUNT(*) AS count` : '*'

  const parts: string[] = []
  if (groupby) {
    parts.push(sanitizeColumnName(groupby))
  }

  const aggExprs = agg.split(',').map((a) => a.trim())
  for (const expr of aggExprs) {
    // 解析 agg 表达式: "count", "sum(compress)", "avg(compress)"
    const match = expr.match(/^(\w+)\((\w+)\)$/)
    if (match && match[1] && match[2]) {
      const func = match[1]
      const col = match[2]
      const safeFunc = func.toLowerCase()
      const safeCol = sanitizeColumnName(col)
      parts.push(`${safeFunc}(${safeCol}) AS ${safeFunc}_${safeCol}`)
    } else if (expr === 'count') {
      parts.push('COUNT(*) AS count')
    } else {
      parts.push(sanitizeColumnName(expr))
    }
  }

  return parts.join(', ')
}

// ===== 核心实现 =====

export function executeCsvQuery(toolCall: ToolCall): ToolResult {
  try {
    const sessionId = toolCall.arguments.session_id as string | undefined
    if (!sessionId) {
      return { toolCallId: toolCall.id, content: '参数缺失: session_id', isError: true }
    }

    const dbPath = getDbPath(sessionId)
    if (!fs.existsSync(dbPath)) {
      return {
        toolCallId: toolCall.id,
        content: '数据未加载。请先调用 csv_prepare 加载 CSV 文件。',
        isError: true,
      }
    }

    const db = new Database(dbPath, { readonly: true })

    const groupby = toolCall.arguments.groupby as string | undefined
    const agg = toolCall.arguments.agg as string | undefined
    const selectCols = toolCall.arguments.select as string | undefined
    const sort = toolCall.arguments.sort as string | undefined
    const sortDir = (toolCall.arguments.sort_dir as string) || 'desc'
    const limit = parseInt(toolCall.arguments.limit as string, 10) || 100
    const offset = parseInt(toolCall.arguments.offset as string, 10) || 0

    // 解析 filters
    let filters: Filter[] = []
    const filtersStr = toolCall.arguments.filters as string | undefined
    if (filtersStr) {
      try {
        filters = JSON.parse(filtersStr)
      } catch {
        return { toolCallId: toolCall.id, content: 'filters JSON 格式错误', isError: true }
      }
    }

    // 构建 SQL
    let select: string
    if (groupby || agg) {
      select = buildAggSelect(groupby, agg)
    } else if (selectCols) {
      select = selectCols
        .split(',')
        .map((c) => sanitizeColumnName(c.trim()))
        .join(', ')
    } else {
      select = '*'
    }

    const { sql: whereSql, params: whereParams } = buildWhereClause(filters)
    let groupBySql = groupby ? ` GROUP BY ${sanitizeColumnName(groupby)}` : ''
    let orderBy = ''

    if (sort) {
      // 检查 sort 是否是聚合结果字段
      const sortCol = sort.startsWith('count') || sort.startsWith('sum_') || sort.startsWith('avg_')
        ? sort
        : sanitizeColumnName(sort)
      orderBy = ` ORDER BY ${sortCol} ${sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`
    }

    const limitSql = ` LIMIT ${limit}`
    const offsetSql = offset > 0 ? ` OFFSET ${offset}` : ''

    const sql = `SELECT ${select} FROM assets${whereSql}${groupBySql}${orderBy}${limitSql}${offsetSql}`

    // 先获取总数（如果有 groupby，需要特殊处理）
    let totalBeforeLimit = 0
    if (groupby) {
      const countSql = `SELECT COUNT(*) as cnt FROM (SELECT ${sanitizeColumnName(groupby)} FROM assets${whereSql} GROUP BY ${sanitizeColumnName(groupby)})`
      const countRow = db.prepare(countSql).get(...whereParams) as { cnt: number } | undefined
      totalBeforeLimit = countRow?.cnt || 0
    } else {
      const countSql = `SELECT COUNT(*) as cnt FROM assets${whereSql}`
      const countRow = db.prepare(countSql).get(...whereParams) as { cnt: number } | undefined
      totalBeforeLimit = countRow?.cnt || 0
    }

    // 执行查询
    const stmt = db.prepare(sql)
    const rows = stmt.all(...whereParams)
    db.close()

    // 提取列名
    const columns = rows.length > 0 ? Object.keys(rows[0] as object) : []

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(
        {
          query: sql,
          row_count: rows.length,
          columns,
          rows,
          total_before_limit: totalBeforeLimit,
        },
        null,
        2
      ),
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[CSV Query] 执行失败:', error)
    return {
      toolCallId: toolCall.id,
      content: `查询失败: ${msg}`,
      isError: true,
    }
  }
}
