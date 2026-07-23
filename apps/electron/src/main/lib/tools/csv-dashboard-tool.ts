/**
 * CSV 数据看板工具
 *
 * 接收看板配置，生成自包含 HTML 文件。
 * 支持总览看板、聚焦视图追加、图表+表格。
 */

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { buildAutoDashboardViews, parseByteUnit, type ByteUnit } from './csv-auto-builder'
import { buildSliceViewSections, resolveSliceTarget } from './csv-slice-builder'
import { clearLiveTabs, listLiveTabs, removeLiveTab, upsertLiveTab } from './csv-live-tabs'
import { CSV_ARTIFACT_OPS_HINT, recordCsvArtifact } from '../csv-artifact-service'

/** 看板 tab 软上限：避免 HTML/DOM/Chart 实例无限膨胀 */
export const MAX_DASHBOARD_VIEWS = 10

/** csv_dashboard 执行上下文（由 orchestrator 注入 Agent 会话 ID） */
export interface CsvDashboardExecuteContext {
  agentSessionId?: string
}

// ===== 缓存路径 =====

/** 获取缓存根目录 ~/.tagent-dev/ 或 ~/.tagent/csv-cache/ */
function getCsvCacheRoot(): string {
  const isDev = process.env.TAGENT_DEV === '1'
  const dirName = isDev ? '.tagent-dev' : '.tagent'
  const dir = path.join(os.homedir(), dirName, 'csv-cache')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ===== 工具元数据 =====

export const CSV_DASHBOARD_TOOL_META: ChatToolMeta = {
  id: 'csv-dashboard',
  name: 'CSV 数据看板',
  description: '生成交互式 HTML 数据看板（多视图 + 交叉分析 + 可筛选明细）',
  params: [
    { name: 'session_id', type: 'string', description: '会话 ID', required: true },
    {
      name: 'action',
      type: 'string',
      description: '操作: create / slice / live_tab / add_view / replace_view / patch',
      required: true,
    },
    { name: 'title', type: 'string', description: '看板标题' },
    { name: 'view_id', type: 'string', description: '视图 ID（add_view/replace_view 时使用）' },
    { name: 'view_label', type: 'string', description: '视图显示名' },
    { name: 'sections_json', type: 'string', description: '单视图 sections 配置 JSON 数组' },
    {
      name: 'views_json',
      type: 'string',
      description: '多视图 JSON：[{"id","label","sections":[...]}]，create 时优先于 sections_json',
    },
    {
      name: 'byte_unit',
      type: 'string',
      description: '体积展示单位 auto|B|KB|MB|GB|TB（改单位请用 action=patch）',
    },
    {
      name: 'preset',
      type: 'string',
      description: 'auto（推荐，一键多维）| standard | full',
    },
    { name: 'overview_json', type: 'string', description: 'preset 用：总览 sections JSON' },
    { name: 'cross_json', type: 'string', description: 'preset 用：交叉分析 sections JSON' },
    { name: 'detail_json', type: 'string', description: 'preset 用：明细+筛选 sections JSON' },
    { name: 'maps_json', type: 'string', description: 'preset=full 可选视图' },
    { name: 'reuse_json', type: 'string', description: 'preset=full 可选视图' },
    { name: 'opportunity_json', type: 'string', description: 'preset=full 可选视图' },
    {
      name: 'live',
      type: 'string',
      description: 'true 时启动本地查询服务，明细走 /api/rows（推荐百万行）',
    },
    {
      name: 'filter_column',
      type: 'string',
      description: 'slice：过滤列 sql_name，可省略由服务端猜测',
    },
    { name: 'filter_value', type: 'string', description: 'slice：过滤值（如 贴图、植被）' },
    {
      name: 'slice_query',
      type: 'string',
      description: 'slice：自然语言/query，服务端在维度列中匹配',
    },
    { name: 'label', type: 'string', description: 'slice/live_tab：tab 显示名，默认同 filter 值' },
    { name: 'tab_id', type: 'string', description: 'live_tab：Tab ID，默认同 slice viewId' },
    { name: 'tab_label', type: 'string', description: 'live_tab：Tab 显示名' },
    {
      name: 'live_tab_action',
      type: 'string',
      description: 'live_tab 子动作：upsert（默认）| remove | clear_all',
    },
    {
      name: 'persist',
      type: 'string',
      description: 'slice：true 时固化落盘 add_view（默认 false，走内存 live_tab）',
    },
  ],
  icon: 'LayoutDashboard',
  category: 'builtin',
  executorType: 'builtin',
  systemPromptAppend: `
<csv_dashboard_instructions>
你拥有 CSV 数据看板生成能力。

**产品分流（必须遵守）：**
| 用户意图 | 路径 |
|----------|------|
| 改单位/标题/刷新展示 | \`csv_dashboard(action="patch", byte_unit=...)\` |
| 对落盘底盘不满意（总览/交叉/默认明细结构） | \`replace_view\` / 必要时合法 \`create\` |
| 「我想看贴图」「专注植被」「单独看某某」 | **内存 AI Tab**：\`csv_dashboard(action="live_tab")\` 或 \`action="slice"\`（默认内存，不落盘） |
| 不确定用户要改底盘还是临时专注页 | **先用文字问用户**，禁止瞎猜 |

**推荐默认流程（多维看板）：**
1. csv_prepare → 拿到 columns（含 sql_name）
2. **优先** \`csv_dashboard(action="create", preset="auto", live="true", title="...")\`
3. 用户要定制分析结构时，再用 csv_query + replace_view / views_json

**展示微调（极重要 — 禁止重跑分析）：**
用户只改单位 / 标题 / 刷新展示时，**只允许**：
\`csv_dashboard(action="patch", session_id="...", byte_unit="MB")\`
可选再传 title。
- ✅ patch：基于已有 SQLite 快速重生成展示（秒级）
- ❌ 禁止为此再 csv_prepare
- ❌ 禁止 Read/Grep/Edit dashboard.html
- ❌ 禁止为「改成 MB」再 create + preset=auto 当第一次做

**内存 AI Tab（贴图/植被等专注页 — 极重要）：**
- 用户说「我想看贴图」「专注植被」「单独看某某」→ \`csv_dashboard(action="live_tab", filter_value="贴图")\` 或 \`action="slice"\`（等价，默认内存）
- 可选 \`label="贴图"\`、\`filter_column="fcat"\`；同 tab_id/label 则 upsert 替换
- 子动作：\`live_tab_action="remove"\` 删单个；\`"clear_all"\` 清空全部 AI Tab
- **禁止**用 add_view 做贴图页（除非用户明确「固化到看板里」→ \`slice(persist="true")\`）
- AI Tab 刷新预览或退出 TAgent 后消失；改单位请用 patch

**手工拼看板时的丰富度要求：**
- 维度优先：owner / module / fcat|category|type / geo_tag / status 等语义列
- 总览：多 KPI + 类别图用 count、价值图用 compress/size
- 交叉：至少一组语义维对；有第三维再加第二组
- 明细：dimensions 筛选 + detail_table(live:true)

**禁止：**只生成单页 4 张一维图就声称分析完成；必须至少含交叉分析 + 可筛选明细页。
</csv_dashboard_instructions>`,
}

// ===== 工具定义 =====

export const CSV_DASHBOARD_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'csv_dashboard',
    description:
      'Generate multi-view interactive HTML dashboard with cross-dim charts and live filterable detail table.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID' },
        action: {
          type: 'string',
          description: 'Action: create | slice | live_tab | add_view | replace_view | patch',
        },
        filter_column: {
          type: 'string',
          description: 'slice: filter column sql_name (optional, server guesses)',
        },
        filter_value: { type: 'string', description: 'slice: filter value e.g. 贴图 / 植被' },
        slice_query: {
          type: 'string',
          description: 'slice: natural language query, server finds best dimension match',
        },
        label: {
          type: 'string',
          description: 'slice/live_tab: tab label, defaults to matched filter value',
        },
        tab_id: { type: 'string', description: 'live_tab: tab ID' },
        tab_label: { type: 'string', description: 'live_tab: tab display name' },
        live_tab_action: {
          type: 'string',
          description: 'live_tab sub-action: upsert | remove | clear_all',
        },
        persist: {
          type: 'string',
          description: 'slice: true to persist to disk (default false = memory live_tab)',
        },
        title: { type: 'string', description: 'Dashboard title' },
        view_id: { type: 'string', description: 'View ID for add_view/replace_view' },
        view_label: { type: 'string', description: 'View display name' },
        sections_json: { type: 'string', description: 'JSON array of sections for single view' },
        views_json: {
          type: 'string',
          description: 'JSON array of {id,label,sections} for multi-view create',
        },
        byte_unit: {
          type: 'string',
          description: 'Byte display unit for size fields: auto | B | KB | MB | GB | TB',
        },
        preset: { type: 'string', description: 'standard | full | auto' },
        overview_json: { type: 'string', description: 'Overview sections JSON' },
        cross_json: { type: 'string', description: 'Cross-analysis sections JSON' },
        detail_json: { type: 'string', description: 'Detail+filter sections JSON' },
        maps_json: { type: 'string', description: 'Optional maps view sections' },
        reuse_json: { type: 'string', description: 'Optional reuse view sections' },
        opportunity_json: { type: 'string', description: 'Optional opportunity view sections' },
        live: { type: 'string', description: 'true to enable local query server for detail table' },
        allow_simple: {
          type: 'string',
          description: 'true 时允许单页简图（默认会把缺明细的看板升级为 auto）',
        },
      },
      required: ['session_id', 'action'],
    },
  },
]

// ===== 工具名称匹配 =====

const CSV_DASHBOARD_TOOL_NAMES = new Set(['csv_dashboard'])

export function isCsvDashboardToolCall(toolName: string): boolean {
  return CSV_DASHBOARD_TOOL_NAMES.has(toolName)
}

// ===== 缓存路径 =====

function getCacheDir(sessionId: string): string {
  // 改到 ~/.tagent-dev/csv-cache/{sessionId}-dashboard/ 替代 os.tmpdir
  const base = path.join(getCsvCacheRoot(), `${sessionId}-dashboard`)
  fs.mkdirSync(base, { recursive: true })
  return base
}

function getDashboardPath(sessionId: string): string {
  return path.join(getCacheDir(sessionId), 'dashboard.html')
}

function getMetaPath(sessionId: string): string {
  return path.join(getCacheDir(sessionId), 'meta.json')
}

// ===== Section 类型定义 =====

interface DashboardSection {
  type: 'stats' | 'chart' | 'table'
  chart_type?: 'pie' | 'bar' | 'horizontal_bar' | 'stacked_bar'
  title?: string
  data?: Record<string, unknown> | Array<Record<string, unknown>>
  columns?: string[]
  rows?: Array<Record<string, unknown>>
  sortable?: boolean
  paginated?: boolean
  page_size?: number
}

/**
 * 自动推断和修正 section 格式
 * 处理 agent 常见的字段名错误
 */
function normalizeSection(raw: Record<string, unknown>): DashboardSectionV2 {
  const r = raw as Record<string, any>

  // 自动推断 type
  let type = r.type as string
  if (!type) {
    if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
      type = 'stats'
    } else if (r.data && Array.isArray(r.data)) {
      type = 'chart'
    } else if (r.columns || r.rows) {
      type = 'table'
    } else {
      type = 'stats'
    }
  }

  // 自动推断 chart_type
  let chartType = r.chart_type as string | undefined
  if (type === 'chart' && !chartType) {
    if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
      chartType = 'pie'
    } else {
      chartType = 'bar'
    }
  }

  // 兼容常见字段名错误
  let data = r.data
  if (!data) {
    data = r.items || r.values || r.series || r.dataPoints || {}
  }

  // 兼容 chart 字段名
  if (type === 'chart' && !chartType) {
    chartType = r.chartType || r.chart || r.kind || r.type_name || 'pie'
  }

  return {
    type:
      type === 'stats' ||
      type === 'chart' ||
      type === 'table' ||
      type === 'filter_bar' ||
      type === 'opportunity_intro' ||
      type === 'filter_panel' ||
      type === 'detail_table' ||
      type === 'heatmap'
        ? type
        : 'stats',
    chart_type:
      chartType === 'pie' ||
      chartType === 'bar' ||
      chartType === 'horizontal_bar' ||
      chartType === 'stacked_bar' ||
      chartType === 'doughnut'
        ? chartType
        : (chartType as DashboardSectionV2['chart_type']),
    title: r.title as string | undefined,
    data,
    columns: r.columns as string[] | undefined,
    rows: r.rows as Array<Record<string, unknown>> | undefined,
    sortable: r.sortable as boolean | undefined,
    paginated: r.paginated as boolean | undefined,
    page_size: r.page_size as number | undefined,
    // 新字段透传
    label: r.label as string | undefined,
    value: r.value as string | number | undefined,
    sub: r.sub as string | undefined,
    value_color: r.value_color as DashboardSectionV2['value_color'],
    tip: r.tip as string | undefined,
    chart_layout: r.chart_layout as DashboardSectionV2['chart_layout'],
    filter_desc: r.filter_desc as string | undefined,
    filter_keys: r.filter_keys as string[] | undefined,
    column_tips: r.column_tips as Record<string, string> | undefined,
    // v2 字段透传
    click_filter: r.click_filter as Record<string, string | number> | undefined,
    click_filter_map: r.click_filter_map as
      | Record<string, Record<string, string | number>>
      | undefined,
    filters: r.filters as DashboardSectionV2['filters'],
    dimensions: r.dimensions as DashboardSectionV2['dimensions'],
    path_search_placeholder: r.path_search_placeholder as string | undefined,
    filter_panel_id: r.filter_panel_id as string | undefined,
    live: r.live as boolean | undefined,
    filter_column: r.filter_column as string | undefined,
    row_key: r.row_key as string | undefined,
    col_key: r.col_key as string | undefined,
    value_key: r.value_key as string | undefined,
    row_label: r.row_label as string | undefined,
    col_label: r.col_label as string | undefined,
    raw_value: r.raw_value as number | undefined,
  }
}

// ===== HTML 生成 =====
// 视觉语言对齐参考项目 F:\StatsCheckBorad 的 AssetDashboard：
//   - 左侧 260px 边栏（brand + view-nav + filter-summary）
//   - 主区 topbar + tabs + filter-bar + metrics-grid + charts-grid + data-table
//   - indigo 主题色 + KPI hover 抬升 + chart-card 阴影 + tip modal 解释专业概念
//   - 表头 tip 图标 hover/click 弹层

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatNumberHumanReadable(n: number): string {
  if (!isFinite(n)) return String(n)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)} 万`
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatBytesHumanReadable(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const fixed = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)
  return `${fixed} ${units[i]}`
}

/** DashboardSection：兼容旧 sections 字段名，并对齐 StatsCheckBorad 视觉 */
interface DashboardSectionV2 {
  type:
    | 'stats'
    | 'chart'
    | 'table'
    | 'filter_bar'
    | 'opportunity_intro'
    | 'filter_panel'
    | 'detail_table'
    | 'heatmap'
  // 旧字段保留
  chart_type?: 'pie' | 'bar' | 'horizontal_bar' | 'stacked_bar' | 'doughnut'
  title?: string
  data?: Record<string, unknown> | Array<Record<string, unknown>>
  columns?: string[]
  rows?: Array<Record<string, unknown>>
  sortable?: boolean
  paginated?: boolean
  page_size?: number
  // 新字段
  label?: string
  value?: string | number
  sub?: string
  value_color?: 'primary' | 'success' | 'warning' | 'danger'
  tip?: string
  chart_layout?: 'single' | 'pie_with_legend'
  filter_desc?: string
  filter_keys?: string[]
  column_tips?: Record<string, string>
  // v2: 点击 KPI/chart 后跳 detail 应用过滤
  click_filter?: Record<string, string | number>
  click_filter_map?: Record<string, Record<string, string | number>>
  // v2: filter_panel（通用维度 + 旧游戏字段兼容）
  filters?: {
    owner?: string[]
    fcat?: string[]
    module?: string[]
    ext?: string[]
    min_bytes?: number[]
    reuse_status?: Array<'unlinked' | 'single' | 'low' | 'reused' | 'high'>
  }
  /** 通用筛选项：跨行业 CSV 优先用这个 */
  dimensions?: Array<{
    id: string
    label: string
    values?: Array<string | number>
    type?: 'select' | 'number_min' | 'text'
    presets?: Array<string | number>
    placeholder?: string
    /** 打开页面时默认选中的值（slice 页预填筛选） */
    default_value?: string | number
  }>
  path_search_placeholder?: string
  // v2: detail_table
  filter_panel_id?: string
  /** live=true 时不嵌全量行，走 /api/rows 分页 */
  live?: boolean
  /** 图表点击钻取的默认列名（无 click_filter_map 时按 label 生成） */
  filter_column?: string
  // heatmap
  row_key?: string
  col_key?: string
  value_key?: string
  row_label?: string
  col_label?: string
  // v2: KPI 卡片值原始字节数（用于排序/格式化）
  raw_value?: number
}

/** 主题色数组（Chart.js 数据集 + 自定义配色） */
const CHART_PALETTE = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#3b82f6',
  '#14b8a6',
  '#f97316',
  '#ec4899',
  '#84cc16',
  '#0ea5e9',
  '#a855f7',
  '#06b6d4',
  '#22c55e',
  '#eab308',
]

/** 读取本地 Chart.js（内联进 HTML，避免 CDN/离线失败） */
function loadChartJsSource(): string {
  const candidates = [
    path.join(__dirname, 'resources', 'vendor', 'chart.umd.min.js'),
    path.join(__dirname, '..', 'resources', 'vendor', 'chart.umd.min.js'),
    typeof process.resourcesPath === 'string'
      ? path.join(process.resourcesPath, 'vendor', 'chart.umd.min.js')
      : '',
    path.join(process.cwd(), 'resources', 'vendor', 'chart.umd.min.js'),
    path.join(process.cwd(), 'apps', 'electron', 'resources', 'vendor', 'chart.umd.min.js'),
  ].filter(Boolean)

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf-8')
      }
    } catch {
      /* continue */
    }
  }
  console.warn('[CSV Dashboard] 未找到本地 Chart.js，回退 CDN')
  return ''
}

function buildChartJsTag(): string {
  const src = loadChartJsSource()
  if (src) {
    return `<script>${src}<\/script>`
  }
  return `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>`
}

/** 基础 CSS：主题变量 + 全局样式 + sidebar + main + topbar + nav-tabs + filter-bar + metrics + charts + table + tip-modal */
function buildBaseCss(): string {
  return `
:root {
  --bg: #f8fafc; --surface: #ffffff; --border: #e2e8f0;
  --text: #1e293b; --text-muted: #64748b;
  --primary: #6366f1; --primary-hover: #4f46e5;
  --success: #10b981; --warning: #f59e0b; --danger: #ef4444;
  --sidebar-w: 240px;
  --radius: 12px; --radius-sm: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.08);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg); color: var(--text);
  min-height: 100vh; line-height: 1.6; font-size: 13px;
}
.mono { font-family: 'SF Mono', 'Fira Code', monospace; }
.num { font-variant-numeric: tabular-nums; }

/* ========= 布局 ========= */
.app { display: grid; grid-template-columns: var(--sidebar-w) 1fr; min-height: 100vh; }
.sidebar {
  background: var(--surface); border-right: 1px solid var(--border);
  padding: 20px 16px; position: fixed; width: var(--sidebar-w);
  height: 100vh; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
}
.main { grid-column: 2; padding: 24px 28px; min-width: 0; }

/* ========= Sidebar ========= */
.brand { padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.brand h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
.brand .subtitle { font-size: 11px; color: var(--text-muted); }
.data-status {
  margin-top: 10px; padding: 8px 10px; background: var(--bg);
  border-radius: var(--radius-sm); font-size: 11px;
}
.data-status .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; }
.data-status .dot.ready { background: var(--success); }
.sidebar-section h3 {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted); margin-bottom: 10px;
}
.filter-item { margin-bottom: 10px; font-size: 12px; }
.filter-item strong { color: var(--text); display: block; margin-bottom: 4px; }
.filter-item .filter-val { color: var(--primary); font-family: 'SF Mono', monospace; }

/* ========= 侧栏多属性筛选表单 ========= */
.filters-section { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.filters-section > h3 {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted); margin: 0 0 2px;
}
.filter-group {
  display: flex; flex-direction: column; align-items: stretch; gap: 5px; width: 100%;
}
.filter-group > label {
  display: block; font-size: 11px; font-weight: 500; color: var(--text-muted); line-height: 1.3;
}
.filter-control {
  display: block; width: 100%; min-width: 0; box-sizing: border-box;
  padding: 7px 10px; font-size: 12px; line-height: 1.4;
  color: var(--text); background: var(--bg);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.filter-control:hover { border-color: #cbd5e1; }
.filter-control:focus {
  outline: none; border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
}
select.filter-control {
  appearance: none; -webkit-appearance: none;
  padding-right: 28px; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center; background-size: 12px;
}
.filter-chips {
  display: flex; flex-wrap: wrap; gap: 4px; font-size: 10px; color: var(--text-muted);
}
.filter-chips:empty { display: none; }
.filter-actions {
  margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--border);
}
.filter-actions .btn { width: 100%; justify-content: center; }

.nav-list { display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: block; padding: 8px 12px; border-radius: var(--radius-sm);
  color: var(--text-muted); font-size: 12px; cursor: pointer; transition: all 0.15s;
  background: transparent; border: none; text-align: left; width: 100%;
}
.nav-item:hover { background: var(--bg); color: var(--text); }
.nav-item.active { background: var(--primary); color: white; font-weight: 500; }

/* ========= Main topbar ========= */
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.topbar h2 { font-size: 18px; font-weight: 700; }
.topbar-actions { display: flex; gap: 8px; }
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.btn:hover { background: var(--bg); }
.btn.primary { background: var(--primary); border-color: var(--primary); color: white; }
.btn.primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }

/* ========= Tabs ========= */
.nav-tabs {
  display: flex; gap: 4px; margin-bottom: 18px;
  background: var(--surface); padding: 4px; border-radius: var(--radius);
  border: 1px solid var(--border);
}
.nav-tabs button {
  flex: 1; padding: 7px 12px; border: none; background: transparent;
  border-radius: var(--radius-sm); font-size: 12px; font-weight: 500;
  color: var(--text-muted); cursor: pointer; transition: all 0.15s;
}
.nav-tabs button:hover { color: var(--text); background: var(--bg); }
.nav-tabs button.active { background: var(--primary); color: white; }
.nav-tabs-ai {
  margin-top: 8px; border-style: dashed; border-color: rgba(99,102,241,0.35);
  background: rgba(99,102,241,0.04);
}
.nav-tabs-ai button.active { background: #8b5cf6; }
.nav-tabs-ai .ai-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
  padding: 1px 5px; border-radius: 999px; margin-left: 4px;
  background: rgba(139,92,246,0.15); color: #7c3aed; vertical-align: middle;
}
#ai-live-nav-section .nav-item { font-size: 11px; }

/* ========= Filter-bar ========= */
.filter-bar {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
  border-radius: var(--radius-sm); margin-bottom: 14px; font-size: 12px;
}
.filter-bar .bar-icon { font-size: 14px; }
.filter-bar .bar-text { flex: 1; color: var(--text); }
.filter-bar .bar-text strong { color: var(--primary); font-weight: 600; }
.filter-bar .bar-clear {
  border: none; background: var(--primary); color: white;
  padding: 4px 12px; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer;
}

.opportunity-intro {
  background: var(--surface); border: 1px solid var(--border);
  border-left: 3px solid var(--warning); border-radius: var(--radius-sm);
  padding: 12px 14px; margin-bottom: 14px; font-size: 12px; line-height: 1.7;
}
.opportunity-intro h3 { font-size: 13px; margin-bottom: 6px; }
.opportunity-intro p { margin: 0 0 4px; }

/* ========= View 切换 ========= */
.view { display: none; animation: fadeIn 0.18s ease; }
.view.active { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* ========= Metrics grid ========= */
.metrics-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px; margin-bottom: 14px;
}
.metric-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px 14px;
  box-shadow: var(--shadow); cursor: default; transition: all 0.15s;
}
.metric-card:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(99,102,241,0.12); transform: translateY(-1px); }
.metric-card .label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
.metric-card .value { font-size: 20px; font-weight: 700; font-family: 'SF Mono', 'Fira Code', monospace; line-height: 1.2; }
.metric-card .value.primary { color: var(--primary); }
.metric-card .value.success { color: var(--success); }
.metric-card .value.warning { color: var(--warning); }
.metric-card .value.danger { color: var(--danger); }
.metric-card .sub { font-size: 10px; color: var(--text-muted); margin-top: 4px; }

/* ========= Charts grid ========= */
.charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 14px; }
.charts-grid.two { grid-template-columns: repeat(2, 1fr); }
.charts-grid.three { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 1100px) { .charts-grid, .charts-grid.three { grid-template-columns: 1fr; } }
.chart-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px 14px; box-shadow: var(--shadow);
}
.chart-card h3 { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.chart-container { position: relative; height: 240px; }
.pie-layout {
  display: grid; grid-template-columns: minmax(120px, 0.9fr) minmax(140px, 1.1fr);
  gap: 12px; align-items: center; min-height: 240px;
}
.pie-layout .chart-container { height: 200px; min-width: 0; }
.pie-legend {
  display: flex; flex-direction: column; gap: 6px; max-height: 220px;
  overflow-y: auto; min-width: 0; padding-right: 2px;
}
.pie-legend-item {
  display: grid; grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 8px; align-items: center; font-size: 11px;
}
.pie-legend-item .dot { width: 8px; height: 8px; border-radius: 2px; }
.pie-legend-item .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pie-legend-item .pct { color: var(--text-muted); font-family: 'SF Mono', monospace; font-size: 10px; }

/* ========= 钻取面包屑 ========= */
.drill-bar {
  display: none; align-items: center; gap: 8px; flex-wrap: wrap;
  margin: 0 0 14px; padding: 10px 12px;
  background: #eef2ff; border: 1px solid #c7d2fe; border-radius: var(--radius-sm);
  font-size: 12px;
}
.drill-bar.visible { display: flex; }
.drill-bar .drill-label { color: var(--text-muted); }
.drill-bar .drill-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; background: #fff; border: 1px solid #c7d2fe;
  border-radius: 999px; color: var(--primary); font-weight: 600;
}
.drill-bar .drill-clear {
  margin-left: auto; border: none; background: transparent;
  color: var(--primary); cursor: pointer; font-size: 12px; text-decoration: underline;
}

/* ========= 热力图 ========= */
.heatmap-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow);
  margin-bottom: 16px; overflow: auto;
}
.heatmap-card h3 { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.heatmap-wrap { overflow: auto; max-height: 420px; }
.heatmap-table { border-collapse: collapse; font-size: 11px; min-width: 100%; }
.heatmap-table th, .heatmap-table td {
  border: 1px solid var(--border); padding: 6px 8px; text-align: right;
  white-space: nowrap;
}
.heatmap-table th { background: var(--bg); position: sticky; top: 0; z-index: 1; font-weight: 600; text-align: center; }
.heatmap-table th.row-head, .heatmap-table td.row-head {
  text-align: left; position: sticky; left: 0; background: var(--surface); z-index: 2; font-weight: 600;
}
.heatmap-table th.row-head { z-index: 3; background: var(--bg); }
.heatmap-table td.hm-cell { cursor: pointer; font-variant-numeric: tabular-nums; transition: outline 0.1s; }
.heatmap-table td.hm-cell:hover { outline: 2px solid var(--primary); outline-offset: -2px; }
.heatmap-legend {
  display: flex; align-items: center; gap: 8px; margin-top: 10px;
  font-size: 10px; color: var(--text-muted);
}
.heatmap-legend .grad {
  flex: 1; max-width: 180px; height: 8px; border-radius: 4px;
  background: linear-gradient(90deg, #eef2ff, #6366f1);
}

/* ========= Table ========= */
.data-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden; margin-bottom: 16px;
}
.data-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 600;
}
.data-card-body { overflow-x: auto; max-height: 520px; overflow-y: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th {
  position: sticky; top: 0; background: var(--surface); z-index: 1;
  padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 600;
  text-transform: uppercase; color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  cursor: pointer; user-select: none; white-space: nowrap;
}
th:hover { color: var(--text); }
td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: rgba(99,102,241,0.04); }
.pager {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 8px 14px; border-top: 1px solid var(--border);
}
.pager .pages { display: flex; gap: 4px; }
.pager button {
  padding: 5px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); font-size: 11px; cursor: pointer;
}
.pager button:hover { background: var(--bg); }
.pager button:disabled { opacity: 0.4; cursor: not-allowed; }
.pager .info { font-size: 11px; color: var(--text-muted); }

/* ========= Tip 图标 + modal ========= */
.tip {
  display: inline-block; box-sizing: border-box;
  width: 13px; height: 13px; margin-left: 5px; padding: 0; border-radius: 50%;
  border: 1px solid #cbd5e1; background: #f1f5f9; color: var(--text-muted);
  font-size: 9px; font-weight: 700; line-height: 11px; text-align: center;
  cursor: help; vertical-align: 0; flex-shrink: 0; font-family: inherit;
}
.tip:hover, .tip:focus {
  border-color: var(--primary); color: var(--primary); background: #eef2ff; outline: none;
}
.tip-modal {
  display: none; position: fixed; inset: 0; z-index: 9999;
  align-items: center; justify-content: center; padding: 20px;
}
.tip-modal.open { display: flex; }
.tip-modal-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); }
.tip-modal-card {
  position: relative; z-index: 1; width: min(420px, 100%);
  max-height: min(70vh, 520px); overflow: auto;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22); padding: 16px 18px;
}
.tip-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.tip-modal-header h3 { font-size: 15px; font-weight: 700; margin: 0; }
.tip-modal-close {
  border: 0; background: var(--bg); color: var(--text-muted);
  width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 16px; line-height: 1;
}
.tip-modal-close:hover { color: var(--text); background: #e2e8f0; }
.tip-modal-body { font-size: 13px; line-height: 1.7; color: var(--text); white-space: pre-wrap; }
`
}

/** Tip modal HTML（按钮 + 弹层容器） */
function buildTipModalHtml(): string {
  return `
<div id="tip-modal" class="tip-modal" aria-hidden="true">
  <div class="tip-modal-backdrop" data-tip-close></div>
  <div class="tip-modal-card">
    <div class="tip-modal-header">
      <h3 id="tip-modal-title">字段说明</h3>
      <button class="tip-modal-close" data-tip-close aria-label="关闭">×</button>
    </div>
    <div class="tip-modal-body" id="tip-modal-body"></div>
  </div>
</div>
`
}

/** 基础 JS：tab 切换、过滤栏清除、表格排序分页、tip modal、Chart.js 配置
 *  如有 detail_table 存在，注入 window.__csv 客户端引擎 */
function buildBaseJs(viewCount: number, hasFilterBar: boolean): string {
  // 通过检查 DOM 是否有 #detail-table 来判断是否为 detail 模式
  return `
(function(){
  // 侧栏筛选字段中文名（钻取动态补控件时用）
  window.__csvFilterLabels = ${JSON.stringify(FILTER_COLUMN_LABELS)};

  // ============ 主题配置 Chart.js ============
  if (window.Chart) {
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 6;
    Chart.defaults.plugins.legend.labels.boxHeight = 6;
  }

  /** 按 body[data-byte-unit] 格式化体积（明细表用） */
  function fmtByteValue(n){
    var unit = (document.body.getAttribute('data-byte-unit') || 'auto').toUpperCase();
    var units = ['B','KB','MB','GB','TB'];
    var v = Number(n);
    if (!isFinite(v)) return String(n);
    if (unit === 'AUTO') {
      var i = 0; var x = Math.abs(v);
      while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
      var f = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
      return (v < 0 ? '-' : '') + f + ' ' + units[i];
    }
    var idx = {B:0,KB:1,MB:2,GB:3,TB:4}[unit];
    if (idx == null) idx = 0;
    var y = v / Math.pow(1024, idx);
    var a = Math.abs(y);
    var ff = a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a.toFixed(2);
    return (y < 0 ? '-' : '') + ff + ' ' + unit;
  }
  function formatDetailCell(col, v){
    if (v === null || v === undefined || v === '') return '';
    if (/compress|byte|size|volume|体积|容量/i.test(String(col)) && isFinite(Number(v))) {
      return fmtByteValue(Number(v));
    }
    return String(v);
  }

  // ============ Tab 切换（多 view + AI 内存 Tab） ============
  var viewCount = ${viewCount};
  var defaultFilterHtml = '';
  var filterSectionEl = document.getElementById('filter-section');
  if (filterSectionEl) defaultFilterHtml = filterSectionEl.innerHTML;

  function activateView(vid){
    document.querySelectorAll('.nav-tabs button[data-view], #ai-live-tabs button[data-view]').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-view') === vid);
    });
    var navs = document.querySelectorAll('.sidebar .nav-item[data-go-view]');
    navs.forEach(function(n){
      n.classList.toggle('active', n.getAttribute('data-go-view') === vid);
    });
    var views = document.querySelectorAll('.view');
    views.forEach(function(v){
      v.classList.toggle('active', v.id === 'view-' + vid);
    });
    // AI Tab 激活时切换侧栏 filter panel
    var liveRoot = document.getElementById('ai-live-views');
    var viewEl = document.getElementById('view-' + vid);
    if (filterSectionEl && liveRoot && viewEl && liveRoot.contains(viewEl)) {
      var fh = (window.__csvLiveTabs && window.__csvLiveTabs.tabsById && window.__csvLiveTabs.tabsById[vid])
        ? window.__csvLiveTabs.tabsById[vid].filterHtml : '';
      if (fh) filterSectionEl.innerHTML = fh;
      else if (defaultFilterHtml) filterSectionEl.innerHTML = defaultFilterHtml;
    } else if (filterSectionEl && defaultFilterHtml && liveRoot && viewEl && !liveRoot.contains(viewEl)) {
      filterSectionEl.innerHTML = defaultFilterHtml;
    }
    // 切换到可见 view 后再初始化 Chart（display:none 下初始化会空白）
    setTimeout(function(){ initChartsIn(document.getElementById('view-' + vid)); }, 30);
    // 切换到含 live 明细的 view 时拉取 /api/rows（多 tab 各有一套明细 DOM）
    setTimeout(function(){
      if (window.__csv && window.__csv.initView) window.__csv.initView(vid);
    }, 50);
  }

  /** 懒加载：只对尚未挂载的 chart-card 执行 new Chart */
  function initChartsIn(root){
    if (!root || !window.Chart) return;
    root.querySelectorAll('.chart-card[data-chart-config]').forEach(function(card){
      if (card.getAttribute('data-chart-ready') === '1') {
        // 已初始化：resize 一下，避免切 tab 后尺寸不对
        var canvas0 = card.querySelector('canvas');
        if (canvas0) {
          var existing = Chart.getChart(canvas0);
          if (existing) { try { existing.resize(); } catch (e) {} }
        }
        return;
      }
      var canvas = card.querySelector('canvas');
      if (!canvas) return;
      var cfgStr = card.getAttribute('data-chart-config');
      if (!cfgStr) return;
      var cfg;
      try { cfg = JSON.parse(cfgStr); } catch (e) { return; }
      var usePie = card.getAttribute('data-chart-pie-legend') === '1';
      var pal = [];
      try { pal = JSON.parse(card.getAttribute('data-chart-palette') || '[]'); } catch (e2) {}
      try {
        var c = new Chart(canvas, cfg);
        card.setAttribute('data-chart-ready', '1');
        if (usePie) {
          var lg = card.querySelector('.pie-legend');
          if (lg && c.data && c.data.datasets && c.data.datasets[0]) {
            var total = c.data.datasets[0].data.reduce(function(a,b){return a+(+b||0)},0)||1;
            lg.innerHTML = c.data.labels.map(function(l,i){
              var v = +c.data.datasets[0].data[i]||0;
              var p = (100*v/total).toFixed(1);
              var lab = String(l).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
              return '<div class="pie-legend-item" data-pie-label="'+lab+'" style="cursor:pointer"><span class="dot" style="background:'+(pal[i%pal.length]||'#6366f1')+'"></span><span class="name">'+l+'</span><span class="pct">'+p+'%</span></div>';
            }).join('');
          }
        }
      } catch (err) {
        console.warn('[CSV Dashboard] Chart init failed', canvas.id, err);
      }
    });
  }
  // URL #view-xxx 指定初始 tab（同 URL 刷新时 openCsvDashboard 会带 hash）
  var hashMatch = location.hash.match(/^#view-([\\w-]+)/);
  if (hashMatch) { activateView(hashMatch[1]); }
  // 首屏只初始化当前 active view
  setTimeout(function(){
    var active = document.querySelector('.view.active') || document.querySelector('.view');
    initChartsIn(active);
    if (active && window.__csv && window.__csv.initView) {
      var initVid = active.id.replace(/^view-/, '');
      if (initVid) window.__csv.initView(initVid);
    }
  }, 40);
  if (viewCount > 1) {
    document.querySelectorAll('.nav-tabs').forEach(function(tabsRoot){
      tabsRoot.addEventListener('click', function(e){
        var btn = e.target.closest('button[data-view]');
        if (!btn) return;
        activateView(btn.getAttribute('data-view'));
      });
    });
    var aiTabsRoot = document.getElementById('ai-live-tabs');
    if (aiTabsRoot) {
      aiTabsRoot.addEventListener('click', function(e){
        var btn = e.target.closest('button[data-view]');
        if (!btn) return;
        activateView(btn.getAttribute('data-view'));
      });
    }
    var navs = document.querySelectorAll('.sidebar .nav-item[data-go-view]');
    navs.forEach(function(n){
      n.addEventListener('click', function(){ activateView(n.getAttribute('data-go-view')); });
    });
  }

  // ============ Filter-bar 清除按钮 ============
  if (${hasFilterBar}) {
    var btnClear = document.querySelector('#filter-bar-clear');
    if (btnClear) btnClear.addEventListener('click', function(){ btnClear.parentElement.style.display = 'none'; });
  }

  // ============ 表格排序（通用） ============
  document.querySelectorAll('table').forEach(function(table){
    var tbody = table.querySelector('tbody');
    if (!tbody) return;
    var ths = table.querySelectorAll('th');
    ths.forEach(function(th, idx){
      if (th.dataset.sortable === 'false') return;
      th.addEventListener('click', function(){
        var rows = Array.from(tbody.querySelectorAll('tr'));
        var asc = th.dataset.dir !== 'asc';
        th.dataset.dir = asc ? 'asc' : 'desc';
        rows.sort(function(a, b){
          var va = (a.children[idx] && a.children[idx].textContent || '').trim();
          var vb = (b.children[idx] && b.children[idx].textContent || '').trim();
          var na = parseFloat(va.replace(/[^0-9eE.+-]/g, ''));
          var nb = parseFloat(vb.replace(/[^0-9eE.+-]/g, ''));
          if (!isNaN(na) && !isNaN(nb) && va.match(/[0-9]/) && vb.match(/[0-9]/)) {
            return asc ? na - nb : nb - na;
          }
          return asc ? va.localeCompare(vb, 'zh') : vb.localeCompare(va, 'zh');
        });
        rows.forEach(function(r){ tbody.appendChild(r); });
        if (window.__retable) window.__retable(table);
      });
    });
  });

  // ============ 表格分页（通用） ============
  window.__retable = function(table){
    var pager = table.parentElement.parentElement.querySelector('.pager');
    if (!pager) return;
    var rows = Array.from(table.querySelectorAll('tbody tr'));
    var pageSize = parseInt(pager.dataset.pageSize || '20', 10);
    var total = rows.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var info = pager.querySelector('.info');
    var prev = pager.querySelector('button[data-page="-1"]');
    var next = pager.querySelector('button[data-page="1"]');
    if (total <= pageSize) { rows.forEach(function(r){ r.style.display = ''; }); if (info) info.textContent = '\u5168\u90e8 ' + total + ' \u6761'; if (prev) prev.disabled = true; if (next) next.disabled = true; return; }
    var currentPage = 0;
    var render = function(){
      rows.forEach(function(r, i){ r.style.display = (i >= currentPage * pageSize && i < (currentPage + 1) * pageSize) ? '' : 'none'; });
      if (info) info.textContent = '\u7b2c ' + (currentPage + 1) + ' / ' + totalPages + ' \u9875\u30fb\u5171 ' + total + ' \u6761';
      if (prev) prev.disabled = currentPage === 0;
      if (next) next.disabled = currentPage === totalPages - 1;
    };
    if (prev) prev.onclick = function(){ if (currentPage > 0) { currentPage--; render(); } };
    if (next) next.onclick = function(){ if (currentPage < totalPages - 1) { currentPage++; render(); } };
    render();
  };
  document.querySelectorAll('table').forEach(function(t){
    if (t.closest('[data-live-detail="1"]')) return;
    window.__retable(t);
  });

  // ============ Tip modal ============
  var modal = document.getElementById('tip-modal');
  var modalTitle = document.getElementById('tip-modal-title');
  var modalBody = document.getElementById('tip-modal-body');
  function openTip(title, body) {
    if (!modal) return;
    modalTitle.textContent = title || '\u5b57\u6bb5\u8bf4\u660e';
    modalBody.textContent = body || '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeTip() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
  document.addEventListener('click', function(e){
    var t = e.target;
    if (t.classList && t.classList.contains('tip') && t.dataset.tipBody) { e.stopPropagation(); openTip(t.dataset.tipTitle || '\u5b57\u6bb5\u8bf4\u660e', t.dataset.tipBody); return; }
    if (t.dataset && t.dataset.tipClose !== undefined) closeTip();
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeTip(); });

  // ==========================================
  //     window.__csv 看板客户端引擎
  // ==========================================
  window.__csv = window.__csv || {};
  (function(engine){
    engine.viewId = '';
    engine.live = false;
    engine.state = { filters: {}, page: 0, pageSize: 30,
      allRows: [], filteredRows: [], sort: '', dir: '', total: 0, columns: [], loading: false };

    /** 当前 view 的明细表元素 id（多 tab 各一套，避免 getElementById 命中隐藏 view） */
    engine.detailIds = function(vid){
      vid = vid || engine.viewId || 'main';
      return {
        count: 'detail-count-' + vid,
        tbody: 'detail-tbody-' + vid,
        pager: 'detail-pager-' + vid,
        prev: 'detail-prev-' + vid,
        next: 'detail-next-' + vid,
        pageInfo: 'detail-page-info-' + vid
      };
    };

    engine.getDetailEl = function(kind, vid){
      var ids = engine.detailIds(vid);
      var el = document.getElementById(ids[kind]);
      if (el) return el;
      var legacy = { count: 'detail-count', tbody: 'detail-tbody', pager: 'detail-pager', prev: 'detail-prev', next: 'detail-next', pageInfo: 'detail-page-info' };
      var viewRoot = (vid || engine.viewId) ? document.getElementById('view-' + (vid || engine.viewId)) : null;
      if (viewRoot) {
        el = viewRoot.querySelector('#' + legacy[kind]);
        if (el) return el;
      }
      return document.getElementById(legacy[kind]);
    };

    engine.findLiveRoot = function(vid){
      var viewEl = document.getElementById('view-' + vid);
      if (!viewEl) return null;
      return viewEl.querySelector('[data-live-detail="1"]');
    };

    engine.prepareView = function(vid){
      engine.viewId = vid;
      var liveRoot = engine.findLiveRoot(vid);
      engine.live = !!liveRoot;
      if (!liveRoot) return;
      engine.state.pageSize = parseInt(liveRoot.getAttribute('data-page-size') || '30', 10) || 30;
      try { engine.state.columns = JSON.parse(liveRoot.getAttribute('data-columns') || '[]'); } catch(e) { engine.state.columns = []; }
    };

    engine.bindLivePager = function(vid){
      var prevBtn = engine.getDetailEl('prev', vid);
      var nextBtn = engine.getDetailEl('next', vid);
      if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = '1';
        prevBtn.addEventListener('click', function(){
          engine.prepareView(vid);
          if (engine.state.page > 0) {
            engine.state.page--;
            if (engine.live) engine.fetchLive(); else engine.renderLocal();
          }
        });
      }
      if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = '1';
        nextBtn.addEventListener('click', function(){
          engine.prepareView(vid);
          var total = engine.live ? engine.state.total : engine.state.filteredRows.length;
          var ps = engine.state.pageSize;
          var tp = Math.max(1, Math.ceil(total / ps) || 1);
          if (engine.state.page < tp - 1) {
            engine.state.page++;
            if (engine.live) engine.fetchLive(); else engine.renderLocal();
          }
        });
      }
    };

    /** 切换 tab 或首屏：对当前 view 的 live 明细发起 /api/rows */
    engine.initView = function(vid){
      if (!vid) return;
      engine.prepareView(vid);
      engine.bindLivePager(vid);
      if (engine.live) {
        engine.state.page = 0;
        engine.state.loading = false;
        engine.fetchLive();
        return;
      }
      var tbody = engine.getDetailEl('tbody', vid);
      if (tbody && tbody.querySelectorAll('tr').length > 0) {
        engine.state.allRows = Array.from(tbody.querySelectorAll('tr'));
        engine.state.filteredRows = engine.state.allRows.slice();
        engine.state.page = 0;
        engine.applyFiltersLocal();
      }
    };

    /** 兼容旧调用 */
    engine.init = function(){
      var active = document.querySelector('.view.active');
      var vid = active && active.id ? active.id.replace(/^view-/, '') : 'main';
      engine.initView(vid);
    };

    /** 读取筛选控件 → 服务端 Filter 数组（通用 dimensions） */
    engine.readFilterList = function(){
      var list = [];
      document.querySelectorAll('#detail-filters [data-filter-id]').forEach(function(el){
        var id = el.getAttribute('data-filter-id');
        var type = el.getAttribute('data-filter-type') || 'select';
        var val = (el.value || '').trim();
        if (!id || !val) return;
        if (type === 'text') {
          list.push({ column: id, op: 'LIKE', value: val });
        } else if (type === 'number_min' || id === 'min_bytes') {
          list.push({ column: id === 'min_bytes' ? 'compress' : id, op: '>=', value: Number(val) || val });
        } else if (type === 'reuse_status' || id === 'reuse_status') {
          // 兼容旧复用状态：映射到 scene_count
          if (val === 'unlinked') list.push({ column: 'scene_count', op: '=', value: 0 });
          else if (val === 'single') list.push({ column: 'scene_count', op: '=', value: 1 });
          else if (val === 'low') list.push({ column: 'scene_count', op: '<=', value: 1 });
          else if (val === 'reused') list.push({ column: 'scene_count', op: '>=', value: 2 });
          else if (val === 'high') list.push({ column: 'scene_count', op: '>=', value: 5 });
        } else {
          list.push({ column: id, op: '=', value: val });
        }
      });
      // 兼容无 data-filter-id 的旧控件
      document.querySelectorAll('#detail-filters select:not([data-filter-id])').forEach(function(sel){
        if (!sel.value) return;
        var key = sel.id.replace('detail-filter-', '');
        if (key === 'min_bytes') list.push({ column: 'compress', op: '>=', value: Number(sel.value) || sel.value });
        else if (key === 'reuse_status') {
          var v = sel.value;
          if (v === 'unlinked') list.push({ column: 'scene_count', op: '=', value: 0 });
          else if (v === 'single') list.push({ column: 'scene_count', op: '=', value: 1 });
          else if (v === 'low') list.push({ column: 'scene_count', op: '<=', value: 1 });
          else if (v === 'reused') list.push({ column: 'scene_count', op: '>=', value: 2 });
          else if (v === 'high') list.push({ column: 'scene_count', op: '>=', value: 5 });
        } else list.push({ column: key, op: '=', value: sel.value });
      });
      var pathInput = document.querySelector('#detail-filter-path:not([data-filter-id])');
      if (pathInput && pathInput.value.trim()) {
        list.push({ column: 'path', op: 'LIKE', value: pathInput.value.trim() });
      }
      return list;
    };

    engine.readFilters = function(){
      var map = {};
      engine.readFilterList().forEach(function(f){ map[f.column] = f.value; });
      return map;
    };

    engine.updateChips = function(filters){
      var chips = document.getElementById('detail-filter-chips');
      if (!chips) return;
      var entries = [];
      for (var key in filters) entries.push(key + '=' + filters[key]);
      if (entries.length === 0) { chips.innerHTML = ''; return; }
      chips.innerHTML = entries.map(function(kv){
        return '<span class="chip">' + kv + '<button type="button" data-chip-key="' + kv.split('=')[0] + '">&times;</button></span>';
      }).join('');
    };

    engine.removeChip = function(key){
      var sel = document.querySelector('#detail-filter-' + key);
      if (sel) sel.value = '';
      engine.applyFilters();
    };

    document.addEventListener('click', function(e){
      var btn = e.target && e.target.closest ? e.target.closest('[data-chip-key]') : null;
      if (btn) { engine.removeChip(btn.getAttribute('data-chip-key')); }
    });

    /** Live：向 /api/rows 拉一页 */
    engine.fetchLive = function(){
      if (!engine.live || engine.state.loading) return;
      engine.state.loading = true;
      var countEl = engine.getDetailEl('count');
      if (countEl) countEl.textContent = '\u52a0\u8f7d\u4e2d\u2026';
      var filters = engine.readFilterList();
      engine.state.filters = engine.readFilters();
      engine.updateChips(engine.state.filters);
      var body = {
        filters: filters,
        select: (engine.state.columns || []).join(','),
        sort: engine.state.sort || undefined,
        sort_dir: engine.state.dir || 'desc',
        limit: engine.state.pageSize,
        offset: engine.state.page * engine.state.pageSize
      };
      fetch('/api/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function(r){
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function(data){
        engine.state.loading = false;
        if (data.error) {
          if (countEl) countEl.textContent = '\u9519\u8bef: ' + data.error;
          engine.renderLiveError(data.error);
          return;
        }
        engine.state.total = data.total_before_limit || 0;
        engine.renderLiveRows(data.rows || []);
      }).catch(function(err){
        engine.state.loading = false;
        var msg = err && err.message ? err.message : String(err);
        if (countEl) countEl.textContent = '\u52a0\u8f7d\u5931\u8d25\uff08\u8bf7\u7528\u770b\u677f http \u5730\u5740\u6253\u5f00\uff09: ' + msg;
        engine.renderLiveError(msg);
      });
    };

    engine.renderLiveError = function(msg){
      var tbody = engine.getDetailEl('tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="99" style="color:var(--danger,#dc2626);padding:12px;font-size:12px">\u660e\u7ec6\u52a0\u8f7d\u5931\u8d25\uff1a' + String(msg).replace(/[&<>"']/g, function(ch){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
      }) + '</td></tr>';
    };

    engine.renderLiveRows = function(rows){
      var tbody = engine.getDetailEl('tbody');
      if (!tbody) return;
      var cols = engine.state.columns || [];
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="99" style="color:var(--text-muted);padding:12px;font-size:12px">\u6682\u65e0\u5339\u914d\u6570\u636e</td></tr>';
      } else {
        tbody.innerHTML = rows.map(function(row){
          return '<tr>' + cols.map(function(c){
            var v = formatDetailCell(c, row[c]);
            return '<td class="num' + (c === 'path' ? ' path-cell' : '') + '">' + String(v).replace(/[&<>"']/g, function(ch){
              return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
            }) + '</td>';
          }).join('') + '</tr>';
        }).join('');
      }
      var total = engine.state.total;
      var pageSize = engine.state.pageSize;
      var page = engine.state.page;
      var totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
      var countEl = engine.getDetailEl('count');
      if (countEl) countEl.textContent = '\u5171 ' + total.toLocaleString() + ' \u6761\uff08\u670d\u52a1\u7aef\u7b5b\u9009\uff09';
      var info = engine.getDetailEl('pageInfo');
      if (info) info.textContent = '\u7b2c ' + (page + 1) + ' / ' + totalPages + ' \u9875\u30fb\u5171 ' + total.toLocaleString() + ' \u6761';
      var prev = engine.getDetailEl('prev');
      var next = engine.getDetailEl('next');
      if (prev) prev.disabled = page === 0;
      if (next) next.disabled = page >= totalPages - 1;
    };

    /** 静态模式：本地过滤已嵌入的行 */
    engine.applyFiltersLocal = function(){
      var filters = engine.readFilters();
      engine.state.filters = filters;
      var allRows = engine.state.allRows;
      var filterList = engine.readFilterList();
      var filtered = allRows.filter(function(row){
        for (var i = 0; i < filterList.length; i++) {
          var f = filterList[i];
          var val = row.getAttribute('data-' + f.column) || '';
          if (f.op === 'LIKE') {
            if (val.toLowerCase().indexOf(String(f.value).toLowerCase()) < 0) return false;
          } else if (f.op === '>=') {
            if (parseFloat(val) < parseFloat(f.value)) return false;
          } else if (f.op === '<=') {
            if (parseFloat(val) > parseFloat(f.value)) return false;
          } else if (String(val) !== String(f.value)) return false;
        }
        return true;
      });
      engine.state.filteredRows = filtered;
      engine.updateChips(filters);
      engine.renderLocal();
    };

    engine.renderLocal = function(){
      var tbody = engine.getDetailEl('tbody');
      if (!tbody) return;
      var rows = engine.state.filteredRows;
      var total = rows.length;
      var pagerEl = engine.getDetailEl('pager');
      var pageSize = parseInt((pagerEl && pagerEl.dataset.pageSize) || '30', 10);
      var page = engine.state.page;
      var totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
      if (page >= totalPages) page = totalPages - 1;
      if (page < 0) page = 0;
      engine.state.page = page;
      engine.state.allRows.forEach(function(r){ r.style.display = 'none'; });
      rows.forEach(function(r, i){
        r.style.display = (i >= page * pageSize && i < (page + 1) * pageSize) ? '' : 'none';
      });
      var countEl = engine.getDetailEl('count');
      if (countEl) countEl.textContent = '\u7b5b\u9009\u540e ' + total + ' \u6761\u8bb0\u5f55';
      var info = engine.getDetailEl('pageInfo');
      if (info) info.textContent = '\u7b2c ' + (page + 1) + ' / ' + totalPages + ' \u9875\u30fb\u5171 ' + total + ' \u6761';
      var prev = engine.getDetailEl('prev');
      var next = engine.getDetailEl('next');
      if (prev) prev.disabled = page === 0;
      if (next) next.disabled = page >= totalPages - 1;
    };

    engine.applyFilters = function(){
      engine.state.page = 0;
      if (engine.live) engine.fetchLive();
      else engine.applyFiltersLocal();
    };

    document.querySelectorAll('#detail-filters select, #detail-filters input[type="text"]').forEach(function(el){
      var evt = el.tagName === 'INPUT' ? 'input' : 'change';
      el.addEventListener(evt, function(){
        clearTimeout(el._timeout);
        el._timeout = setTimeout(function(){ engine.applyFilters(); }, el.tagName === 'INPUT' ? 300 : 0);
      });
    });

    var clearBtn = document.getElementById('detail-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', function(){
      document.querySelectorAll('#detail-filters select, #detail-filters input[type="text"]').forEach(function(s){ s.value = ''; });
      engine.applyFilters();
    });

    document.querySelectorAll('.metric-card[data-click-filter]').forEach(function(card){
      card.addEventListener('click', function(){
        var filterJson = card.getAttribute('data-click-filter');
        if (!filterJson) return;
        try { engine.navigateToDetail(JSON.parse(filterJson)); } catch(e) {}
      });
    });

    function bindChartDrill(card){
      var map = card.dataset.clickFilterMap;
      if (!map) return;
      var filterMap;
      try { filterMap = JSON.parse(map); } catch(e) { return; }
      var canvas = card.querySelector('canvas');
      if (canvas) {
        canvas.addEventListener('click', function(e){
          var chartObj = Chart.getChart(canvas.id);
          if (!chartObj) return;
          var els = chartObj.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
          if (!els || els.length === 0) return;
          var idx = els[0].index;
          var label = chartObj.data.labels[idx];
          var filterObj = filterMap[label];
          if (filterObj) engine.navigateToDetail(filterObj);
        });
      }
      // 饼图右侧 legend 点击钻取
      card.addEventListener('click', function(e){
        var item = e.target && e.target.closest ? e.target.closest('[data-pie-label]') : null;
        if (!item) return;
        var lab = item.getAttribute('data-pie-label');
        if (lab && filterMap[lab]) engine.navigateToDetail(filterMap[lab]);
      });
    }
    document.querySelectorAll('.chart-card').forEach(bindChartDrill);

    engine.navigateToDetail = function(filterObj, opts){
      opts = opts || {};
      // 钻取栈：多级合并（后点的覆盖同 key，保留不同 key）
      engine.drillStack = engine.drillStack || [];
      if (!opts.replace) {
        var merged = {};
        engine.drillStack.forEach(function(f){ for (var k in f) merged[k] = f[k]; });
        for (var k2 in filterObj) merged[k2] = filterObj[k2];
        // 若与栈顶相同则不重复 push
        var top = engine.drillStack[engine.drillStack.length - 1];
        var same = top && Object.keys(merged).length === Object.keys(top).length && Object.keys(merged).every(function(k){ return String(merged[k]) === String(top[k]); });
        if (!same) engine.drillStack.push(Object.assign({}, merged));
        filterObj = merged;
      } else {
        engine.drillStack = [Object.assign({}, filterObj)];
      }
      engine.renderDrillBar();

      if (document.getElementById('view-detail')) activateView('detail');
      else {
        var activeView = document.querySelector('.view.active');
        var liveInActive = activeView && activeView.querySelector('[data-live-detail="1"]');
        if (liveInActive && activeView.id) {
          activateView(activeView.id.replace(/^view-/, ''));
        } else {
          var anyLive = document.querySelector('.view [data-live-detail="1"]');
          if (anyLive) {
            var parentView = anyLive.closest('.view');
            if (parentView && parentView.id && parentView.id.indexOf('view-') === 0) {
              activateView(parentView.id.replace(/^view-/, ''));
            }
          }
        }
      }
      for (var key in filterObj) {
        var sel = document.querySelector('#detail-filter-' + key);
        if (sel) sel.value = String(filterObj[key]);
        else {
          var box = document.getElementById('detail-filters');
          if (box) {
            var wrap = document.createElement('div');
            wrap.className = 'filter-group';
            var lbl = (window.__csvFilterLabels && window.__csvFilterLabels[key]) || key;
            wrap.innerHTML = '<label for="detail-filter-'+key+'">'+lbl+'</label><select class="filter-control" id="detail-filter-'+key+'" data-filter-id="'+key+'" data-filter-type="select"><option value=""></option><option value="'+String(filterObj[key])+'" selected>'+String(filterObj[key])+'</option></select>';
            box.insertBefore(wrap, box.firstChild);
          }
        }
      }
      setTimeout(function(){ engine.applyFilters(); }, 80);
    };

    engine.renderDrillBar = function(){
      var bar = document.getElementById('drill-bar');
      var chips = document.getElementById('drill-chips');
      if (!bar || !chips) return;
      var stack = engine.drillStack || [];
      if (stack.length === 0) { bar.classList.remove('visible'); chips.innerHTML = ''; return; }
      bar.classList.add('visible');
      var cur = stack[stack.length - 1] || {};
      chips.innerHTML = Object.keys(cur).map(function(k){
        return '<span class="drill-chip">'+k+'='+cur[k]+'</span>';
      }).join('');
    };

    engine.clearDrill = function(){
      engine.drillStack = [];
      engine.renderDrillBar();
      document.querySelectorAll('#detail-filters select, #detail-filters input[type="text"]').forEach(function(s){ s.value = ''; });
      engine.applyFilters();
    };

    var clearDrillBtn = document.getElementById('drill-clear');
    if (clearDrillBtn) clearDrillBtn.addEventListener('click', function(){ engine.clearDrill(); });

    // 热力图格子 / 行头钻取
    document.querySelectorAll('.hm-cell[data-click-filter], td.row-head[data-click-filter]').forEach(function(cell){
      cell.addEventListener('click', function(){
        try {
          var f = JSON.parse(cell.getAttribute('data-click-filter') || '{}');
          engine.navigateToDetail(f);
        } catch(e) {}
      });
    });

    // 首屏由外层 setTimeout 调 initView(activeViewId)
  })(window.__csv);

  // ============ AI 内存 Tab（live_tab，不落盘）============
  (function(){
    var liveNavSection = document.getElementById('ai-live-nav-section');
    var liveTabsRoot = document.getElementById('ai-live-tabs');
    var liveNavRoot = document.getElementById('ai-live-nav');
    var liveViewsRoot = document.getElementById('ai-live-views');
    if (!liveViewsRoot) return;

    window.__csvLiveTabs = window.__csvLiveTabs || {};
    var api = window.__csvLiveTabs;
    api.tabsById = {};

    api.render = function(tabs){
      if (!Array.isArray(tabs)) tabs = [];
      api.tabsById = {};
      tabs.forEach(function(t){ api.tabsById[t.id] = t; });

      var has = tabs.length > 0;
      if (liveNavSection) liveNavSection.style.display = has ? '' : 'none';
      if (liveTabsRoot) liveTabsRoot.style.display = has ? '' : 'none';

      if (liveTabsRoot) {
        liveTabsRoot.innerHTML = tabs.map(function(t){
          return '<button type="button" data-view="'+t.id+'">'+t.label+' <span class="ai-badge">AI</span></button>';
        }).join('');
      }
      if (liveNavRoot) {
        liveNavRoot.innerHTML = tabs.map(function(t){
          return '<button type="button" class="nav-item" data-go-view="'+t.id+'">'+t.label+'</button>';
        }).join('');
        liveNavRoot.querySelectorAll('.nav-item[data-go-view]').forEach(function(n){
          n.addEventListener('click', function(){ activateView(n.getAttribute('data-go-view')); });
        });
      }
      if (liveViewsRoot) {
        liveViewsRoot.innerHTML = tabs.map(function(t){
          return '<div class="view" id="view-'+t.id+'">'+t.sectionsHtml+'</div>';
        }).join('');
      }

      liveViewsRoot.querySelectorAll('table').forEach(function(t){
        if (t.closest('[data-live-detail="1"]')) return;
        if (window.__retable) window.__retable(t);
      });
    };

    api.refresh = async function(){
      try {
        var res = await fetch('/api/live-tabs');
        if (!res.ok) return;
        var data = await res.json();
        api.render(data.tabs || []);
      } catch(e) { console.warn('[CSV LiveTabs]', e); }
    };

    api.init = async function(){
      var params = new URLSearchParams(location.search);
      var skipClear = params.get('keep_live') === '1' || sessionStorage.getItem('csv-skip-clear-once') === '1';
      if (sessionStorage.getItem('csv-skip-clear-once') === '1') sessionStorage.removeItem('csv-skip-clear-once');

      var navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (navEntry && navEntry.type === 'reload' && !skipClear) {
        try { await fetch('/api/live-tabs', { method: 'DELETE' }); } catch(e) {}
      }

      await api.refresh();

      var hashMatch = location.hash.match(/^#view-([\\w-]+)/);
      if (hashMatch && document.getElementById('view-' + hashMatch[1])) {
        activateView(hashMatch[1]);
      }
    };

    api.init();
  })();

})();
`
}

/** 把图表数据转成 Chart.js 友好的 datasets 格式 */
function buildChartData(section: DashboardSectionV2): {
  type: string
  data: {
    labels: string[]
    datasets: Array<{
      label?: string
      data: number[]
      backgroundColor?: string | string[]
      stack?: string
    }>
  }
  options: Record<string, unknown>
} {
  const chartType = section.chart_type || 'bar'
  const palette = CHART_PALETTE
  const raw = section.data

  // 多系列堆叠/分组：{ labels: string[], datasets: [{label, data: number[]}] }
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray((raw as { labels?: unknown }).labels) &&
    Array.isArray((raw as { datasets?: unknown }).datasets)
  ) {
    const multi = raw as {
      labels: string[]
      datasets: Array<{ label?: string; data: number[] }>
    }
    const stacked = chartType === 'stacked_bar'
    return {
      type: 'bar',
      data: {
        labels: multi.labels,
        datasets: multi.datasets.map((ds, i) => ({
          label: ds.label || `系列${i + 1}`,
          data: (ds.data || []).map((n) => Number(n) || 0),
          backgroundColor: palette[i % palette.length],
          stack: stacked ? 'stack0' : undefined,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: {
          x: { stacked, beginAtZero: true },
          y: { stacked, beginAtZero: true },
        },
      },
    }
  }

  if (chartType === 'pie' || chartType === 'doughnut') {
    const entries = Object.entries((raw || {}) as Record<string, number>)
    return {
      type: chartType,
      data: {
        labels: entries.map(([k]) => k),
        datasets: [{ data: entries.map(([, v]) => Number(v) || 0), backgroundColor: palette }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    }
  }

  if (chartType === 'horizontal_bar') {
    const items = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>
    return {
      type: 'bar',
      data: {
        labels: items.map((it) => String(it.name || it.label || '')),
        datasets: [
          {
            data: items.map((it) => Number(it.value || it.count || 0)),
            backgroundColor: palette.slice(0, 1),
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    }
  }

  // 默认 bar / 单系列 stacked_bar
  const items = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>
  return {
    type: 'bar',
    data: {
      labels: items.map((it) => String(it.name || it.label || '')),
      datasets: [
        {
          data: items.map((it) => Number(it.value || it.count || 0)),
          backgroundColor: palette.slice(0, 1),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: chartType === 'stacked_bar', beginAtZero: true },
        y: { stacked: chartType === 'stacked_bar', beginAtZero: true },
      },
    },
  }
}

/** 从 chart 数据推断 click_filter_map */
function resolveClickFilterMap(
  section: DashboardSectionV2
): Record<string, Record<string, string | number>> | undefined {
  if (section.click_filter_map) return section.click_filter_map
  const col = section.filter_column
  if (!col) return undefined
  const raw = section.data
  const labels: string[] = []
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray((raw as { labels?: string[] }).labels)
  ) {
    labels.push(...((raw as { labels: string[] }).labels || []))
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    labels.push(...Object.keys(raw as Record<string, unknown>))
  } else if (Array.isArray(raw)) {
    for (const it of raw as Array<Record<string, unknown>>) {
      labels.push(String(it.name || it.label || ''))
    }
  }
  if (labels.length === 0) return undefined
  return Object.fromEntries(labels.filter(Boolean).map((l) => [l, { [col]: l }]))
}

/** 单个 section 的渲染（chartIdPrefix 避免多 view 下 canvas id 冲突） */
function renderSection(
  section: DashboardSectionV2,
  index: number,
  chartIdPrefix = 'chart',
  viewId = 'main'
): string {
  switch (section.type) {
    case 'filter_bar':
      return renderFilterBarSection(section)
    case 'opportunity_intro':
      return renderOpportunitySection(section)
    case 'filter_panel':
      return renderFilterPanel(section)
    case 'detail_table':
      return renderDetailTable(section, viewId)
    case 'heatmap':
      return renderHeatmapSection(section)
    case 'stats':
      return renderStatsSection(section)
    case 'chart': {
      const chartId = `${chartIdPrefix}-${index}`
      const cfg = buildChartData(section)
      const usePieLegend =
        section.chart_layout === 'pie_with_legend' &&
        (cfg.type === 'pie' || cfg.type === 'doughnut')
      const canvasHtml = `<canvas id="${chartId}"></canvas>`
      const paletteStr = JSON.stringify(CHART_PALETTE)
      const cfgStr = JSON.stringify(cfg)
      const filterMap = resolveClickFilterMap(section)
      const filterMapAttr = filterMap
        ? ` data-click-filter-map="${escapeHtml(JSON.stringify(filterMap))}"`
        : ''
      // 不内联立即 new Chart：隐藏 view（display:none）下初始化会得到空白 canvas
      // 配置挂到 data-chart-config，由 activateView / 首屏 initVisibleCharts 懒加载
      const configAttr = ` data-chart-config="${escapeHtml(cfgStr)}" data-chart-pie-legend="${usePieLegend ? '1' : '0'}" data-chart-palette="${escapeHtml(paletteStr)}"`
      const inner = usePieLegend
        ? `<div class="pie-layout"><div class="chart-container">${canvasHtml}</div><div class="pie-legend"></div></div>`
        : `<div class="chart-container">${canvasHtml}</div>`
      return `
<div class="chart-card"${filterMapAttr}${configAttr} style="cursor:${filterMap ? 'pointer' : 'default'}">
  <h3>${escapeHtml(section.title || '')}${filterMap ? ' <span style="font-size:10px;color:var(--text-muted);font-weight:400">点击钻取明细</span>' : ''}</h3>
  ${inner}
</div>`
    }
    case 'table':
      return renderTableSection(section, index)
    default:
      return ''
  }
}

/** 透视热力图：行列交叉着色，点击格子钻取明细 */
function renderHeatmapSection(section: DashboardSectionV2): string {
  const rowKey = section.row_key || ''
  const colKey = section.col_key || ''
  const valueKey = section.value_key || 'count'
  const rows = section.rows || []
  if (!rowKey || !colKey || rows.length === 0) {
    return `<div class="heatmap-card"><h3>${escapeHtml(section.title || '热力图')}</h3><p style="color:var(--text-muted);font-size:12px">无交叉数据</p></div>`
  }

  const pair = new Map<string, number>()
  const rowTotals = new Map<string, number>()
  const colTotals = new Map<string, number>()
  let maxV = 0
  for (const r of rows) {
    const rk = String(r[rowKey] ?? '(空)')
    const ck = String(r[colKey] ?? '(空)')
    const v = Number(r[valueKey] ?? 0) || 0
    pair.set(`${rk}\0${ck}`, v)
    rowTotals.set(rk, (rowTotals.get(rk) || 0) + v)
    colTotals.set(ck, (colTotals.get(ck) || 0) + v)
    if (v > maxV) maxV = v
  }
  const rowLabels = [...rowTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([k]) => k)
  const colLabels = [...colTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([k]) => k)

  function cellBg(v: number): string {
    if (maxV <= 0 || v <= 0) return '#f8fafc'
    const t = Math.min(1, v / maxV)
    // indigo 浅→深
    const r = Math.round(238 - t * (238 - 99))
    const g = Math.round(242 - t * (242 - 102))
    const b = Math.round(255 - t * (255 - 241))
    return `rgb(${r},${g},${b})`
  }

  function fmt(v: number): string {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
    return String(Math.round(v))
  }

  const head = `<th class="row-head">${escapeHtml(section.row_label || rowKey)} \\ ${escapeHtml(section.col_label || colKey)}</th>${colLabels
    .map(
      (c) =>
        `<th title="${escapeHtml(c)}">${escapeHtml(c.length > 10 ? c.slice(0, 10) + '…' : c)}</th>`
    )
    .join('')}`

  const body = rowLabels
    .map((rk) => {
      const cells = colLabels
        .map((ck) => {
          const v = pair.get(`${rk}\0${ck}`) || 0
          const filter = JSON.stringify({ [rowKey]: rk, [colKey]: ck })
          const textColor = maxV > 0 && v / maxV > 0.55 ? '#fff' : 'var(--text)'
          return `<td class="hm-cell" data-click-filter="${escapeHtml(filter)}" style="background:${cellBg(v)};color:${textColor}" title="${escapeHtml(rk)} × ${escapeHtml(ck)} = ${v}">${v ? fmt(v) : '·'}</td>`
        })
        .join('')
      return `<tr><td class="row-head" data-click-filter="${escapeHtml(JSON.stringify({ [rowKey]: rk }))}" style="cursor:pointer" title="钻取行">${escapeHtml(rk)}</td>${cells}</tr>`
    })
    .join('')

  return `
<div class="heatmap-card">
  <h3>${escapeHtml(section.title || '交叉热力图')} <span style="font-size:10px;color:var(--text-muted);font-weight:400">点击格子钻取明细</span></h3>
  <div class="heatmap-wrap">
    <table class="heatmap-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <div class="heatmap-legend"><span>低</span><div class="grad"></div><span>高</span><span style="margin-left:8px">值字段: ${escapeHtml(valueKey)}</span></div>
</div>`
}

/** Filter-bar section（高亮当前过滤条件） */
function renderFilterBarSection(section: DashboardSectionV2): string {
  const keys = (section.filter_keys || [])
    .map((k) => `<strong>${escapeHtml(k)}</strong>`)
    .join('、')
  const desc = section.filter_desc || '已应用过滤'
  return `
<div class="filter-bar">
  <span class="bar-icon">🔍</span>
  <span class="bar-text"><strong>当前过滤</strong>：${escapeHtml(desc)}${keys ? '（' + keys + '）' : ''}</span>
  <button id="filter-bar-clear" class="bar-clear" type="button">清除</button>
</div>
`
}

/** Opportunity intro section（复用机会摘要，带 warning 左 border） */
function renderOpportunitySection(section: DashboardSectionV2): string {
  const lines = Array.isArray(section.data) ? section.data : []
  return `
<div class="opportunity-intro">
  <h3>${escapeHtml(section.title || '优化建议')}</h3>
  ${lines.map((l) => `<p>${escapeHtml(String(l))}</p>`).join('')}
</div>
`
}

/** Stats section：KPI 卡（对齐 metric-card，可选 value_color + sub + click_filter） */
function renderStatsSection(section: DashboardSectionV2): string {
  const data = section.data
  if (data && !Array.isArray(data) && typeof data === 'object') {
    const items = Object.entries(data as Record<string, string | number>)
      .map(([key, value]) => {
        const color =
          typeof value === 'number' && value > 0 && /率|pct|percent/i.test(key) ? 'primary' : ''
        return `<div class="metric-card"><div class="label">${escapeHtml(key)}</div><div class="value num ${color}">${escapeHtml(String(value))}</div></div>`
      })
      .join('')
    return `<div class="metrics-grid">${items}</div>`
  }
  const color = section.value_color || ''
  const sub = section.sub ? `<div class="sub">${escapeHtml(section.sub)}</div>` : ''
  const clickAttr = section.click_filter
    ? ` data-click-filter="${escapeHtml(JSON.stringify(section.click_filter))}" style="cursor:pointer"`
    : ''
  const card = `
<div class="metric-card"${clickAttr}>
  <div class="label">${escapeHtml(section.label || section.title || '')}</div>
  <div class="value num ${color}">${escapeHtml(String(section.value ?? ''))}</div>
  ${sub}
</div>`
  return `<div class="metrics-grid">${card}</div>`
}

/** Table section：data-table wrap + tip 列头 + 排序 + 分页 */
function renderTableSection(section: DashboardSectionV2, index: number): string {
  const tableId = `table-${index}`
  const columns = section.columns || []
  const rows = section.rows || []
  const pageSize = section.page_size || 20
  const sortable = section.sortable !== false
  const paginated = section.paginated === true
  const columnTips = section.column_tips || {}
  const headerHtml = columns
    .map((col) => {
      const tip = columnTips[col]
      const tipHtml = tip
        ? `<button type="button" class="tip" data-tip-title="${escapeHtml(col)}" data-tip-body="${escapeHtml(tip)}" aria-label="说明">i</button>`
        : ''
      return `<th data-col="${escapeHtml(col)}"${sortable ? '' : ' data-sortable="false"'}>${escapeHtml(col)}${tipHtml}</th>`
    })
    .join('')
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td class="num">${escapeHtml(row[c] ?? '')}</td>`).join('')}</tr>`
    )
    .join('')
  const pagerHtml = paginated
    ? `<div class="pager" data-page-size="${pageSize}">
        <button type="button" data-page="-1">上一页</button>
        <span class="info"></span>
        <button type="button" data-page="1">下一页</button>
      </div>`
    : ''
  return `
<div class="data-card">
  <div class="data-card-header">${escapeHtml(section.title || '')}</div>
  <div class="data-card-body">
    <table id="${tableId}">
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </div>
  ${pagerHtml}
</div>`
}

/** 把多组 sections 渲染成 charts-grid 容器（按行分割，3 列） */
function renderChartsGrid(sections: DashboardSectionV2[], chartIdPrefix = 'chart'): string {
  const viewId = chartIdPrefix.replace(/^chart-/, '') || 'main'
  const charts = sections.map((s, i) => renderSection(s, i, chartIdPrefix, viewId))
  if (charts.length === 0) return ''
  const cls =
    sections.length >= 3
      ? 'charts-grid three'
      : sections.length === 2
        ? 'charts-grid two'
        : 'charts-grid'
  return `<div class="${cls}">${charts.join('')}</div>`
}

/**
 * 渲染一个 view 的全部 sections：连续 chart 收进网格，避免单列稀疏。
 * chartIdPrefix 保证多 view 下 canvas id 唯一。
 */
function renderViewSections(sections: DashboardSectionV2[], chartIdPrefix: string): string {
  const viewId = chartIdPrefix.replace(/^chart-/, '') || 'main'
  const parts: string[] = []
  let chartBuf: DashboardSectionV2[] = []
  let idx = 0

  const flushCharts = (): void => {
    if (chartBuf.length === 0) return
    const withIds = chartBuf.map((s, i) =>
      renderSection(s, idx - chartBuf.length + i, chartIdPrefix, viewId)
    )
    // 重新走 renderChartsGrid 逻辑以带上 class
    const cls =
      chartBuf.length >= 3
        ? 'charts-grid three'
        : chartBuf.length === 2
          ? 'charts-grid two'
          : 'charts-grid'
    parts.push(`<div class="${cls}">${withIds.join('')}</div>`)
    chartBuf = []
  }

  for (const s of sections) {
    if (s.type === 'chart') {
      chartBuf.push(s)
      idx++
      continue
    }
    flushCharts()
    parts.push(renderSection(s, idx, chartIdPrefix, viewId))
    idx++
  }
  flushCharts()
  return parts.join('\n')
}

/** Detail Table：支持 live（空表壳 + /api/rows）与静态嵌入两种模式 */
function renderDetailTable(section: DashboardSectionV2, viewId = 'main'): string {
  const columns = section.columns || []
  const rows = section.rows || []
  const pageSize = section.page_size || 30
  const columnTips = section.column_tips || {}
  const live = section.live === true
  const sid = escapeHtml(viewId)
  const headerHtml = columns
    .map((col) => {
      const tip = columnTips[col]
      const tipHtml = tip
        ? `<button type="button" class="tip" data-tip-title="${escapeHtml(col)}" data-tip-body="${escapeHtml(tip)}" aria-label="说明">i</button>`
        : ''
      return `<th data-col="${escapeHtml(col)}"${col === 'path' ? ' class="path-cell"' : ''}>${escapeHtml(col)}${tipHtml}</th>`
    })
    .join('')

  // live 模式：不嵌入百万行，由客户端向 /api/rows 拉取
  if (live) {
    return `
<div class="data-card" data-live-detail="1" data-view-id="${sid}" data-page-size="${pageSize}" data-columns="${escapeHtml(JSON.stringify(columns))}">
  <div class="data-card-header">
    <span>${escapeHtml(section.title || '资源明细')}</span>
    <span id="detail-count-${sid}" class="info" style="font-weight:400">加载中…</span>
  </div>
  <div class="data-card-body" id="detail-body-${sid}">
    <table id="live-detail-table-${sid}">
      <thead><tr>${headerHtml}</tr></thead>
      <tbody id="detail-tbody-${sid}"></tbody>
    </table>
  </div>
  <div class="pager" id="detail-pager-${sid}" data-page-size="${pageSize}">
    <button type="button" id="detail-prev-${sid}" data-page="-1">上一页</button>
    <span class="info" id="detail-page-info-${sid}"></span>
    <button type="button" id="detail-next-${sid}" data-page="1">下一页</button>
  </div>
</div>`
  }

  const bodyHtml = rows
    .map((row) => {
      const attrs = Object.entries(row)
        .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
        .map(([k, v]) => `data-${k.replace(/[^a-zA-Z0-9_-]/g, '_')}="${escapeHtml(String(v))}"`)
        .join(' ')
      return `<tr ${attrs}>${columns.map((c) => `<td class="num${c === 'path' ? ' path-cell' : ''}">${escapeHtml(row[c] ?? '')}</td>`).join('')}</tr>`
    })
    .join('')
  return `
<div class="data-card">
  <div class="data-card-header">
    <span>${escapeHtml(section.title || '资产明细')}</span>
    <span id="detail-count" class="info" style="font-weight:400"></span>
  </div>
  <div class="data-card-body" id="detail-body">
    <table id="detail-table">
      <thead><tr>${headerHtml}</tr></thead>
      <tbody id="detail-tbody">${bodyHtml}</tbody>
    </table>
  </div>
  <div class="pager" id="detail-pager" data-page-size="${pageSize}">
    <button type="button" id="detail-prev" data-page="-1">上一页</button>
    <span class="info" id="detail-page-info"></span>
    <button type="button" id="detail-next" data-page="1">下一页</button>
  </div>
</div>`
}

/** 常见列名 → 中文展示（sql_name / id 仍作 value） */
const FILTER_COLUMN_LABELS: Record<string, string> = {
  owner: '负责人',
  fcat: '类别',
  category: '类别',
  type: '类型',
  geo_tag: '地理标签',
  path: '路径',
  module: '模块',
  mod: '模块',
  ext: '文件后缀',
  compress: '体积',
  size: '体积',
  bytes: '体积',
  status: '状态',
  region: '区域',
  platform: '平台',
  channel: '渠道',
  brand: '品牌',
}

function resolveFilterLabel(id: string, fallback?: string): string {
  const key = id.toLowerCase()
  if (FILTER_COLUMN_LABELS[key]) return FILTER_COLUMN_LABELS[key]
  const minMatch = /^(?:最小\s+)(.+)$/i.exec(String(fallback || ''))
  if (minMatch) {
    const inner = minMatch[1]!.toLowerCase()
    if (FILTER_COLUMN_LABELS[inner]) return `最小 ${FILTER_COLUMN_LABELS[inner]}`
  }
  if (fallback && fallback !== id && !/^[a-z][a-z0-9_]*$/i.test(fallback)) return fallback
  return FILTER_COLUMN_LABELS[key] || fallback || id
}

/** Filter Panel：侧栏过滤面板（通用 dimensions 优先，旧游戏字段兼容） */
function renderFilterPanel(section: DashboardSectionV2): string {
  function renderSelect(
    label: string,
    id: string,
    options: Array<string | number> | undefined,
    placeholder?: string,
    defaultValue?: string | number
  ): string {
    const displayLabel = resolveFilterLabel(id, label)
    const def = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : ''
    const opts = (options || [])
      .map((v) => {
        const sv = String(v)
        const sel = def && sv === def ? ' selected' : ''
        return `<option value="${escapeHtml(sv)}"${sel}>${escapeHtml(sv)}</option>`
      })
      .join('')
    return `
<div class="filter-group">
  <label for="detail-filter-${escapeHtml(id)}">${escapeHtml(displayLabel)}</label>
  <select class="filter-control" id="detail-filter-${escapeHtml(id)}" data-filter-id="${escapeHtml(id)}" data-filter-type="select">
    <option value=""${def ? '' : ' selected'}>${escapeHtml(placeholder || '全部')}</option>
    ${opts}
  </select>
</div>`
  }

  function renderNumberMin(
    label: string,
    id: string,
    presets: Array<string | number> | undefined
  ): string {
    return renderSelect(label, id, presets, '全部')
  }

  function renderText(label: string, id: string, placeholder?: string): string {
    const displayLabel = resolveFilterLabel(id, label)
    const ph = placeholder || `搜索 ${displayLabel}…`
    return `
<div class="filter-group">
  <label for="detail-filter-${escapeHtml(id)}">${escapeHtml(displayLabel)}</label>
  <input class="filter-control" type="text" id="detail-filter-${escapeHtml(id)}" data-filter-id="${escapeHtml(id)}" data-filter-type="text" placeholder="${escapeHtml(ph)}">
</div>`
  }

  const dims = section.dimensions
  let body = ''

  if (dims && dims.length > 0) {
    body = dims
      .map((d) => {
        const t = d.type || 'select'
        if (t === 'text') return renderText(d.label, d.id, d.placeholder)
        if (t === 'number_min') return renderNumberMin(d.label, d.id, d.presets || d.values)
        return renderSelect(d.label, d.id, d.values, d.placeholder || '全部', d.default_value)
      })
      .join('')
  } else {
    // 旧版兼容：游戏资产字段
    const filters = section.filters
    if (!filters) return ''
    const reuseStatusOpts = (filters.reuse_status || [])
      .map(
        (v) =>
          `<option value="${v}">${
            (
              {
                unlinked: '未关联场景',
                single: '单场景使用',
                low: '低复用 (≤1)',
                reused: '已复用 (≥2)',
                high: '高复用 (≥5)',
              } as Record<string, string>
            )[v] || v
          }</option>`
      )
      .join('')
    const reuseHtml = reuseStatusOpts
      ? `
<div class="filter-group">
  <label for="detail-filter-reuse_status">复用状态</label>
  <select class="filter-control" id="detail-filter-reuse_status" data-filter-id="reuse_status" data-filter-type="reuse_status">
    <option value="">全部状态</option>
    ${reuseStatusOpts}
  </select>
</div>`
      : ''
    const pathSearch = section.path_search_placeholder
      ? renderText('路径搜索', 'path', section.path_search_placeholder)
      : ''
    body = [
      renderSelect('资源类型', 'fcat', filters.fcat),
      renderSelect('业务模块', 'module', filters.module),
      renderSelect('资产归属', 'owner', filters.owner),
      renderSelect('文件后缀', 'ext', filters.ext),
      renderSelect('最小体积', 'min_bytes', filters.min_bytes?.map(String), '全部'),
      reuseHtml,
      pathSearch,
    ].join('')
  }

  return `
<div class="filters-section" id="detail-filters">
  <h3>${escapeHtml(section.title || '筛选条件')}</h3>
  ${body}
  <div class="filter-chips" id="detail-filter-chips"></div>
  <div class="filter-actions">
    <button class="btn" id="detail-clear-filters" type="button">清除筛选</button>
  </div>
</div>`
}

/** Sidebar HTML（brand + view-nav + data-status + optional filter panel） */
function buildSidebar(
  title: string,
  viewCount: number,
  viewLabels: Array<{ id: string; label: string }>,
  filterPanelContent?: string
): string {
  const navItems =
    viewCount > 1
      ? viewLabels
          .map(
            (v, i) =>
              `<button type="button" class="nav-item${i === 0 ? ' active' : ''}" data-go-view="${escapeHtml(v.id)}">${escapeHtml(v.label)}</button>`
          )
          .join('')
      : ''
  const navListHtml = navItems
    ? `<div class="sidebar-section"><h3>视图</h3><div class="nav-list">${navItems}</div></div>`
    : ''
  const filterHtml = filterPanelContent
    ? `<div class="sidebar-section filter-section" id="filter-section">${filterPanelContent}</div>`
    : ''
  const aiNavHtml = `<div class="sidebar-section" id="ai-live-nav-section" style="display:none"><h3>AI 视图</h3><div class="nav-list" id="ai-live-nav"></div></div>`
  return `
<aside class="sidebar">
  <div class="brand">
    <h1>📊 ${escapeHtml(title)}</h1>
    <div class="subtitle">CSV 数据看板 ・ TAgent</div>
    <div class="data-status">
      <span class="dot ready"></span>看板已生成
    </div>
  </div>
  ${navListHtml}
  ${aiNavHtml}
  ${filterHtml}
  <div class="sidebar-section" style="margin-top:auto;font-size:10px;color:var(--text-muted);line-height:1.6;">
    <p>点击左侧视图切换 Tab</p>
    <p>所有数据来自 SQLite 实时查询</p>
  </div>
</aside>`
}
function buildTopbar(
  title: string,
  views: Array<{ id: string; label: string }>,
  totalViewCount: number
): string {
  const tabsHtml =
    totalViewCount > 1
      ? `<div class="nav-tabs">${views
          .map(
            (v, i) =>
              `<button type="button" data-view="${escapeHtml(v.id)}"${i === 0 ? ' class="active"' : ''}>${escapeHtml(v.label)}</button>`
          )
          .join('')}</div>`
      : ''
  return `
<div class="topbar">
  <h2>${escapeHtml(title)}</h2>
</div>
${tabsHtml}
<div class="nav-tabs nav-tabs-ai" id="ai-live-tabs" style="display:none"></div>
<div class="drill-bar" id="drill-bar" aria-live="polite">
  <span class="drill-label">当前钻取</span>
  <span id="drill-chips"></span>
  <button type="button" class="drill-clear" id="drill-clear">清除钻取</button>
</div>
`
}

/** 内联 styles + scripts 全部组装
 *
 * @param title 看板标题
 * @param sections sections 数组
 * @param views 可选：多视图信息（id + label）。不传则单视图。
 * @param filterPanelHtml 可选：sidebar 内的过滤面板 HTML（仅 detail 视图显示）
 */
function buildDashboardHtml(
  title: string,
  sections: DashboardSectionV2[],
  views?: Array<{ id: string; label: string }>,
  filterPanelHtml?: string
): string {
  const css = buildBaseCss()
  const viewList = views && views.length > 0 ? views : [{ id: 'overview', label: '总览' }]
  const viewCount = viewList.length
  const sidebarContent = filterPanelHtml || ''
  const sidebar = buildSidebar(title, viewCount, viewList, sidebarContent)
  const topbar = buildTopbar(title, viewList, viewCount)
  const sectionsHtml = renderViewSections(sections, `chart-${viewList[0]?.id || 'overview'}`)
  const js = buildBaseJs(
    viewCount,
    sections.some((s) => s.type === 'filter_bar')
  )

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${buildChartJsTag()}
  <style>${css}</style>
</head>
<body>
  <div class="app">
    ${sidebar}
    <main class="main">
      ${topbar}
      <div class="view active" id="view-${viewList[0]?.id || 'overview'}">${sectionsHtml}</div>
    </main>
  </div>
  ${buildTipModalHtml()}
  <script>${js}</script>
</body>
</html>`
}

/** 一次性构建多视图看板的完整 HTML
 *
 * @param title 看板标题
 * @param views views 元数据（id + label + sections）
 * @param defaultFilterPanel 侧栏过滤面板 HTML（detail 视图用）
 * @param presetFilterConfig 预设过滤配置（filters_config）
 */
function buildMultiViewDashboardHtml(
  title: string,
  views: Array<{ id: string; label: string; sections: DashboardSectionV2[] }>,
  defaultFilterPanel?: string,
  byteUnit: ByteUnit = 'auto'
): string {
  const viewMeta = views.map((v) => ({ id: v.id, label: v.label }))
  const css = buildBaseCss()
  const sidebarContent = defaultFilterPanel || ''
  const sidebar = buildSidebar(title, views.length, viewMeta, sidebarContent)
  const topbar = buildTopbar(title, viewMeta, views.length)
  const viewsHtml = views
    .map(
      (v, i) => `
<div class="view${i === 0 ? ' active' : ''}" id="view-${v.id}">
  ${renderViewSections(v.sections, `chart-${v.id}`)}
</div>`
    )
    .join('')
  const hasFilterBar = views.some((v) => v.sections.some((s) => s.type === 'filter_bar'))
  const js = buildBaseJs(views.length, hasFilterBar)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${buildChartJsTag()}
  <style>${css}</style>
</head>
<body data-byte-unit="${escapeHtml(byteUnit)}">
  <div class="app">
    ${sidebar}
    <main class="main">
      ${topbar}
      ${viewsHtml}
      <div id="ai-live-views"></div>
    </main>
  </div>
  ${buildTipModalHtml()}
  <script>${js}</script>
</body>
</html>`
}

function buildNavHtml(viewId: string, label: string): string {
  return `<button type="button" class="nav-item" data-go-view="${escapeHtml(viewId)}">${escapeHtml(label)}</button>`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 统计 HTML 中已有 view 数量（用于 tab 软上限） */
function countViewsInHtml(html: string): number {
  const matches = html.match(/<div id="view-[^"]+" class="view/g)
  return matches ? matches.length : 0
}

/** add_view / replace_view 写盘后：把指定 view 设为默认激活（顶栏 tab + 侧栏 + 内容区） */
function setActiveViewInHtml(html: string, viewId: string): string {
  const vid = escapeRegExp(viewId)
  let next = html

  next = next.replace(/class="view active"/g, 'class="view"')
  next = next.replace(new RegExp(`(<div id="view-${vid}" class="view")`), '$1 active')

  next = next.replace(/(<button type="button" data-view="[^"]+") class="active"/g, '$1')
  next = next.replace(new RegExp(`(<button type="button" data-view="${vid}")`), '$1 class="active"')

  next = next.replace(/class="nav-item active"/g, 'class="nav-item"')
  next = next.replace(
    new RegExp(`class="nav-item" data-go-view="${vid}"`),
    `class="nav-item active" data-go-view="${viewId}"`
  )

  return next
}

/** 把新增视图拼进已有看板：在 </main> 前插入 <div id="view-X" class="view">...</div>；同时在 sidebar 加导航项 */
function injectViewIntoHtml(
  html: string,
  viewId: string,
  label: string,
  sectionsHtml: string
): string {
  const viewSection = `<div id="view-${viewId}" class="view">${sectionsHtml}</div>`
  let next = html.replace('</main>', `${viewSection}\n</main>`)
  // 在 sidebar .nav-list 末尾插入新导航项（若 sidebar 已存在）
  const navListMatch = next.match(/<div class="nav-list">([\s\S]*?)<\/div>/)
  if (navListMatch) {
    const newNavItem = buildNavHtml(viewId, label)
    const updated = `<div class="nav-list">${navListMatch[1] || ''}${newNavItem}</div>`
    next = next.replace(navListMatch[0], updated)
  }
  // 重建 nav-tabs（多视图）
  // 检测顶部是否有 .nav-tabs；若有则添加新 button，否则插入一个 .nav-tabs
  const tabsMatch = next.match(/<div class="nav-tabs">([\s\S]*?)<\/div>/)
  const newTabBtn = `<button type="button" data-view="${escapeHtml(viewId)}">${escapeHtml(label)}</button>`
  if (tabsMatch) {
    const updated = `<div class="nav-tabs">${tabsMatch[1] || ''}${newTabBtn}</div>`
    next = next.replace(tabsMatch[0], updated)
  } else {
    // 在 <main class="main"> 后插入 nav-tabs
    next = next.replace(/<main class="main">([\s\S]*?)<\/main>/, (_full, inner) => {
      return `<main class="main"><div class="nav-tabs">${newTabBtn}</div>${inner}</main>`
    })
    next = next.replace(
      /<div class="nav-tabs">([\s\S]*?)<\/div>([\s\S]*?<div id="view-)/,
      (_full, _tabs, rest) => {
        return `<div class="nav-tabs">${_tabs}</div>${rest}`
      }
    )
  }
  return setActiveViewInHtml(next, viewId)
}

// ===== meta.json 管理 =====

interface DashboardMeta {
  generated_views: Array<{ view_id: string; generated_at: string }>
  /** 展示偏好（改单位等走 patch，持久化后下次 create/patch 复用） */
  display?: {
    byte_unit?: ByteUnit
    title?: string
  }
}

function readDashboardMeta(sessionId: string): DashboardMeta {
  const metaPath = getMetaPath(sessionId)
  if (!fs.existsSync(metaPath)) return { generated_views: [] }
  try {
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as DashboardMeta
    const byteUnit = parseByteUnit(data.display?.byte_unit)
    return {
      generated_views: Array.isArray(data.generated_views) ? data.generated_views : [],
      display: {
        byte_unit: byteUnit,
        title: typeof data.display?.title === 'string' ? data.display.title : undefined,
      },
    }
  } catch {
    return { generated_views: [] }
  }
}

function writeDashboardMeta(sessionId: string, meta: DashboardMeta): void {
  fs.writeFileSync(getMetaPath(sessionId), JSON.stringify(meta, null, 2), 'utf-8')
}

function parseSectionsJson(raw: string | undefined, label: string): DashboardSectionV2[] {
  if (!raw) return []
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 数组`)
  }
  return parsed.map((s: Record<string, unknown>) => normalizeSection(s))
}

/** 抽出 filter_panel，放到侧栏；其余留在主区 */
function splitFilterPanel(sections: DashboardSectionV2[]): {
  main: DashboardSectionV2[]
  filterPanelHtml?: string
} {
  const panels = sections.filter((s) => s.type === 'filter_panel')
  const main = sections.filter((s) => s.type !== 'filter_panel')
  if (panels.length === 0) return { main }
  return { main, filterPanelHtml: panels.map((p) => renderFilterPanel(p)).join('\n') }
}

function needsLive(sections: DashboardSectionV2[]): boolean {
  return sections.some((s) => s.type === 'detail_table' && s.live === true)
}

interface ViewSpec {
  id: string
  label: string
  sections: DashboardSectionV2[]
}

function isTooSimpleDashboard(views: ViewSpec[]): boolean {
  if (views.length === 0) return true
  const hasDetail = views.some((v) => v.sections.some((s) => s.type === 'detail_table'))
  const hasCross =
    views.some((v) => v.id === 'cross') || views.some((v) => /交叉|cross|pivot/i.test(v.label))
  // 至少「有明细 +（有交叉或 ≥2 视图）」才算合格
  if (hasDetail && (hasCross || views.length >= 2)) return false
  if (views.length === 1 && !hasDetail) return true
  return !hasDetail
}

/** csv_query 参数误当作 section 的特征字段（无 type 时视为不合规） */
const QUERY_STYLE_KEYS = ['agg', 'groupby', 'sort', 'sort_dir', 'limit', 'having'] as const

function isCsvQueryFilterList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false
  const first = value[0]
  return !!first && typeof first === 'object' && 'column' in first && 'op' in first
}

/** 检测 agent 是否把 csv_query 参数直接塞进 sections JSON */
function isQueryStyleSectionRaw(raw: Record<string, unknown>): boolean {
  if (typeof raw.type === 'string' && raw.type.trim()) return false
  if (QUERY_STYLE_KEYS.some((k) => raw[k] !== undefined && raw[k] !== null && raw[k] !== '')) {
    return true
  }
  if (Array.isArray(raw.dimensions) && raw.dimensions.length > 0) return true
  if (isCsvQueryFilterList(raw.filters)) return true
  return false
}

function findQueryStyleInSectionsArray(sections: unknown[], label: string): string | null {
  if (!Array.isArray(sections)) return null
  for (let i = 0; i < sections.length; i++) {
    const item = sections[i]
    if (
      item &&
      typeof item === 'object' &&
      isQueryStyleSectionRaw(item as Record<string, unknown>)
    ) {
      return `${label}[${i}] 疑似 csv_query 参数（含 agg/groupby/dimensions/filters 等但缺少 type），不能直接塞进看板 sections`
    }
  }
  return null
}

function findQueryStyleInJsonString(raw: string | undefined, label: string): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return findQueryStyleInSectionsArray(parsed, label)
  } catch {
    return null
  }
}

/** 扫描 create 时所有手工 sections 入参，发现 query 风格即报错 */
function findQueryStyleInManualArgs(args: Record<string, unknown>): string | null {
  const sectionFields: Array<[string, string | undefined]> = [
    ['overview_json', args.overview_json as string | undefined],
    ['cross_json', args.cross_json as string | undefined],
    ['detail_json', args.detail_json as string | undefined],
    ['sections_json', args.sections_json as string | undefined],
    ['maps_json', args.maps_json as string | undefined],
    ['reuse_json', args.reuse_json as string | undefined],
    ['opportunity_json', args.opportunity_json as string | undefined],
  ]
  for (const [label, raw] of sectionFields) {
    const err = findQueryStyleInJsonString(raw, label)
    if (err) return err
  }
  const viewsJson = args.views_json as string | undefined
  if (viewsJson) {
    try {
      const parsed = JSON.parse(viewsJson) as Array<{ sections?: unknown }>
      if (Array.isArray(parsed)) {
        for (let vi = 0; vi < parsed.length; vi++) {
          const secs = parsed[vi]?.sections
          if (Array.isArray(secs)) {
            const err = findQueryStyleInSectionsArray(secs, `views_json[${vi}].sections`)
            if (err) return err
          }
        }
      }
    } catch {
      /* JSON 解析错误由 buildViewsFromArgs 抛出 */
    }
  }
  return null
}

function buildManualSectionsComplianceError(detail: string): string {
  return (
    `${detail}\n` +
    '正确做法：先用 csv_query 取数，再把结果填入合法 sections（每项必须有 type: stats|chart|table|detail_table|filter_panel 等），' +
    '已有看板时用 add_view 追加切片页；首次一键多维用 preset=auto。'
  )
}

function mapAutoViews(sessionId: string, byteUnit?: ByteUnit): ViewSpec[] {
  return buildAutoDashboardViews(sessionId, byteUnit ? { byteUnit } : undefined).map((v) => ({
    id: v.id,
    label: v.label,
    sections: v.sections.map((s) => normalizeSection(s as Record<string, unknown>)),
  }))
}

function resolveByteUnit(args: Record<string, unknown>, meta: DashboardMeta): ByteUnit {
  return parseByteUnit(args.byte_unit) ?? meta.display?.byte_unit ?? 'auto'
}

interface BuildViewsResult {
  views: ViewSpec[]
  /** 手工 sections 不合规（query 风格或过简），create 应拒绝写盘 */
  complianceError?: string
}

function buildViewsFromArgs(
  args: Record<string, unknown>,
  sessionId: string,
  byteUnit?: ByteUnit
): BuildViewsResult {
  const allowSimple = String(args.allow_simple ?? '').toLowerCase() === 'true'
  const queryStyleErr = findQueryStyleInManualArgs(args)
  if (queryStyleErr) {
    return { views: [], complianceError: buildManualSectionsComplianceError(queryStyleErr) }
  }

  const viewsJson = args.views_json as string | undefined
  if (viewsJson) {
    const parsed = JSON.parse(viewsJson) as Array<{ id: string; label?: string; sections: unknown }>
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('views_json 必须是非空数组')
    }
    const views = parsed.map((v) => ({
      id: v.id,
      label: v.label || v.id,
      sections: Array.isArray(v.sections)
        ? (v.sections as Record<string, unknown>[]).map((s) => normalizeSection(s))
        : [],
    }))
    // 硬拦截：缺明细的「假多维」不再静默降级 auto
    if (!allowSimple && isTooSimpleDashboard(views)) {
      console.warn('[CSV Dashboard] views_json 过于简单，拒绝 create')
      return {
        views: [],
        complianceError: buildManualSectionsComplianceError(
          'views_json 过于简单：缺少 detail_table(live:true) 或交叉分析视图'
        ),
      }
    }
    return { views }
  }

  const preset = (args.preset as string | undefined)?.toLowerCase()
  const hasManualSections = !!(
    args.overview_json ||
    args.cross_json ||
    args.detail_json ||
    args.sections_json
  )

  // preset=auto，或未指定内容时：自动从 SQLite 构建三视图
  if (preset === 'auto' || (!preset && !hasManualSections)) {
    return { views: mapAutoViews(sessionId, byteUnit) }
  }

  if (preset === 'standard' || preset === 'full') {
    const views: ViewSpec[] = []
    const overview = parseSectionsJson(args.overview_json as string | undefined, 'overview_json')
    if (overview.length > 0) views.push({ id: 'overview', label: '总览', sections: overview })

    if (preset === 'full') {
      const maps = parseSectionsJson(args.maps_json as string | undefined, 'maps_json')
      if (maps.length > 0) views.push({ id: 'maps', label: '地图分析', sections: maps })
      const reuse = parseSectionsJson(args.reuse_json as string | undefined, 'reuse_json')
      if (reuse.length > 0) views.push({ id: 'reuse', label: '复用分析', sections: reuse })
      const opportunity = parseSectionsJson(
        args.opportunity_json as string | undefined,
        'opportunity_json'
      )
      if (opportunity.length > 0)
        views.push({ id: 'opportunity', label: '优化机会', sections: opportunity })
    }

    const cross = parseSectionsJson(args.cross_json as string | undefined, 'cross_json')
    if (cross.length > 0) views.push({ id: 'cross', label: '交叉分析', sections: cross })

    const detail = parseSectionsJson(args.detail_json as string | undefined, 'detail_json')
    if (detail.length > 0) {
      const withLive = detail.map((s) =>
        s.type === 'detail_table' ? { ...s, live: s.live !== false } : s
      )
      views.push({ id: 'detail', label: '资源明细', sections: withLive })
    }

    if (views.length === 0 || (!allowSimple && isTooSimpleDashboard(views))) {
      console.warn('[CSV Dashboard] preset 手工 sections 不合规或过简，拒绝 create')
      return {
        views: [],
        complianceError: buildManualSectionsComplianceError(
          views.length === 0
            ? 'preset 手工 sections 为空'
            : 'preset 手工 sections 过于简单：缺少 detail_table(live:true) 或交叉分析视图'
        ),
      }
    }
    return { views }
  }

  // 旧路径：仅 sections_json → 缺明细则拒绝（不再静默升级 auto）
  const sections = parseSectionsJson(args.sections_json as string | undefined, 'sections_json')
  const simple: ViewSpec[] = [{ id: 'overview', label: '总览', sections }]
  if (!allowSimple && isTooSimpleDashboard(simple)) {
    console.warn('[CSV Dashboard] sections_json 仅为单页简图，拒绝 create')
    return {
      views: [],
      complianceError: buildManualSectionsComplianceError(
        'sections_json 过于简单：缺少 detail_table(live:true) 或交叉分析视图'
      ),
    }
  }
  return { views: simple }
}

// ===== 核心实现 =====

/** 统一成功返回 JSON 字段 */
interface DashboardSuccessPayload {
  status: 'ok'
  action: string
  session_id: string
  file_path: string
  title: string
  byte_unit: string
  views: string[]
  url?: string
  live?: boolean
  live_port?: number
  view_count?: number
  active_view?: string
  /** live_tab / slice 内存模式 */
  ephemeral?: boolean
  live_tabs?: string[]
  tab_id?: string
  label?: string
  ops: string
  hint?: string
}

function buildDashboardSuccessPayload(
  input: Omit<DashboardSuccessPayload, 'status' | 'ops'> & { hint?: string }
): string {
  const { hint, ...rest } = input
  return JSON.stringify({
    status: 'ok' as const,
    ...rest,
    ops: CSV_ARTIFACT_OPS_HINT,
    ...(hint ? { hint } : {}),
  })
}

function recordDashboardArtifact(
  context: CsvDashboardExecuteContext | undefined,
  payload: Omit<DashboardSuccessPayload, 'status' | 'ops'>
): void {
  if (!context?.agentSessionId) return
  try {
    recordCsvArtifact(context.agentSessionId, {
      csvSessionId: payload.session_id,
      title: payload.title,
      byte_unit: payload.byte_unit,
      views: payload.views,
      file_path: payload.file_path,
      last_action: payload.action,
    })
  } catch (error) {
    console.warn('[CSV Dashboard] 产物记忆写入失败:', error)
  }
}

/** 程序化 reload 时保留 AI Tab（避免刚写入就被 clear） */
function appendKeepLiveUrl(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set('keep_live', '1')
    return u.href
  } catch {
    const base = url.split('#')[0] ?? url
    const hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}keep_live=1${hash}`
  }
}

async function bootstrapDashboardIfMissing(
  sessionId: string,
  toolCall: ToolCall,
  context: CsvDashboardExecuteContext | undefined,
  args: Record<string, unknown>,
  dashboardPath: string
): Promise<ToolResult | null> {
  if (fs.existsSync(dashboardPath)) return null
  const bootstrapCall = {
    ...toolCall,
    arguments: {
      ...args,
      action: 'create',
      preset: 'auto',
      live: args.live ?? 'true',
      title: (args.title as string) || 'CSV 数据分析看板',
    },
  } as ToolCall
  const bootstrap = await executeCsvDashboard(bootstrapCall, context)
  return bootstrap.isError ? bootstrap : null
}

interface LiveTabBuildResult {
  tabId: string
  label: string
  sectionsHtml: string
  filterHtml?: string
  persistedViews: string[]
}

/** 构建并写入内存 live tab（不写 dashboard.html） */
async function buildAndStoreLiveTab(
  sessionId: string,
  args: Record<string, unknown>,
  byteUnit: ByteUnit,
  meta: ReturnType<typeof readDashboardMeta>
): Promise<LiveTabBuildResult> {
  const liveTabAction = String(args.live_tab_action ?? 'upsert').toLowerCase()

  if (liveTabAction === 'clear_all') {
    clearLiveTabs(sessionId)
    return {
      tabId: '',
      label: '',
      sectionsHtml: '',
      persistedViews: meta.generated_views.map((v) => v.view_id),
    }
  }

  const explicitTabId = (args.tab_id as string | undefined)?.trim()
  const removeId = explicitTabId || (args.view_id as string | undefined)?.trim()

  if (liveTabAction === 'remove') {
    if (!removeId) throw new Error('remove 需要 tab_id 或 view_id')
    removeLiveTab(sessionId, removeId)
    return {
      tabId: removeId,
      label: '',
      sectionsHtml: '',
      persistedViews: meta.generated_views.map((v) => v.view_id),
    }
  }

  let tabId: string
  let label: string
  let sectionsHtml: string
  let filterHtml: string | undefined

  if (args.sections_json) {
    const sections = parseSectionsJson(args.sections_json as string, 'sections_json')
    tabId = explicitTabId || (args.view_id as string) || `live-custom-${Date.now()}`
    label =
      (args.tab_label as string | undefined)?.trim() ||
      (args.label as string | undefined)?.trim() ||
      (args.view_label as string | undefined)?.trim() ||
      tabId
    const { main, filterPanelHtml } = splitFilterPanel(sections)
    sectionsHtml = renderViewSections(main, `chart-${tabId}`)
    filterHtml = filterPanelHtml
  } else {
    const resolved = resolveSliceTarget(sessionId, {
      filter_column: args.filter_column as string | undefined,
      filter_value: args.filter_value as string | undefined,
      label: (args.tab_label as string | undefined) || (args.label as string | undefined),
      slice_query: args.slice_query as string | undefined,
    })
    const built = buildSliceViewSections(sessionId, resolved, byteUnit)
    tabId = explicitTabId || built.viewId
    label =
      (args.tab_label as string | undefined)?.trim() ||
      (args.label as string | undefined)?.trim() ||
      built.label
    const { main, filterPanelHtml } = splitFilterPanel(built.sections as DashboardSectionV2[])
    sectionsHtml = renderViewSections(main, `chart-${tabId}`)
    filterHtml = filterPanelHtml
  }

  upsertLiveTab(sessionId, { id: tabId, label, sectionsHtml, filterHtml })

  return {
    tabId,
    label,
    sectionsHtml,
    filterHtml,
    persistedViews: meta.generated_views.map((v) => v.view_id),
  }
}

function successResult(
  toolCallId: string,
  context: CsvDashboardExecuteContext | undefined,
  payload: Omit<DashboardSuccessPayload, 'status' | 'ops'>
): ToolResult {
  recordDashboardArtifact(context, payload)
  return {
    toolCallId,
    content: buildDashboardSuccessPayload(payload),
  }
}

export async function executeCsvDashboard(
  toolCall: ToolCall,
  context?: CsvDashboardExecuteContext
): Promise<ToolResult> {
  try {
    const sessionId = toolCall.arguments.session_id as string | undefined
    let action = toolCall.arguments.action as string | undefined

    if (!sessionId) {
      return { toolCallId: toolCall.id, content: '参数缺失: session_id', isError: true }
    }
    if (!action) {
      return { toolCallId: toolCall.id, content: '参数缺失: action', isError: true }
    }

    const dashboardPath = getDashboardPath(sessionId)
    const meta = readDashboardMeta(sessionId)
    const liveFlag = String(toolCall.arguments.live ?? '').toLowerCase() === 'true'
    const args = toolCall.arguments as Record<string, unknown>
    const byteUnit = resolveByteUnit(args, meta)

    if (action === 'patch') {
      // 轻量改展示：不重读 CSV，只按已有 SQLite + 新单位重生成 auto 看板
      const { readCsvCacheMeta } = await import('./csv-shared')
      if (!readCsvCacheMeta(sessionId)) {
        return {
          toolCallId: toolCall.id,
          content: '无法 patch：尚未 csv_prepare。请先加载 CSV。',
          isError: true,
        }
      }

      const title =
        (typeof args.title === 'string' && args.title.trim()) ||
        meta.display?.title ||
        'CSV 数据分析看板'
      const views = mapAutoViews(sessionId, byteUnit)
      let sidebarFilter = ''
      const viewsForHtml = views.map((v) => {
        const { main, filterPanelHtml } = splitFilterPanel(v.sections)
        if (filterPanelHtml && (v.id === 'detail' || !sidebarFilter)) {
          sidebarFilter = filterPanelHtml
        }
        return { id: v.id, label: v.label, sections: main }
      })
      const html = buildMultiViewDashboardHtml(
        title,
        viewsForHtml,
        sidebarFilter || undefined,
        byteUnit
      )
      fs.writeFileSync(dashboardPath, html, 'utf-8')
      meta.generated_views = views.map((v) => ({
        view_id: v.id,
        generated_at: new Date().toISOString(),
      }))
      meta.display = { byte_unit: byteUnit, title }
      writeDashboardMeta(sessionId, meta)

      const { ensureCsvLiveServer } = await import('./csv-live-server')
      const live = await ensureCsvLiveServer(sessionId)
      if (!live.ok) {
        return {
          toolCallId: toolCall.id,
          content: `展示已更新但 live 服务失败: ${live.error ?? 'unknown'}。file_path=${dashboardPath}`,
          isError: true,
        }
      }
      return successResult(toolCall.id, context, {
        action: 'patch',
        file_path: dashboardPath,
        url: live.url,
        session_id: sessionId,
        live: true,
        live_port: live.port,
        title,
        byte_unit: byteUnit,
        view_count: views.length,
        views: views.map((v) => v.id),
        hint: '仅刷新展示，未重新 prepare CSV',
      })
    }

    if (action === 'create') {
      const title = (toolCall.arguments.title as string) || 'CSV 数据分析看板'
      const hasExistingDashboard = fs.existsSync(dashboardPath)
      let views: ViewSpec[]
      try {
        const built = buildViewsFromArgs(args, sessionId, byteUnit)
        if (built.complianceError) {
          const preserveNote = hasExistingDashboard ? '\n已有 dashboard.html 未被覆盖。' : ''
          return {
            toolCallId: toolCall.id,
            content: built.complianceError + preserveNote,
            isError: true,
          }
        }
        views = built.views
      } catch (e) {
        return {
          toolCallId: toolCall.id,
          content: e instanceof Error ? e.message : String(e),
          isError: true,
        }
      }

      // 校验
      for (const view of views) {
        for (let i = 0; i < view.sections.length; i++) {
          const s = view.sections[i]!
          if (!s.type) {
            return {
              toolCallId: toolCall.id,
              content: `view=${view.id} sections[${i}] 缺少 type`,
              isError: true,
            }
          }
          if (s.type === 'chart' && !s.data) {
            return {
              toolCallId: toolCall.id,
              content: `view=${view.id} sections[${i}] chart 缺少 data`,
              isError: true,
            }
          }
          if (s.type === 'table' && (!s.columns || !s.rows)) {
            return {
              toolCallId: toolCall.id,
              content: `view=${view.id} sections[${i}] table 缺少 columns/rows`,
              isError: true,
            }
          }
          if (s.type === 'detail_table' && !s.columns) {
            return {
              toolCallId: toolCall.id,
              content: `view=${view.id} sections[${i}] detail_table 缺少 columns`,
              isError: true,
            }
          }
        }
      }

      // 合并侧栏 filter（优先 detail 视图的 filter_panel）
      let sidebarFilter = ''
      const viewsForHtml = views.map((v) => {
        const { main, filterPanelHtml } = splitFilterPanel(v.sections)
        if (filterPanelHtml && (v.id === 'detail' || !sidebarFilter)) {
          sidebarFilter = filterPanelHtml
        }
        return { id: v.id, label: v.label, sections: main }
      })

      const wantLive =
        liveFlag ||
        views.some((v) => needsLive(v.sections)) ||
        viewsForHtml.some((v) => needsLive(v.sections))

      const html = buildMultiViewDashboardHtml(
        title,
        viewsForHtml,
        sidebarFilter || undefined,
        byteUnit
      )
      fs.writeFileSync(dashboardPath, html, 'utf-8')

      meta.generated_views = views.map((v) => ({
        view_id: v.id,
        generated_at: new Date().toISOString(),
      }))
      meta.display = { byte_unit: byteUnit, title }
      writeDashboardMeta(sessionId, meta)

      let url = `file:///${dashboardPath.replace(/\\/g, '/')}`
      let livePort: number | undefined
      if (wantLive) {
        const { ensureCsvLiveServer } = await import('./csv-live-server')
        const live = await ensureCsvLiveServer(sessionId)
        if (!live.ok) {
          return {
            toolCallId: toolCall.id,
            content: `看板已写入但 live 服务启动失败: ${live.error ?? 'unknown'}。file_path=${dashboardPath}`,
            isError: true,
          }
        }
        url = live.url
        livePort = live.port
      }

      const defaultViewId = views[0]?.id ?? 'overview'
      const defaultViewLabel = views.find((v) => v.id === defaultViewId)?.label ?? '总览'
      return successResult(toolCall.id, context, {
        action: 'create',
        file_path: dashboardPath,
        url,
        session_id: sessionId,
        title,
        byte_unit: byteUnit,
        live: wantLive,
        live_port: livePort,
        view_count: views.length,
        views: views.map((v) => v.id),
        active_view: defaultViewId,
        hint: `已生成看板；默认显示「${defaultViewLabel}」页`,
      })
    }

    if (action === 'live_tab' || action === 'slice') {
      const { readCsvCacheMeta } = await import('./csv-shared')
      if (!readCsvCacheMeta(sessionId)) {
        return {
          toolCallId: toolCall.id,
          content: '无法执行：尚未 csv_prepare。请先加载 CSV。',
          isError: true,
        }
      }

      const persist = String(args.persist ?? '').toLowerCase() === 'true'
      if (action === 'slice' && persist) {
        // 显式 persist=true：走旧落盘 add_view / replace_view 路径
      } else {
        // slice 默认与 live_tab 等价：内存 AI Tab
        const bootstrapErr = await bootstrapDashboardIfMissing(
          sessionId,
          toolCall,
          context,
          args,
          dashboardPath
        )
        if (bootstrapErr) return bootstrapErr

        const liveTabAction = String(args.live_tab_action ?? 'upsert').toLowerCase()
        let built: LiveTabBuildResult
        try {
          built = await buildAndStoreLiveTab(sessionId, args, byteUnit, meta)
        } catch (e) {
          return {
            toolCallId: toolCall.id,
            content: e instanceof Error ? e.message : String(e),
            isError: true,
          }
        }

        const { ensureCsvLiveServer } = await import('./csv-live-server')
        const live = await ensureCsvLiveServer(sessionId)
        if (!live.ok) {
          return {
            toolCallId: toolCall.id,
            content: `AI Tab 已写入内存但 live 服务失败: ${live.error ?? 'unknown'}`,
            isError: true,
          }
        }

        const displayTitle = meta.display?.title || (args.title as string) || 'CSV 数据分析看板'
        const displayByteUnit = meta.display?.byte_unit ?? byteUnit
        const memoryTabs = listLiveTabs(sessionId).map((t) => t.id)
        const resolvedAction = action === 'slice' ? 'slice' : 'live_tab'

        if (liveTabAction === 'clear_all') {
          return successResult(toolCall.id, context, {
            action: resolvedAction,
            file_path: dashboardPath,
            url: appendKeepLiveUrl(live.url),
            session_id: sessionId,
            title: displayTitle,
            byte_unit: displayByteUnit,
            live: true,
            live_port: live.port,
            view_count: built.persistedViews.length,
            views: built.persistedViews,
            ephemeral: true,
            live_tabs: memoryTabs,
            hint: '已清空全部 AI 内存 Tab；刷新或退出 TAgent 后也会消失',
          })
        }

        if (liveTabAction === 'remove') {
          return successResult(toolCall.id, context, {
            action: resolvedAction,
            file_path: dashboardPath,
            url: appendKeepLiveUrl(live.url),
            session_id: sessionId,
            title: displayTitle,
            byte_unit: displayByteUnit,
            live: true,
            live_port: live.port,
            view_count: built.persistedViews.length,
            views: built.persistedViews,
            active_view: built.tabId,
            ephemeral: true,
            live_tabs: memoryTabs,
            hint: `已移除 AI Tab「${built.tabId}」`,
          })
        }

        return successResult(toolCall.id, context, {
          action: resolvedAction,
          file_path: dashboardPath,
          url: appendKeepLiveUrl(`${live.url}#view-${encodeURIComponent(built.tabId)}`),
          session_id: sessionId,
          title: displayTitle,
          byte_unit: displayByteUnit,
          live: true,
          live_port: live.port,
          view_count: built.persistedViews.length,
          views: built.persistedViews,
          active_view: built.tabId,
          tab_id: built.tabId,
          label: built.label,
          ephemeral: true,
          live_tabs: memoryTabs,
          hint:
            `已打开 AI 内存 Tab「${built.label}」；刷新预览或退出 TAgent 后消失。` +
            '改单位请用 patch；固化到看板请 slice(persist="true")',
        })
      }
    }

    if (action === 'slice') {
      const { readCsvCacheMeta } = await import('./csv-shared')
      if (!readCsvCacheMeta(sessionId)) {
        return {
          toolCallId: toolCall.id,
          content: '无法 slice：尚未 csv_prepare。请先加载 CSV。',
          isError: true,
        }
      }

      // persist=true：落盘 add_view / replace_view（旧行为）
      if (!fs.existsSync(dashboardPath)) {
        const bootstrapErr = await bootstrapDashboardIfMissing(
          sessionId,
          toolCall,
          context,
          args,
          dashboardPath
        )
        if (bootstrapErr) return bootstrapErr
      }

      let resolved
      let built
      try {
        resolved = resolveSliceTarget(sessionId, {
          filter_column: args.filter_column as string | undefined,
          filter_value: args.filter_value as string | undefined,
          label: args.label as string | undefined,
          slice_query: args.slice_query as string | undefined,
        })
        built = buildSliceViewSections(sessionId, resolved, byteUnit)
      } catch (e) {
        return {
          toolCallId: toolCall.id,
          content: e instanceof Error ? e.message : String(e),
          isError: true,
        }
      }

      const existingHtml = fs.readFileSync(dashboardPath, 'utf-8')
      const viewExists =
        meta.generated_views.some((v) => v.view_id === built.viewId) ||
        existingHtml.includes(`id="view-${built.viewId}"`)

      toolCall.arguments.view_id = built.viewId
      toolCall.arguments.view_label = built.label
      toolCall.arguments.sections_json = JSON.stringify(built.sections)
      action = viewExists ? 'replace_view' : 'add_view'
    }

    if (action === 'add_view' || action === 'replace_view') {
      const viewId = toolCall.arguments.view_id as string
      const viewLabel = (toolCall.arguments.view_label as string) || viewId
      const sectionsJson = toolCall.arguments.sections_json as string | undefined

      if (!viewId) {
        return { toolCallId: toolCall.id, content: '参数缺失: view_id', isError: true }
      }
      if (!fs.existsSync(dashboardPath)) {
        return {
          toolCallId: toolCall.id,
          content: '看板不存在。请先调用 csv_dashboard(action="create") 创建。',
          isError: true,
        }
      }

      let sections: DashboardSectionV2[] = []
      try {
        sections = parseSectionsJson(sectionsJson, 'sections_json')
      } catch (e) {
        return {
          toolCallId: toolCall.id,
          content: e instanceof Error ? e.message : String(e),
          isError: true,
        }
      }

      const { main, filterPanelHtml } = splitFilterPanel(sections)
      const sectionsHtml = renderViewSections(main, `chart-${viewId}`)

      let html = fs.readFileSync(dashboardPath, 'utf-8')

      if (action === 'add_view') {
        const viewCount = countViewsInHtml(html)
        if (viewCount >= MAX_DASHBOARD_VIEWS) {
          return {
            toolCallId: toolCall.id,
            content:
              `看板已有 ${viewCount} 个 tab，已达上限 ${MAX_DASHBOARD_VIEWS}。` +
              '请用 action="slice" 或 replace_view 更新同名 tab，勿无限 add_view。',
            isError: true,
          }
        }
        html = injectViewIntoHtml(html, viewId, viewLabel, sectionsHtml)
      } else {
        // 用标记边界替换整个 view，避免非贪婪正则截断嵌套 div
        const startMark = `<div id="view-${viewId}" class="view`
        const startIdx = html.indexOf(startMark)
        if (startIdx >= 0) {
          const afterStart = html.indexOf('>', startIdx)
          // 从 startIdx 起找匹配的闭合：按 class="view" 块扫描深度
          let depth = 0
          let i = startIdx
          let endIdx = -1
          while (i < html.length) {
            const nextOpen = html.indexOf('<div', i)
            const nextClose = html.indexOf('</div>', i)
            if (nextClose < 0) break
            if (nextOpen >= 0 && nextOpen < nextClose) {
              depth++
              i = nextOpen + 4
            } else {
              depth--
              i = nextClose + 6
              if (depth === 0) {
                endIdx = i
                break
              }
            }
          }
          if (endIdx > startIdx) {
            const activeClass = html.slice(startIdx, afterStart).includes('active') ? ' active' : ''
            const replacement = `<div id="view-${viewId}" class="view${activeClass}">${sectionsHtml}</div>`
            html = html.slice(0, startIdx) + replacement + html.slice(endIdx)
          } else {
            html = injectViewIntoHtml(html, viewId, viewLabel, sectionsHtml)
          }
        } else {
          html = injectViewIntoHtml(html, viewId, viewLabel, sectionsHtml)
        }
      }

      // 若有新 filter_panel，尝试写入侧栏 filter-section
      if (filterPanelHtml) {
        if (html.includes('id="filter-section"')) {
          html = html.replace(
            /<div class="sidebar-section filter-section" id="filter-section">[\s\S]*?<\/div>\s*<\/aside>/,
            `<div class="sidebar-section filter-section" id="filter-section">${filterPanelHtml}</div>\n</aside>`
          )
        } else {
          html = html.replace(
            '</aside>',
            `<div class="sidebar-section filter-section" id="filter-section">${filterPanelHtml}</div>\n</aside>`
          )
        }
      }

      html = setActiveViewInHtml(html, viewId)
      fs.writeFileSync(dashboardPath, html, 'utf-8')

      if (!meta.generated_views.some((v) => v.view_id === viewId)) {
        meta.generated_views.push({ view_id: viewId, generated_at: new Date().toISOString() })
      }
      writeDashboardMeta(sessionId, meta)

      const wantLive = liveFlag || needsLive(sections)
      let url = `file:///${dashboardPath.replace(/\\/g, '/')}`
      let livePort: number | undefined
      let liveActive = wantLive
      if (wantLive) {
        const { ensureCsvLiveServer } = await import('./csv-live-server')
        const live = await ensureCsvLiveServer(sessionId)
        if (!live.ok) {
          return {
            toolCallId: toolCall.id,
            content: `视图已写入但 live 服务启动失败: ${live.error ?? 'unknown'}。file_path=${dashboardPath}`,
            isError: true,
          }
        }
        url = live.url
        livePort = live.port
      } else {
        const { getCsvLiveServerUrl } = await import('./csv-live-server')
        const existingUrl = getCsvLiveServerUrl(sessionId)
        if (existingUrl) {
          url = existingUrl
          liveActive = true
        }
      }

      const displayTitle = meta.display?.title || 'CSV 数据分析看板'
      const displayByteUnit = meta.display?.byte_unit ?? byteUnit
      const viewIds = meta.generated_views.map((v) => v.view_id)

      return successResult(toolCall.id, context, {
        action: toolCall.arguments.action === 'slice' ? 'slice' : action,
        file_path: dashboardPath,
        url,
        session_id: sessionId,
        title: displayTitle,
        byte_unit: displayByteUnit,
        live: liveActive,
        live_port: livePort,
        view_count: viewIds.length,
        views: viewIds,
        active_view: viewId,
        hint:
          toolCall.arguments.action === 'slice'
            ? `已加入 tab「${viewLabel}」，预览应自动切到该页`
            : action === 'add_view'
              ? `已加入 tab「${viewLabel}」，预览应自动切到该页`
              : `已更新 tab「${viewLabel}」，预览应自动切到该页`,
      })
    }

    return {
      toolCallId: toolCall.id,
      content: `未知 action: ${action}。支持: create, slice, live_tab, add_view, replace_view, patch`,
      isError: true,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[CSV Dashboard] 执行失败:', error)
    return {
      toolCallId: toolCall.id,
      content: `看板生成失败: ${msg}`,
      isError: true,
    }
  }
}
