/**
 * Electron 入口冒烟：验证 better-sqlite3 + CSV auto 看板
 * bunx electron scripts/csv-dashboard-smoke.cjs
 */
const path = require('path')
const fs = require('fs')
const os = require('os')
const { pathToFileURL } = require('url')

process.env.TAGENT_DEV = '1'

async function loadTs(rel) {
  // 通过 tsx 注册后可用动态 import 加载 .ts
  const abs = path.join(__dirname, rel)
  return import(pathToFileURL(abs).href)
}

async function main() {
  try {
    require('better-sqlite3')
    console.log('[smoke] better-sqlite3 ok, electron=', process.versions.electron)
  } catch (e) {
    console.error('[smoke] better-sqlite3 加载失败:', e.message)
    process.exit(1)
  }

  // 注册 tsx 以加载 TypeScript 源码
  try {
    require('tsx/cjs/api').register()
  } catch {
    try {
      require('tsx/cjs')
    } catch (e) {
      console.warn('[smoke] tsx 不可用，尝试直接 require 编译路径失败时请用 bunx tsx')
    }
  }

  const csvPath =
    process.env.CSV_SMOKE_PATH || path.join(os.homedir(), 'Downloads', '进包被引用资源.csv')
  if (!fs.existsSync(csvPath)) {
    console.error('[smoke] CSV 不存在:', csvPath)
    process.exit(1)
  }

  // 大文件全量 prepare 很慢：默认先用头部采样文件做结构验收；
  // 设 CSV_SMOKE_FULL=1 才跑全量
  let targetCsv = csvPath
  const full = process.env.CSV_SMOKE_FULL === '1'
  if (!full) {
    const samplePath = path.join(os.tmpdir(), `tagent-csv-smoke-sample-${Date.now()}.csv`)
    const fd = fs.openSync(csvPath, 'r')
    const buf = Buffer.alloc(8 * 1024 * 1024)
    const n = fs.readSync(fd, buf, 0, buf.length, 0)
    fs.closeSync(fd)
    let text = buf.slice(0, n).toString('utf-8')
    const lines = text.split(/\r?\n/)
    // 保留表头 + 最多 5000 行
    const keep = lines.slice(0, Math.min(lines.length, 5001)).join('\n')
    fs.writeFileSync(samplePath, keep, 'utf-8')
    targetCsv = samplePath
    console.log('[smoke] 使用采样 CSV（前 ~5000 行）。全量请设 CSV_SMOKE_FULL=1')
  }

  const sessionId = `smoke-${Date.now()}`
  console.log('[smoke] csv=', targetCsv, 'session=', sessionId)

  const prepareMod = require('../src/main/lib/tools/csv-prepare-tool.ts')
  const dashMod = require('../src/main/lib/tools/csv-dashboard-tool.ts')
  const sharedMod = require('../src/main/lib/tools/csv-shared.ts')
  const liveMod = require('../src/main/lib/tools/csv-live-server.ts')

  const t0 = Date.now()
  const prepareResult = await prepareMod.executeCsvPrepare({
    id: 'p1',
    name: 'csv_prepare',
    arguments: { path: targetCsv, session_id: sessionId },
  })
  if (prepareResult.isError) {
    console.error('[smoke] prepare 失败:', prepareResult.content)
    process.exit(1)
  }
  const prep = JSON.parse(prepareResult.content)
  console.log('[smoke] prepare', { rows: prep.row_count, cols: prep.columns?.length, ms: Date.now() - t0 })

  // 猜交叉列
  const dims = (prep.columns || []).filter((c) => c.role === 'dimension' && (c.unique_count || 0) > 1 && (c.unique_count || 0) <= 80)
  const metrics = (prep.columns || []).filter((c) => c.role === 'metric')
  console.log(
    '[smoke] dims=',
    dims.map((d) => d.sql_name || d.name),
    'metrics=',
    metrics.map((m) => m.sql_name || m.name)
  )

  if (dims.length >= 2) {
    const g = `${dims[0].sql_name || dims[0].name},${dims[1].sql_name || dims[1].name}`
    const metric = metrics[0] ? `count,sum(${metrics[0].sql_name || metrics[0].name})` : 'count'
    const cross = sharedMod.runCsvQuery(sessionId, { groupby: g, agg: metric, limit: 5 })
    console.log('[smoke] cross rows', cross.row_count, cross.rows?.[0])
  }

  const dashResult = await dashMod.executeCsvDashboard({
    id: 'd1',
    name: 'csv_dashboard',
    arguments: {
      session_id: sessionId,
      action: 'create',
      preset: 'auto',
      live: 'true',
      title: '冒烟看板',
    },
  })
  if (dashResult.isError) {
    console.error('[smoke] dashboard 失败:', dashResult.content)
    process.exit(1)
  }
  const dash = JSON.parse(dashResult.content)
  console.log('[smoke] dashboard', dash)

  const html = fs.readFileSync(dash.file_path, 'utf-8')
  const checks = {
    overview: html.includes('id="view-overview"'),
    cross: html.includes('id="view-cross"'),
    detail: html.includes('id="view-detail"'),
    heatmap: html.includes('heatmap-card') || html.includes('heatmap-table'),
    liveTable: html.includes('live-detail-table'),
    chartInline: /function Chart|Chart\.register|var Chart=/.test(html) || html.includes('Chart.js'),
    noCdnPreferred: !html.includes('cdn.jsdelivr.net/npm/chart.js') || html.includes('Chart'),
    drillBar: html.includes('id="drill-bar"'),
  }
  console.log('[smoke] checks', checks)
  const bad = Object.entries(checks).filter(([, v]) => !v)
  if (bad.length) {
    console.error('[smoke] FAIL', bad.map(([k]) => k))
    process.exit(1)
  }

  if (String(dash.url || '').startsWith('http')) {
    const res = await fetch(dash.url + 'api/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 3, offset: 0 }),
    })
    const body = await res.json()
    console.log('[smoke] live api', { total: body.total_before_limit, rows: body.row_count })
    if (!body.total_before_limit) {
      console.error('[smoke] live API 无数据')
      process.exit(1)
    }
  }

  liveMod.stopCsvLiveServer(sessionId)
  console.log('[smoke] PASS')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
