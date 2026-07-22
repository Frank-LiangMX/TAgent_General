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

// ===== 工具元数据 =====

export const CSV_DASHBOARD_TOOL_META: ChatToolMeta = {
  id: 'csv-dashboard',
  name: 'CSV 数据看板',
  description: '生成交互式 HTML 数据看板（图表 + 可排序表格）',
  params: [
    { name: 'session_id', type: 'string', description: '会话 ID', required: true },
    { name: 'action', type: 'string', description: '操作: create / add_view / replace_view', required: true },
    { name: 'title', type: 'string', description: '看板标题' },
    { name: 'view_id', type: 'string', description: '视图 ID' },
    { name: 'view_label', type: 'string', description: '视图显示名' },
    { name: 'sections_json', type: 'string', description: '视图 sections 配置 JSON 数组' },
  ],
  icon: 'LayoutDashboard',
  category: 'builtin',
  executorType: 'builtin',
  systemPromptAppend: `
<csv_dashboard_instructions>
你拥有 CSV 数据看板生成能力。

**csv_dashboard — 生成看板：**
将查询结果生成交互式 HTML 看板，包含图表和可排序表格。

看板是完整的 HTML 文件，浏览器打开即可使用。
</csv_dashboard_instructions>`,
}

// ===== 工具定义 =====

export const CSV_DASHBOARD_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'csv_dashboard',
    description:
      'Generate an interactive HTML dashboard with charts and sortable tables from CSV data.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID' },
        action: {
          type: 'string',
          description: 'Action: create (new dashboard), add_view (append view), replace_view (replace view)',
        },
        title: { type: 'string', description: 'Dashboard title' },
        view_id: { type: 'string', description: 'View ID for add_view/replace_view' },
        view_label: { type: 'string', description: 'View display name' },
        sections_json: {
          type: 'string',
          description: 'JSON array of sections config',
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
  const base = path.join(os.tmpdir(), 'TAgent', 'csv-cache', sessionId)
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

// ===== HTML 生成 =====

function renderStatsSection(section: DashboardSection): string {
  const data = section.data as Record<string, string | number>
  const items = Object.entries(data)
    .map(
      ([key, value]) =>
        `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${key}</div></div>`
    )
    .join('\n')
  return `<div class="stats-grid">${items}</div>`
}

function renderChartSection(section: DashboardSection, index: number): string {
  const chartId = `chart-${index}`
  const chartType = section.chart_type || 'pie'
  const data = section.data

  // 准备 Chart.js 数据
  let chartData: string
  if (chartType === 'pie' || chartType === 'horizontal_bar') {
    const entries = Object.entries(data as Record<string, number>)
    chartData = `{
      labels: ${JSON.stringify(entries.map(([k]) => k))},
      datasets: [{ data: ${JSON.stringify(entries.map(([, v]) => v))} }]
    }`
  } else {
    const items = data as Array<Record<string, unknown>>
    chartData = `{
      labels: ${JSON.stringify(items.map((item) => item.name || item.label || ''))},
      datasets: [{ data: ${JSON.stringify(items.map((item) => item.value || item.count || 0))} }]
    }`
  }

  return `
    <div class="chart-card">
      <h3>${section.title || ''}</h3>
      <div class="chart-container"><canvas id="${chartId}"></canvas></div>
      <script>
        new Chart(document.getElementById('${chartId}'), {
          type: '${chartType === 'horizontal_bar' ? 'bar' : chartType}',
          data: ${chartData},
          options: ${
            chartType === 'horizontal_bar'
              ? '{ indexAxis: "y", plugins: { legend: { display: false } } }'
              : '{ plugins: { legend: { position: "bottom" } } }'
          }
        });
      </script>
    </div>`
}

function renderTableSection(section: DashboardSection, index: number): string {
  const tableId = `table-${index}`
  const columns = section.columns || []
  const rows = section.rows || []
  const pageSize = section.page_size || 20

  const headerHtml = columns.map((col) => `<th data-col="${col}">${col}</th>`).join('')
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${columns.map((col) => `<td>${row[col] ?? ''}</td>`).join('')}</tr>`
    )
    .join('')

  return `
    <div class="table-card" id="${tableId}">
      <h3>${section.title || ''}</h3>
      <div class="table-scroll">
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
      ${
        section.paginated
          ? `<div class="pager">
              <button onclick="paginate('${tableId}', -${pageSize})">上一页</button>
              <span class="page-info"></span>
              <button onclick="paginate('${tableId}', ${pageSize})">下一页</button>
            </div>`
          : ''
      }
    </div>`
}

function renderSection(section: DashboardSection, index: number): string {
  switch (section.type) {
    case 'stats':
      return renderStatsSection(section)
    case 'chart':
      return renderChartSection(section, index)
    case 'table':
      return renderTableSection(section, index)
    default:
      return ''
  }
}

function buildDashboardHtml(title: string, sections: DashboardSection[]): string {
  const sectionsHtml = sections.map((s, i) => renderSection(s, i)).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #f8fafc; --surface: #ffffff; --border: #e2e8f0;
      --text: #1e293b; --text-muted: #64748b;
      --primary: #6366f1; --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh;
    }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 700; color: var(--primary); font-family: monospace; }
    .stat-label { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
    .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
    .chart-card h3 { font-size: 13px; font-weight: 600; margin-bottom: 12px; }
    .chart-container { position: relative; height: 280px; }
    .table-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 16px; }
    .table-card h3 { font-size: 13px; font-weight: 600; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .table-scroll { overflow-x: auto; max-height: 480px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { position: sticky; top: 0; background: var(--bg); padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); cursor: pointer; user-select: none; }
    td { padding: 8px 14px; border-bottom: 1px solid var(--border); }
    tbody tr:hover { background: rgba(99,102,241,0.04); }
    .pager { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--border); }
    .pager button { padding: 5px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); font-size: 11px; cursor: pointer; }
    .pager button:hover { background: var(--bg); }
    .page-info { font-size: 11px; color: var(--text-muted); }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${sectionsHtml}
  <script>
    // 表格排序
    document.querySelectorAll('table th').forEach(th => {
      th.addEventListener('click', () => {
        const table = th.closest('table');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const col = th.dataset.col;
        const idx = Array.from(th.parentNode.children).indexOf(th);
        const asc = th.dataset.dir !== 'asc';
        th.dataset.dir = asc ? 'asc' : 'desc';
        rows.sort((a, b) => {
          const va = a.children[idx]?.textContent || '';
          const vb = b.children[idx]?.textContent || '';
          const na = parseFloat(va), nb = parseFloat(vb);
          if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
          return asc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
    // 分页
    window.paginate = function(tableId, delta) {
      const table = document.getElementById(tableId);
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const info = table.querySelector('.page-info');
      const currentPage = parseInt(info.dataset.page || '0');
      const pageSize = 20;
      const totalPages = Math.ceil(rows.length / pageSize);
      const newPage = Math.max(0, Math.min(totalPages - 1, currentPage + (delta > 0 ? 1 : -1)));
      info.dataset.page = newPage;
      rows.forEach((r, i) => {
        r.style.display = (i >= newPage * pageSize && i < (newPage + 1) * pageSize) ? '' : 'none';
      });
      info.textContent = (newPage + 1) + ' / ' + totalPages;
    };
    // 初始化分页
    document.querySelectorAll('.table-card').forEach(card => {
      const info = card.querySelector('.page-info');
      if (info) { info.dataset.page = '0'; info.textContent = '1 / 1'; }
    });
  </script>
</body>
</html>`
}

function buildNavHtml(viewId: string, label: string): string {
  return `<div class="nav-item" data-view="${viewId}">${label}</div>`
}

function injectViewIntoHtml(html: string, viewId: string, label: string, sectionsHtml: string): string {
  // 在 </body> 前插入视图
  const viewSection = `<section id="view-${viewId}" class="view-section" style="display:none">${sectionsHtml}</section>`
  return html.replace('</body>', `${viewSection}\n</body>`)
}

// ===== meta.json 管理 =====

interface DashboardMeta {
  generated_views: Array<{ view_id: string; generated_at: string }>
}

function readDashboardMeta(sessionId: string): DashboardMeta {
  const metaPath = getMetaPath(sessionId)
  if (!fs.existsSync(metaPath)) return { generated_views: [] }
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  } catch {
    return { generated_views: [] }
  }
}

function writeDashboardMeta(sessionId: string, meta: DashboardMeta): void {
  fs.writeFileSync(getMetaPath(sessionId), JSON.stringify(meta, null, 2), 'utf-8')
}

// ===== 核心实现 =====

export function executeCsvDashboard(toolCall: ToolCall): ToolResult {
  try {
    const sessionId = toolCall.arguments.session_id as string | undefined
    const action = toolCall.arguments.action as string | undefined

    if (!sessionId) {
      return { toolCallId: toolCall.id, content: '参数缺失: session_id', isError: true }
    }
    if (!action) {
      return { toolCallId: toolCall.id, content: '参数缺失: action', isError: true }
    }

    const dashboardPath = getDashboardPath(sessionId)
    const meta = readDashboardMeta(sessionId)

    if (action === 'create') {
      const title = (toolCall.arguments.title as string) || 'CSV 数据分析看板'
      const sectionsJson = toolCall.arguments.sections_json as string | undefined
      const sections: DashboardSection[] = sectionsJson ? JSON.parse(sectionsJson) : []

      const html = buildDashboardHtml(title, sections)
      fs.writeFileSync(dashboardPath, html, 'utf-8')

      // 记录已生成视图
      meta.generated_views.push({ view_id: 'overview', generated_at: new Date().toISOString() })
      writeDashboardMeta(sessionId, meta)

      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          status: 'ok',
          file_path: dashboardPath,
          url: `file:///${dashboardPath.replace(/\\/g, '/')}`,
          view_count: 1,
        }),
      }
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

      const sections: DashboardSection[] = sectionsJson ? JSON.parse(sectionsJson) : []
      const sectionsHtml = sections.map((s, i) => renderSection(s, i)).join('\n')

      if (action === 'add_view') {
        let html = fs.readFileSync(dashboardPath, 'utf-8')
        html = injectViewIntoHtml(html, viewId, viewLabel, sectionsHtml)
        fs.writeFileSync(dashboardPath, html, 'utf-8')
      } else {
        // replace_view: 替换现有视图
        let html = fs.readFileSync(dashboardPath, 'utf-8')
        const regex = new RegExp(`<section id="view-${viewId}"[^>]*>[\\s\\S]*?</section>`)
        const replacement = `<section id="view-${viewId}" class="view-section" style="display:none">${sectionsHtml}</section>`
        if (regex.test(html)) {
          html = html.replace(regex, replacement)
        } else {
          html = injectViewIntoHtml(html, viewId, viewLabel, sectionsHtml)
        }
        fs.writeFileSync(dashboardPath, html, 'utf-8')
      }

      // 更新 meta
      if (!meta.generated_views.some((v) => v.view_id === viewId)) {
        meta.generated_views.push({ view_id: viewId, generated_at: new Date().toISOString() })
      }
      writeDashboardMeta(sessionId, meta)

      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          status: 'ok',
          file_path: dashboardPath,
          url: `file:///${dashboardPath.replace(/\\/g, '/')}`,
          view_count: meta.generated_views.length,
        }),
      }
    }

    return {
      toolCallId: toolCall.id,
      content: `未知 action: ${action}。支持: create, add_view, replace_view`,
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
