/**
 * CSV 看板切片页构建器
 *
 * 根据自然语言/简单参数识别过滤维与值，生成合法 DashboardSectionV2，
 * 供 csv_dashboard(action="slice" persist=true / action="live_tab") 使用；
 * slice 默认走内存 live_tab，不写 dashboard.html。
 */

import {
  getFacetValues,
  readCsvCacheMeta,
  runCsvQuery,
  sanitizeColumnName,
  type CsvColumnMeta,
  type CsvFilter,
} from './csv-shared'
import {
  formatBytes,
  pickChartDimensions,
  pickDetailColumns,
  pickFilterSelectDims,
  pickMetrics,
  scoreDimension,
  type AutoDashboardSection,
  type ByteUnit,
} from './csv-auto-builder'

export interface SliceResolveInput {
  filter_column?: string
  filter_value?: string
  label?: string
  slice_query?: string
}

export interface SliceResolveResult {
  filterColumn: string
  filterColumnMeta: CsvColumnMeta
  filterValue: string
  label: string
  viewId: string
}

export interface SliceViewBuildResult {
  viewId: string
  label: string
  sections: AutoDashboardSection[]
  filterColumn: string
  filterValue: string
}

function colSql(c: CsvColumnMeta): string {
  return c.sql_name || sanitizeColumnName(c.name)
}

function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function formatMetric(n: number, hint: string, byteUnit: ByteUnit = 'auto'): string {
  const h = hint.toLowerCase()
  if (/byte|size|compress|volume|体积|容量/.test(h) || n > 10_000_000) {
    return formatBytes(n, byteUnit)
  }
  if (Number.isInteger(n) || Math.abs(n) >= 1000) return formatCount(n)
  return n.toFixed(2)
}

function columnDisplayLabel(col: CsvColumnMeta): string {
  const key = colSql(col).toLowerCase()
  const map: Record<string, string> = {
    owner: '负责人',
    fcat: '类别',
    category: '类别',
    geo_tag: '地理标签',
    path: '路径',
    module: '模块',
    mod: '模块',
    ext: '文件后缀',
    compress: '体积',
    status: '状态',
  }
  if (map[key]) return map[key]
  const name = col.name.trim()
  if (name && !/^[a-z][a-z0-9_]*$/i.test(name)) return name
  return col.name
}

/** 模糊匹配：精确 > 包含 > 忽略大小写包含 */
function matchValueScore(query: string, candidate: string): number {
  const q = query.trim()
  const c = String(candidate).trim()
  if (!q || !c) return 0
  if (q === c) return 100
  if (c.includes(q)) return 85
  if (q.includes(c) && c.length >= 2) return 75
  const ql = q.toLowerCase()
  const cl = c.toLowerCase()
  if (ql === cl) return 95
  if (cl.includes(ql) || ql.includes(cl)) return 70
  return 0
}

function resolveDimValues(sessionId: string, col: CsvColumnMeta): string[] {
  if (col.values && col.values.length > 0) return col.values.map(String)
  if (col.top_values) return Object.keys(col.top_values)
  try {
    return getFacetValues(sessionId, colSql(col), 60).values
  } catch {
    return []
  }
}

function findColumnBySql(columns: CsvColumnMeta[], sqlName: string): CsvColumnMeta | undefined {
  const target = sanitizeColumnName(sqlName)
  return columns.find((c) => colSql(c) === target)
}

function makeSliceViewId(column: string, value: string): string {
  const raw = `slice-${column}-${value}`
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return raw.slice(0, 56) || `slice-${column}`
}

/**
 * 在维度列中解析切片目标（列 + 精确值）
 */
export function resolveSliceTarget(
  sessionId: string,
  input: SliceResolveInput
): SliceResolveResult {
  const meta = readCsvCacheMeta(sessionId)
  if (!meta) {
    throw new Error('数据未加载。请先调用 csv_prepare。')
  }

  const queryText =
    (input.filter_value && input.filter_value.trim()) ||
    (input.slice_query && input.slice_query.trim()) ||
    (input.label && input.label.trim()) ||
    ''

  if (!queryText) {
    throw new Error('请提供 filter_value、slice_query 或 label 之一，用于识别切片条件。')
  }

  const columns = meta.columns || []
  const rowCount = meta.row_count || 0

  if (input.filter_column) {
    const col = findColumnBySql(columns, input.filter_column)
    if (!col) {
      throw new Error(`未找到列「${input.filter_column}」。请检查 csv_prepare 返回的 columns。`)
    }
    const values = resolveDimValues(sessionId, col)
    let best = ''
    let bestScore = 0
    for (const v of values) {
      const s = matchValueScore(queryText, v)
      if (s > bestScore) {
        bestScore = s
        best = v
      }
    }
    if (bestScore < 70) {
      throw new Error(
        `列「${col.name}」中未找到与「${queryText}」匹配的值。可选值示例：${values.slice(0, 8).join('、') || '（无）'}`
      )
    }
    const label = (input.label && input.label.trim()) || best
    return {
      filterColumn: colSql(col),
      filterColumnMeta: col,
      filterValue: best,
      label,
      viewId: makeSliceViewId(colSql(col), best),
    }
  }

  // 自动猜列：在 role=dimension 且 values 含匹配值的列中选分最高者
  const dimCols = columns.filter((c) => c.role === 'dimension')
  let bestCol: CsvColumnMeta | undefined
  let bestVal = ''
  let bestTotal = 0

  for (const col of dimCols) {
    const values = resolveDimValues(sessionId, col)
    for (const v of values) {
      const ms = matchValueScore(queryText, v)
      if (ms < 70) continue
      const total = ms + scoreDimension(col, rowCount)
      if (total > bestTotal) {
        bestTotal = total
        bestCol = col
        bestVal = v
      }
    }
  }

  if (!bestCol || !bestVal) {
    throw new Error(
      `未能在维度列中找到与「${queryText}」匹配的值。请指定 filter_column，或确认 csv_prepare 已加载数据。`
    )
  }

  const label = (input.label && input.label.trim()) || bestVal
  return {
    filterColumn: colSql(bestCol),
    filterColumnMeta: bestCol,
    filterValue: bestVal,
    label,
    viewId: makeSliceViewId(colSql(bestCol), bestVal),
  }
}

function chartDataFromRows(
  rows: Record<string, unknown>[],
  labelCol: string,
  valueCol: string
): Record<string, number> {
  const flat: Record<string, number> = {}
  for (const r of rows) {
    flat[String(r[labelCol] ?? '(空)')] = Number(r[valueCol] ?? 0) || 0
  }
  return flat
}

function barDataFromRows(
  rows: Record<string, unknown>[],
  labelCol: string,
  valueCol: string
): Array<{ name: string; value: number }> {
  return rows.map((r) => ({
    name: String(r[labelCol] ?? '(空)'),
    value: Number(r[valueCol] ?? 0) || 0,
  }))
}

/**
 * 为切片条件生成单页 sections（KPI + 1～2 图 + 筛选 + live 明细）
 */
export function buildSliceViewSections(
  sessionId: string,
  resolved: SliceResolveResult,
  byteUnit: ByteUnit = 'auto'
): SliceViewBuildResult {
  const meta = readCsvCacheMeta(sessionId)
  if (!meta) {
    throw new Error('数据未加载。请先调用 csv_prepare。')
  }

  const columns = meta.columns || []
  const rowCount = meta.row_count || 0
  const baseFilter: CsvFilter = {
    column: resolved.filterColumn,
    op: '=',
    value: resolved.filterValue,
  }
  const filters = [baseFilter]

  const dims = pickChartDimensions(columns, rowCount).filter(
    (d) => colSql(d) !== resolved.filterColumn
  )
  const metrics = pickMetrics(columns)
  const primaryMetric = metrics[0]
  const metricSql = primaryMetric ? colSql(primaryMetric) : undefined
  const valueAlias = metricSql ? `sum_${metricSql}` : 'count'
  const agg = metricSql ? `count,sum(${metricSql})` : 'count'

  const colLabel = columnDisplayLabel(resolved.filterColumnMeta)

  // KPI
  const statsData: Record<string, string> = {}
  try {
    const countRes = runCsvQuery(sessionId, { filters, agg: 'count', limit: 1 })
    const cnt = Number(countRes.rows[0]?.count ?? 0)
    statsData['匹配行数'] = formatCount(cnt)
    if (primaryMetric && metricSql) {
      const sumRes = runCsvQuery(sessionId, { filters, agg: `sum(${metricSql})`, limit: 1 })
      const sumVal = Number(sumRes.rows[0]?.[`sum_${metricSql}`] ?? 0)
      statsData[primaryMetric.name || metricSql] = formatMetric(sumVal, metricSql, byteUnit)
      if (cnt > 0) {
        statsData[`平均 ${primaryMetric.name}`] = formatMetric(sumVal / cnt, metricSql, byteUnit)
      }
    }
  } catch {
    statsData['筛选'] = `${colLabel}=${resolved.filterValue}`
  }

  const sections: AutoDashboardSection[] = [
    {
      type: 'filter_bar',
      filter_desc: `${colLabel} = ${resolved.filterValue}`,
      filter_keys: [colLabel],
    },
    { type: 'stats', data: statsData },
  ]

  // 图 1：切片内次维度分布（饼图）
  const chartDim = dims[0]
  if (chartDim) {
    const d = colSql(chartDim)
    try {
      const res = runCsvQuery(sessionId, {
        filters,
        groupby: d,
        agg,
        sort: valueAlias,
        sort_dir: 'desc',
        limit: 12,
      })
      sections.push({
        type: 'chart',
        chart_type: 'pie',
        chart_layout: 'pie_with_legend',
        title: `${chartDim.name} 分布（${resolved.filterValue}）`,
        data: chartDataFromRows(res.rows, d, valueAlias),
        filter_column: d,
        click_filter_map: Object.fromEntries(
          res.rows.map((r) => [
            String(r[d]),
            { [resolved.filterColumn]: resolved.filterValue, [d]: String(r[d]) },
          ])
        ),
      })
    } catch {
      /* ignore */
    }
  }

  // 图 2：度量 TOP（柱图）
  if (chartDim && metricSql) {
    const d = colSql(chartDim)
    try {
      const res = runCsvQuery(sessionId, {
        filters,
        groupby: d,
        agg: `sum(${metricSql})`,
        sort: `sum_${metricSql}`,
        sort_dir: 'desc',
        limit: 10,
      })
      sections.push({
        type: 'chart',
        chart_type: 'horizontal_bar',
        title: `${chartDim.name} TOP10（${primaryMetric!.name}）`,
        data: barDataFromRows(res.rows, d, `sum_${metricSql}`),
        filter_column: d,
      })
    } catch {
      /* ignore */
    }
  }

  // 筛选 + live 明细（切片维默认选中）
  const filterDims = pickFilterSelectDims(pickChartDimensions(columns, rowCount), 8)
  const dimensions: Array<Record<string, unknown>> = []
  for (const d of filterDims) {
    const id = colSql(d)
    const values = resolveDimValues(sessionId, d)
    const dim: Record<string, unknown> = {
      id,
      label: columnDisplayLabel(d),
      type: 'select',
      values,
    }
    if (id === resolved.filterColumn) {
      dim.default_value = resolved.filterValue
    }
    dimensions.push(dim)
  }

  const detailColumns = pickDetailColumns(columns, 18)
  sections.push(
    { type: 'filter_panel', title: '筛选', dimensions },
    {
      type: 'detail_table',
      live: true,
      title: `${resolved.label} 明细`,
      columns: detailColumns.length > 0 ? detailColumns : undefined,
      page_size: 30,
    }
  )

  return {
    viewId: resolved.viewId,
    label: resolved.label,
    sections,
    filterColumn: resolved.filterColumn,
    filterValue: resolved.filterValue,
  }
}
