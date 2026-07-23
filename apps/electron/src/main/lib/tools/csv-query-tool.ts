/**
 * CSV 查询工具
 *
 * 对已加载的 CSV 数据进行聚合、筛选、排序查询。
 * 支持多列 groupby（交叉维度），所有查询走 SQLite。
 */

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'
import * as fs from 'fs'
import { getCsvDbPath, parseGroupByColumns, runCsvQuery, type CsvFilter } from './csv-shared'

// ===== 工具元数据 =====

export const CSV_QUERY_TOOL_META: ChatToolMeta = {
  id: 'csv-query',
  name: 'CSV 数据查询',
  description: '对已加载的 CSV 数据进行聚合、筛选、排序查询（支持多列交叉 groupby）',
  params: [
    { name: 'session_id', type: 'string', description: '会话 ID', required: true },
    {
      name: 'groupby',
      type: 'string',
      description: '分组字段，单列或多列逗号分隔，如 "fcat" 或 "fcat,module"',
    },
    {
      name: 'agg',
      type: 'string',
      description: '聚合函数，逗号分隔，如 "count,sum(compress),avg(compress)"',
    },
    {
      name: 'filters',
      type: 'string',
      description: '筛选条件 JSON 数组，如 [{"column":"fcat","op":"=","value":"贴图"}]',
    },
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

**多维交叉（重要）：**
- groupby 支持多列：\`groupby="fcat,module"\` → 得到「类型 × 模块」交叉表
- 先 filter 再 groupby：\`filters=[{"column":"module","op":"=","value":"植被"}], groupby="fcat"\` → 植被下的类型分布
- 反过来：\`filters=[{"column":"fcat","op":"=","value":"贴图"}], groupby="module"\` → 贴图在各模块的分布

查询结果天然是严谨的，你必须：
- 在回答中引用查询结果
- 不得使用"大概"、"估计"等模糊词
- 无法回答时说"需要查询数据"
- 列名使用 csv_prepare 返回的 sql_name（或净化后的 name）
</csv_query_instructions>`,
}

// ===== 工具定义 =====

export const CSV_QUERY_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'csv_query',
    description:
      'Query aggregated/filtered data from loaded CSV. Supports multi-column groupby, aggregation, filtering, sorting.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID' },
        groupby: {
          type: 'string',
          description:
            'Group by column(s), comma-separated for cross-dim. e.g. "fcat" or "fcat,module"',
        },
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

// ===== 核心实现 =====

export function executeCsvQuery(toolCall: ToolCall): ToolResult {
  try {
    const sessionId = toolCall.arguments.session_id as string | undefined
    if (!sessionId) {
      return { toolCallId: toolCall.id, content: '参数缺失: session_id', isError: true }
    }

    const dbPath = getCsvDbPath(sessionId)
    if (!fs.existsSync(dbPath)) {
      return {
        toolCallId: toolCall.id,
        content: '数据未加载。请先调用 csv_prepare 加载 CSV 文件。',
        isError: true,
      }
    }

    let filters: CsvFilter[] = []
    const filtersStr = toolCall.arguments.filters as string | undefined
    if (filtersStr) {
      try {
        filters = JSON.parse(filtersStr)
      } catch {
        return { toolCallId: toolCall.id, content: 'filters JSON 格式错误', isError: true }
      }
    }

    const groupbyRaw = toolCall.arguments.groupby as string | undefined
    const groupbyCols = parseGroupByColumns(groupbyRaw)

    const result = runCsvQuery(sessionId, {
      groupby: groupbyCols,
      agg: toolCall.arguments.agg as string | undefined,
      filters,
      select: toolCall.arguments.select as string | undefined,
      sort: toolCall.arguments.sort as string | undefined,
      sort_dir: (toolCall.arguments.sort_dir as string) || 'desc',
      limit: parseInt(toolCall.arguments.limit as string, 10) || 100,
      offset: parseInt(toolCall.arguments.offset as string, 10) || 0,
    })

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(
        {
          ...result,
          groupby_columns: groupbyCols,
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
