/**
 * CSV 自动看板构建器
 *
 * 根据 csv_prepare 的 meta + SQLite 实查，一次生成：
 * overview（KPI + 多维图）/ cross（多组交叉）/ detail（多属性筛选 + live 明细）
 * 维度排序以语义名优先，避免只按 unique_count 选出场景旗标类列。
 */

import { getFacetValues, readCsvCacheMeta, runCsvQuery, type CsvColumnMeta } from './csv-shared'

export interface AutoDashboardSection {
  type: string
  [key: string]: unknown
}

export interface AutoDashboardView {
  id: string
  label: string
  sections: AutoDashboardSection[]
}

function colSql(c: CsvColumnMeta): string {
  return c.sql_name || c.name.replace(/[^a-zA-Z0-9_]/g, '_')
}

/** 常见列名中文展示（id/sql_name 不变） */
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

/** 分别对 name / sql_name 做模式匹配（避免拼接串破坏 ^/$ 边界） */
function nameMatches(col: CsvColumnMeta, re: RegExp): boolean {
  const candidates = [col.name, col.sql_name || ''].map((s) => s.toLowerCase())
  return candidates.some((s) => s.length > 0 && re.test(s))
}

function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** 体积展示单位：auto=按大小自适应；其余为固定单位 */
export type ByteUnit = 'auto' | 'B' | 'KB' | 'MB' | 'GB' | 'TB'

const BYTE_UNIT_INDEX: Record<Exclude<ByteUnit, 'auto'>, number> = {
  B: 0,
  KB: 1,
  MB: 2,
  GB: 3,
  TB: 4,
}

/** 将字节数格式化为指定单位（供 KPI / 测试复用） */
export function formatBytes(n: number, unit: ByteUnit = 'auto'): string {
  if (!Number.isFinite(n)) return String(n)
  if (unit === 'auto') {
    const units: Array<Exclude<ByteUnit, 'auto'>> = ['B', 'KB', 'MB', 'GB', 'TB']
    let v = Math.abs(n)
    let i = 0
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024
      i++
    }
    const fixed = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)
    return `${n < 0 ? '-' : ''}${fixed} ${units[i]}`
  }
  const v = n / Math.pow(1024, BYTE_UNIT_INDEX[unit])
  const abs = Math.abs(v)
  const fixed = abs >= 100 ? abs.toFixed(0) : abs >= 10 ? abs.toFixed(1) : abs.toFixed(2)
  return `${v < 0 ? '-' : ''}${fixed} ${unit}`
}

export function parseByteUnit(raw: unknown): ByteUnit | undefined {
  if (typeof raw !== 'string') return undefined
  const u = raw.trim().toUpperCase()
  if (u === 'AUTO') return 'auto'
  if (u === 'B' || u === 'KB' || u === 'MB' || u === 'GB' || u === 'TB') return u
  return undefined
}

function formatMetric(n: number, hint: string, byteUnit: ByteUnit = 'auto'): string {
  const h = hint.toLowerCase()
  if (/byte|size|compress|volume|体积|容量/.test(h) || n > 10_000_000) {
    return formatBytes(n, byteUnit)
  }
  if (Number.isInteger(n) || Math.abs(n) >= 1000) return formatCount(n)
  return n.toFixed(2)
}

export interface AutoBuildOptions {
  /** KPI / 体积类字段展示单位，默认 auto */
  byteUnit?: ByteUnit
}

/**
 * 语义名加分：跨行业通用模式（owner / module / category / geo / status…）
 * 英文用边界；中文直接子串（JS `\b` 对 CJK 无效）
 */
const SEMANTIC_BOOST: Array<[RegExp, number]> = [
  [/(?:^|_)(?:owner|author|assignee)(?:_|$)|作者|负责人|归属/, 100],
  [/(?:^|_)(?:module|mod|folder|dir)(?:_|$)|^mod$|目录|模块/, 95],
  [/(?:^|_)(?:fcat|category|cat|type|format|kind|class)(?:_|$)|类别|类型|格式|分类/, 90],
  [/(?:^|_)(?:geo_tag|geo|tag)(?:_|$)|标签|相似|地区标签/, 85],
  [/(?:^|_)(?:status|state|stage|grade|level)(?:_|$)|状态|等级|阶段/, 80],
  [
    /(?:^|_)(?:region|area|zone|dept|team|group|platform|channel|source|brand)(?:_|$)|地区|部门|团队|渠道|来源|品牌/,
    75,
  ],
]

/** 降权（不排除）：场景旗标 / 二值 / 高基数字段名 */
const SEMANTIC_PENALTY: Array<[RegExp, number]> = [
  [/(?:^|_)(?:scene_count|scenecount)(?:_|$)|场景数|引用数|引用次数/, -70],
  [/(?:^|_)scene(?:_|$)|场景旗标|是否场景/, -45],
  [/^(?:is_|has_|flag_)|_flag$|_bool$|(?:^|_)binary(?:_|$)|是否/, -55],
  [/(?:^|_)(?:uuid|guid|hash|id|key)(?:_|$)/, -40],
  [/(?:^|_)(?:path|filepath|file|url|uri)(?:_|$)|路径|文件名?|地址/, -90],
]

/**
 * 基数甜点：过低（≈二值）或过高都降权，3–30 最利于图表
 */
function cardinalityScore(unique: number): number {
  if (unique <= 1) return -100
  if (unique === 2) return -20
  if (unique <= 12) return 28
  if (unique <= 30) return 18
  if (unique <= 50) return 6
  if (unique <= 80) return -5
  return -30
}

/** 弱维度：交叉分析应尽量避开（仅当没有更好维度时才用） */
export function isWeakChartDimension(col: CsvColumnMeta): boolean {
  const u = col.unique_count ?? 0
  if (u > 0 && u <= 2) return true
  if (nameMatches(col, /(?:^|_)(?:scene_count|scenecount)(?:_|$)|场景数/)) return true
  if (nameMatches(col, /^(?:is_|has_|flag_)|_flag$|_bool$/)) return true
  if (nameMatches(col, /(?:^|_)scene(?:_|$)/) && u <= 5) return true
  return false
}

/**
 * 维度综合打分：语义名 > 基数甜点；弱列大幅降权但不直接剔除
 */
export function scoreDimension(col: CsvColumnMeta, _rowCount = 0): number {
  let score = 0
  for (const [re, pts] of SEMANTIC_BOOST) {
    if (nameMatches(col, re)) score += pts
  }
  for (const [re, pts] of SEMANTIC_PENALTY) {
    if (nameMatches(col, re)) score += pts
  }
  score += cardinalityScore(col.unique_count ?? 0)
  if (isWeakChartDimension(col)) score -= 35
  // 同语义下略偏好更低基数（图例更清晰）
  score -= Math.min(20, (col.unique_count ?? 50) * 0.15)
  return score
}

/** 选适合做图表的维度：排除超高基数；排序按语义分而非纯 unique_count */
export function pickChartDimensions(columns: CsvColumnMeta[], rowCount: number): CsvColumnMeta[] {
  return columns
    .filter((c) => c.role === 'dimension')
    .filter((c) => {
      const u = c.unique_count ?? 0
      if (u <= 1) return false
      if (rowCount > 0 && u > Math.min(80, Math.max(20, rowCount * 0.3))) return false
      if (u > 80) return false
      return true
    })
    .sort((a, b) => {
      const ds = scoreDimension(b, rowCount) - scoreDimension(a, rowCount)
      if (ds !== 0) return ds
      return (a.unique_count ?? 99) - (b.unique_count ?? 99)
    })
}

/**
 * 交叉维对：≥3 强维度时取 2 对；跳过「仅弱旗标」组合
 * 例：fcat×module、owner×fcat
 */
export function pickCrossPairs(dims: CsvColumnMeta[]): Array<[CsvColumnMeta, CsvColumnMeta]> {
  const strong = dims.filter((d) => !isWeakChartDimension(d))
  const pool = strong.length >= 2 ? strong : dims
  if (pool.length < 2) return []

  const pairs: Array<[CsvColumnMeta, CsvColumnMeta]> = [[pool[0]!, pool[1]!]]
  if (pool.length >= 3) {
    // 第二对：优先 dim0×dim2（共享主维），否则 dim1×dim2
    pairs.push([pool[0]!, pool[2]!])
  }
  return pairs.slice(0, 2)
}

/** 选度量列：优先体积/金额类命名 */
export function pickMetrics(columns: CsvColumnMeta[]): CsvColumnMeta[] {
  const metrics = columns.filter((c) => c.role === 'metric')
  const scored = metrics.map((c) => {
    let score = 0
    if (nameMatches(c, /compress|byte|size|volume|amount|price|cost|value|时长|体积|金额|销量/)) {
      score += 10
    }
    if (nameMatches(c, /count|qty|数量|次数/)) score += 5
    // scene_count 可作 KPI，但不抢 compress 主度量
    if (nameMatches(c, /(?:^|_)(?:scene_count|scenecount)(?:_|$)/)) score -= 2
    return { c, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.c)
}

function pickSearchColumn(columns: CsvColumnMeta[]): CsvColumnMeta | undefined {
  const dims = columns.filter((c) => c.role === 'dimension')
  const byName = dims.find((c) => nameMatches(c, /path|file|name|url|标题|路径|名称|文件/))
  if (byName) return byName
  return [...dims].sort((a, b) => (b.unique_count ?? 0) - (a.unique_count ?? 0))[0]
}

/** 明细列优先序：path / 语义维 / 体积度量 / 计数，再补其余；上限 ~18 */
export function pickDetailColumns(columns: CsvColumnMeta[], maxCols = 18): string[] {
  const priority = (c: CsvColumnMeta): number => {
    if (nameMatches(c, /(?:^|_)(?:path|filepath)(?:_|$)|路径/)) return 1000
    if (nameMatches(c, /(?:^|_)owner(?:_|$)|作者|负责人/)) return 920
    if (nameMatches(c, /(?:^|_)(?:module|mod)(?:_|$)|模块|目录/)) return 900
    if (nameMatches(c, /(?:^|_)(?:fcat|category|type|format)(?:_|$)|类别|类型|格式/)) return 880
    if (nameMatches(c, /(?:^|_)(?:geo_tag|geo)(?:_|$)/)) return 860
    if (nameMatches(c, /(?:^|_)status(?:_|$)|状态/)) return 840
    if (nameMatches(c, /(?:^|_)(?:compress|byte|size)(?:_|$)|体积/)) return 820
    if (nameMatches(c, /(?:^|_)(?:tex_pixels|vertex|face)|像素|顶点|面数/)) return 800
    if (nameMatches(c, /(?:^|_)(?:count|qty)(?:_|$)|数量|次数/)) return 780
    if (nameMatches(c, /(?:^|_)(?:scene_count|scenecount)(?:_|$)/)) return 700
    if (c.role === 'dimension') return 500 + scoreDimension(c)
    if (c.role === 'metric') return 400
    return 100
  }

  return [...columns]
    .filter((c) => {
      const n = colSql(c)
      return n && n !== 'id'
    })
    .sort((a, b) => priority(b) - priority(a))
    .map((c) => colSql(c))
    .slice(0, maxCols)
}

/** 明细筛选：最多 6–8 个 select 维（语义序），弱维排后 */
export function pickFilterSelectDims(dims: CsvColumnMeta[], max = 8): CsvColumnMeta[] {
  const strong = dims.filter((d) => !isWeakChartDimension(d))
  const weak = dims.filter((d) => isWeakChartDimension(d))
  return [...strong, ...weak].slice(0, Math.min(Math.max(6, max), 8))
}

function resolveDimValues(sessionId: string, col: CsvColumnMeta): Array<string | number> {
  if (col.values && col.values.length > 0) return col.values
  if (col.top_values) return Object.keys(col.top_values)
  try {
    return getFacetValues(sessionId, colSql(col), 40).values
  } catch {
    return []
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
 * 把交叉行转成堆叠柱数据：
 * X = dimA 的 TOP N，系列 = dimB 的 TOP M
 */
export function buildStackedPivot(
  rows: Record<string, unknown>[],
  dimA: string,
  dimB: string,
  valueKey: string,
  maxX = 8,
  maxSeries = 6
): { labels: string[]; datasets: Array<{ label: string; data: number[] }> } {
  const pairSum = new Map<string, number>()
  const aTotals = new Map<string, number>()
  const bTotals = new Map<string, number>()

  for (const r of rows) {
    const a = String(r[dimA] ?? '(空)')
    const b = String(r[dimB] ?? '(空)')
    const v = Number(r[valueKey] ?? 0) || 0
    pairSum.set(`${a}\0${b}`, (pairSum.get(`${a}\0${b}`) || 0) + v)
    aTotals.set(a, (aTotals.get(a) || 0) + v)
    bTotals.set(b, (bTotals.get(b) || 0) + v)
  }

  const labels = [...aTotals.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, maxX)
    .map(([k]) => k)
  const seriesKeys = [...bTotals.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, maxSeries)
    .map(([k]) => k)

  const datasets = seriesKeys.map((b) => ({
    label: b,
    data: labels.map((a) => pairSum.get(`${a}\0${b}`) || 0),
  }))

  return { labels, datasets }
}

function pushDimChart(
  sections: AutoDashboardSection[],
  sessionId: string,
  dim: CsvColumnMeta,
  opts: {
    chart_type: 'pie' | 'bar' | 'horizontal_bar'
    valueMode: 'count' | 'metric'
    metricSql?: string
    valueAlias?: string
    limit?: number
    titleSuffix?: string
  }
): void {
  const d = colSql(dim)
  const useMetric = opts.valueMode === 'metric' && opts.metricSql && opts.valueAlias
  const agg = useMetric ? `count,sum(${opts.metricSql})` : 'count'
  const valueCol = useMetric ? opts.valueAlias! : 'count'
  const limit = opts.limit ?? 10
  try {
    const res = runCsvQuery(sessionId, {
      groupby: d,
      agg,
      sort: valueCol,
      sort_dir: 'desc',
      limit,
    })
    const titleBase =
      opts.valueMode === 'metric'
        ? `${dim.name} TOP${limit}（度量）`
        : opts.chart_type === 'pie'
          ? `${dim.name} 分布`
          : `${dim.name} TOP${limit}（行数）`
    const section: AutoDashboardSection = {
      type: 'chart',
      chart_type: opts.chart_type,
      title: opts.titleSuffix ? `${titleBase}${opts.titleSuffix}` : titleBase,
      data:
        opts.chart_type === 'pie'
          ? chartDataFromRows(res.rows, d, valueCol)
          : barDataFromRows(res.rows, d, valueCol),
      filter_column: d,
      click_filter_map: Object.fromEntries(
        res.rows.map((r) => [String(r[d]), { [d]: String(r[d]) }])
      ),
    }
    if (opts.chart_type === 'pie') {
      section.chart_layout = 'pie_with_legend'
    }
    sections.push(section)
  } catch {
    /* ignore */
  }
}

function appendCrossPairSections(
  sections: AutoDashboardSection[],
  sessionId: string,
  dimA: CsvColumnMeta,
  dimB: CsvColumnMeta,
  metricSql: string | undefined,
  valueAlias: string,
  agg: string,
  pairIndex: number
): void {
  const d0 = colSql(dimA)
  const d1 = colSql(dimB)
  try {
    const res = runCsvQuery(sessionId, {
      groupby: `${d0},${d1}`,
      agg,
      sort: valueAlias,
      sort_dir: 'desc',
      limit: 40,
    })
    const cols = metricSql ? [d0, d1, 'count', `sum_${metricSql}`] : [d0, d1, 'count']
    const pairLabel = `${dimA.name} × ${dimB.name}`
    if (pairIndex === 0) {
      sections.push({
        type: 'opportunity_intro',
        title: '交叉说明',
        data: [
          `按语义优先维度交叉聚合（如类别×模块、归属×类别），下列为 TOP 组合。`,
          '在「资源明细」页可用多属性筛选查看原始行。',
        ],
      })
    } else {
      sections.push({
        type: 'opportunity_intro',
        title: `交叉组 ${pairIndex + 1}`,
        data: [`第二组交叉：${pairLabel}`],
      })
    }
    const pivot = buildStackedPivot(res.rows, d0, d1, valueAlias, 8, 6)
    sections.push({
      type: 'heatmap',
      title: `${pairLabel} 热力图`,
      row_key: d0,
      col_key: d1,
      value_key: valueAlias,
      row_label: dimA.name,
      col_label: dimB.name,
      rows: res.rows,
    })
    sections.push({
      type: 'chart',
      chart_type: 'stacked_bar',
      title: `${pairLabel} 堆叠`,
      data: pivot,
      filter_column: d0,
      click_filter_map: Object.fromEntries(pivot.labels.map((l) => [l, { [d0]: l }])),
    })
    sections.push({
      type: 'table',
      title: pairLabel,
      columns: cols,
      rows: res.rows,
      sortable: true,
      paginated: true,
      page_size: 20,
    })
    if (pairIndex === 0) {
      sections.push({
        type: 'chart',
        chart_type: 'horizontal_bar',
        title: `${pairLabel} 组合 TOP12`,
        data: res.rows.slice(0, 12).map((r) => ({
          name: `${r[d0]} / ${r[d1]}`,
          value: Number(r[valueAlias] ?? r.count ?? 0) || 0,
        })),
      })
    }
  } catch (e) {
    sections.push({
      type: 'opportunity_intro',
      title: '交叉分析',
      data: [
        `交叉查询失败 (${dimA.name}×${dimB.name}): ${e instanceof Error ? e.message : String(e)}`,
      ],
    })
  }
}

/**
 * 基于已加载 session 自动构建三视图看板配置
 */
export function buildAutoDashboardViews(
  sessionId: string,
  options: AutoBuildOptions = {}
): AutoDashboardView[] {
  const byteUnit = options.byteUnit ?? 'auto'
  const meta = readCsvCacheMeta(sessionId)
  if (!meta) {
    throw new Error('数据未加载。请先调用 csv_prepare。')
  }

  const columns = meta.columns || []
  const rowCount = meta.row_count || 0
  const dims = pickChartDimensions(columns, rowCount)
  const metrics = pickMetrics(columns)
  const primaryMetric = metrics[0]
  const metricSql = primaryMetric ? colSql(primaryMetric) : undefined
  const agg = metricSql ? `count,sum(${metricSql})` : 'count'
  const valueAlias = metricSql ? `sum_${metricSql}` : 'count'
  const searchCol = pickSearchColumn(columns)

  // —— KPI：尽量凑满 6–8 个（行数 + 度量合计 + 多维类别数 + 次要度量）——
  const statsData: Record<string, string> = {
    总行数: formatCount(rowCount),
  }
  if (dims.length > 0) statsData['分析维度'] = `${dims.length} 个`

  if (primaryMetric && metricSql) {
    try {
      const sumRes = runCsvQuery(sessionId, { agg: `sum(${metricSql})`, limit: 1 })
      const sumVal = Number(sumRes.rows[0]?.[`sum_${metricSql}`] ?? 0)
      statsData[primaryMetric.name || metricSql] = formatMetric(sumVal, metricSql, byteUnit)
      if (rowCount > 0) {
        statsData[`平均 ${primaryMetric.name}`] = formatMetric(
          sumVal / rowCount,
          metricSql,
          byteUnit
        )
      }
    } catch {
      /* ignore */
    }
  }

  // 次要度量合计（最多 2 个，跳过已展示的主度量）
  for (const m of metrics.slice(1, 3)) {
    const mSql = colSql(m)
    try {
      const sumRes = runCsvQuery(sessionId, { agg: `sum(${mSql})`, limit: 1 })
      const sumVal = Number(sumRes.rows[0]?.[`sum_${mSql}`] ?? 0)
      statsData[m.name || mSql] = formatMetric(sumVal, mSql, byteUnit)
    } catch {
      /* ignore */
    }
  }

  // 各主维度类别数（最多 4 个）
  for (const d of dims.slice(0, 4)) {
    statsData[`${d.name} 类别数`] = formatCount(d.unique_count ?? 0)
  }

  // 截断到约 8 个 KPI，避免刷屏
  const statsKeys = Object.keys(statsData)
  if (statsKeys.length > 8) {
    const keep = new Set(statsKeys.slice(0, 8))
    for (const k of statsKeys) {
      if (!keep.has(k)) delete statsData[k]
    }
  }

  const overviewSections: AutoDashboardSection[] = [{ type: 'stats', data: statsData }]

  // —— 图表：≥4 维时 4–6 张；类别图用 count，价值图用度量 ——
  const chartSpecs: Array<{
    dim: CsvColumnMeta
    chart_type: 'pie' | 'bar' | 'horizontal_bar'
    valueMode: 'count' | 'metric'
    limit?: number
  }> = []

  if (dims[0]) {
    chartSpecs.push({ dim: dims[0], chart_type: 'pie', valueMode: 'count', limit: 12 })
  }
  if (dims[1]) {
    chartSpecs.push({
      dim: dims[1],
      chart_type: 'horizontal_bar',
      valueMode: metricSql ? 'metric' : 'count',
      limit: 10,
    })
  }
  if (dims[2]) {
    chartSpecs.push({ dim: dims[2], chart_type: 'bar', valueMode: 'count', limit: 10 })
  }
  if (dims[3]) {
    chartSpecs.push({ dim: dims[3], chart_type: 'pie', valueMode: 'count', limit: 10 })
  }
  // 主维价值图 + 次维行数图（丰富总览）
  if (dims[0] && metricSql) {
    chartSpecs.push({
      dim: dims[0],
      chart_type: 'horizontal_bar',
      valueMode: 'metric',
      limit: 10,
    })
  }
  if (dims.length >= 4 && dims[1]) {
    chartSpecs.push({ dim: dims[1], chart_type: 'bar', valueMode: 'count', limit: 10 })
  } else if (dims[4]) {
    chartSpecs.push({
      dim: dims[4],
      chart_type: 'bar',
      valueMode: metricSql ? 'metric' : 'count',
      limit: 10,
    })
  }

  const maxCharts = dims.length >= 4 ? 6 : dims.length >= 2 ? 4 : Math.max(dims.length, 1)
  for (const spec of chartSpecs.slice(0, maxCharts)) {
    pushDimChart(overviewSections, sessionId, spec.dim, {
      chart_type: spec.chart_type,
      valueMode: spec.valueMode,
      metricSql,
      valueAlias,
      limit: spec.limit,
    })
  }

  // —— 交叉：≥3 维时尽量 2 组 ——
  const crossSections: AutoDashboardSection[] = []
  const pairs = pickCrossPairs(dims)
  if (pairs.length > 0) {
    pairs.forEach(([a, b], i) => {
      appendCrossPairSections(crossSections, sessionId, a, b, metricSql, valueAlias, agg, i)
    })
  } else if (dims.length === 1) {
    crossSections.push({
      type: 'opportunity_intro',
      title: '交叉分析',
      data: ['可图表化维度不足 2 个，本页展示该维度聚合。'],
    })
    const d0 = colSql(dims[0]!)
    try {
      const res = runCsvQuery(sessionId, {
        groupby: d0,
        agg,
        sort: valueAlias,
        sort_dir: 'desc',
        limit: 30,
      })
      crossSections.push({
        type: 'table',
        title: dims[0]!.name,
        columns: metricSql ? [d0, 'count', `sum_${metricSql}`] : [d0, 'count'],
        rows: res.rows,
        sortable: true,
      })
    } catch {
      /* ignore */
    }
  } else {
    crossSections.push({
      type: 'opportunity_intro',
      title: '交叉分析',
      data: ['未识别到合适的分类维度。请检查 CSV 是否包含类别列。'],
    })
  }

  // —— 明细筛选：6–8 select + path 文本搜索 + 度量下限 ——
  const filterDims = pickFilterSelectDims(dims, 8)
  const dimensions: Array<Record<string, unknown>> = []
  for (const d of filterDims) {
    // 高基数搜索列不进 select，后面单独加 text
    if (searchCol && colSql(d) === colSql(searchCol) && (searchCol.unique_count ?? 0) > 40) {
      continue
    }
    dimensions.push({
      id: colSql(d),
      label: columnDisplayLabel(d),
      type: 'select',
      values: resolveDimValues(sessionId, d),
    })
  }
  if (searchCol) {
    const searchId = colSql(searchCol)
    if (!dimensions.some((d) => d.id === searchId && d.type === 'text')) {
      dimensions.push({
        id: searchId,
        label: columnDisplayLabel(searchCol),
        type: 'text',
        placeholder: `搜索 ${columnDisplayLabel(searchCol)}…`,
      })
    }
  }

  if (primaryMetric && metricSql) {
    const presets = /compress|byte|size|体积/.test(metricSql.toLowerCase())
      ? [1024 * 1024, 10 * 1024 * 1024, 50 * 1024 * 1024]
      : [1, 10, 100]
    dimensions.push({
      id: metricSql,
      label: `最小 ${columnDisplayLabel(primaryMetric)}`,
      type: 'number_min',
      presets,
    })
  }

  const detailColumns = pickDetailColumns(columns, 18)

  const detailSections: AutoDashboardSection[] = [
    { type: 'filter_panel', title: '多属性筛选', dimensions },
    {
      type: 'detail_table',
      live: true,
      title: '全量明细',
      columns: detailColumns.length > 0 ? detailColumns : undefined,
      page_size: 30,
    },
  ]

  return [
    { id: 'overview', label: '总览', sections: overviewSections },
    { id: 'cross', label: '交叉分析', sections: crossSections },
    { id: 'detail', label: '资源明细', sections: detailSections },
  ]
}
