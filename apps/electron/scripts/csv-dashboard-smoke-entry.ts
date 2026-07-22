/**
 * 打包入口：供 esbuild 打成 cjs 后用 electron 跑
 */
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { executeCsvPrepare } from '../src/main/lib/tools/csv-prepare-tool'
import { executeCsvDashboard } from '../src/main/lib/tools/csv-dashboard-tool'
import { runCsvQuery } from '../src/main/lib/tools/csv-shared'
import { stopCsvLiveServer } from '../src/main/lib/tools/csv-live-server'

process.env.TAGENT_DEV = '1'

async function main() {
  const csvPath =
    process.env.CSV_SMOKE_PATH || path.join(os.homedir(), 'Downloads', '进包被引用资源.csv')
  if (!fs.existsSync(csvPath)) {
    console.error('[smoke] CSV 不存在:', csvPath)
    process.exit(1)
  }

  let targetCsv = csvPath
  if (process.env.CSV_SMOKE_FULL !== '1') {
    const samplePath = path.join(os.tmpdir(), `tagent-csv-smoke-sample-${Date.now()}.csv`)
    const fd = fs.openSync(csvPath, 'r')
    const buf = Buffer.alloc(8 * 1024 * 1024)
    const n = fs.readSync(fd, buf, 0, buf.length, 0)
    fs.closeSync(fd)
    const lines = buf.slice(0, n).toString('utf-8').split(/\r?\n/)
    fs.writeFileSync(samplePath, lines.slice(0, Math.min(lines.length, 5001)).join('\n'), 'utf-8')
    targetCsv = samplePath
    console.log('[smoke] 采样 ~5000 行；全量设 CSV_SMOKE_FULL=1')
  }

  const sessionId = `smoke-${Date.now()}`
  console.log('[smoke] csv=', targetCsv)

  const t0 = Date.now()
  const prepareResult = await executeCsvPrepare({
    id: 'p1',
    name: 'csv_prepare',
    arguments: { path: targetCsv, session_id: sessionId },
  } as never)
  if (prepareResult.isError) {
    console.error(prepareResult.content)
    process.exit(1)
  }
  const prep = JSON.parse(prepareResult.content)
  console.log('[smoke] prepare', { rows: prep.row_count, cols: prep.columns?.length, ms: Date.now() - t0 })

  const dims = (prep.columns || []).filter(
    (c: { role: string; unique_count?: number }) =>
      c.role === 'dimension' && (c.unique_count || 0) > 1 && (c.unique_count || 0) <= 80
  )
  if (dims.length >= 2) {
    const g = `${dims[0].sql_name || dims[0].name},${dims[1].sql_name || dims[1].name}`
    const metrics = (prep.columns || []).filter((c: { role: string }) => c.role === 'metric')
    const agg = metrics[0] ? `count,sum(${metrics[0].sql_name || metrics[0].name})` : 'count'
    const cross = runCsvQuery(sessionId, { groupby: g, agg, limit: 3 })
    console.log('[smoke] cross', cross.rows?.[0])
  }

  const dashResult = await executeCsvDashboard({
    id: 'd1',
    name: 'csv_dashboard',
    arguments: {
      session_id: sessionId,
      action: 'create',
      preset: 'auto',
      live: 'true',
      title: '冒烟看板',
    },
  } as never)
  if (dashResult.isError) {
    console.error(dashResult.content)
    process.exit(1)
  }
  const dash = JSON.parse(dashResult.content)
  const html = fs.readFileSync(dash.file_path, 'utf-8')
  const checks = {
    overview: html.includes('id="view-overview"'),
    cross: html.includes('id="view-cross"'),
    detail: html.includes('id="view-detail"'),
    heatmap: html.includes('heatmap-card'),
    liveTable: html.includes('live-detail-table'),
    drillBar: html.includes('id="drill-bar"'),
    chartInline: html.includes('cdn.jsdelivr.net/npm/chart.js') === false || html.length > 100000,
  }
  console.log('[smoke] dashboard', { views: dash.views, url: dash.url, checks })

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
    const body = (await res.json()) as { total_before_limit?: number }
    console.log('[smoke] live', body)
    if (!body.total_before_limit) process.exit(1)
  }

  stopCsvLiveServer(sessionId)
  console.log('[smoke] PASS')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
