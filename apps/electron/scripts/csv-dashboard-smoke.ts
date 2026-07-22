/**
 * CSV 看板真机冒烟（需 Electron ABI 的 better-sqlite3）
 *
 * 用法（在 apps/electron 下）:
 *   bunx electron --import tsx scripts/csv-dashboard-smoke.ts
 * 或:
 *   bunx electron scripts/csv-dashboard-smoke.cjs
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

async function main() {
  process.env.TAGENT_DEV = '1'

  const csvPath =
    process.env.CSV_SMOKE_PATH ||
    path.join(os.homedir(), 'Downloads', '进包被引用资源.csv')

  if (!fs.existsSync(csvPath)) {
    console.error('[smoke] CSV 不存在:', csvPath)
    process.exit(1)
  }

  const sessionId = `smoke-${Date.now()}`
  console.log('[smoke] CSV:', csvPath)
  console.log('[smoke] session:', sessionId)

  const { executeCsvPrepare } = await import('../src/main/lib/tools/csv-prepare-tool')
  const { executeCsvDashboard } = await import('../src/main/lib/tools/csv-dashboard-tool')
  const { runCsvQuery } = await import('../src/main/lib/tools/csv-shared')
  const { stopCsvLiveServer } = await import('../src/main/lib/tools/csv-live-server')

  const t0 = Date.now()
  const prepareResult = await executeCsvPrepare({
    id: 'p1',
    name: 'csv_prepare',
    arguments: { path: csvPath, session_id: sessionId },
  } as never)
  if (prepareResult.isError) {
    console.error('[smoke] prepare 失败:', prepareResult.content)
    process.exit(1)
  }
  const prep = JSON.parse(prepareResult.content)
  console.log('[smoke] prepare ok', {
    rows: prep.row_count,
    cols: (prep.columns || []).length,
    ms: Date.now() - t0,
    from_cache: prep.from_cache,
  })

  const cross = runCsvQuery(sessionId, {
    groupby: 'fcat,module',
    agg: 'count,sum(compress)',
    sort: 'sum_compress',
    sort_dir: 'desc',
    limit: 5,
  })
  console.log('[smoke] cross sample:', cross.rows.slice(0, 3))

  const dashResult = await executeCsvDashboard({
    id: 'd1',
    name: 'csv_dashboard',
    arguments: {
      session_id: sessionId,
      action: 'create',
      preset: 'auto',
      live: 'true',
      title: '进包资源冒烟看板',
    },
  } as never)
  if (dashResult.isError) {
    console.error('[smoke] dashboard 失败:', dashResult.content)
    process.exit(1)
  }
  const dash = JSON.parse(dashResult.content)
  console.log('[smoke] dashboard:', {
    views: dash.views,
    live: dash.live,
    url: dash.url,
  })

  const html = fs.readFileSync(dash.file_path, 'utf-8')
  const checks = {
    overview: html.includes('id="view-overview"'),
    cross: html.includes('id="view-cross"'),
    detail: html.includes('id="view-detail"'),
    heatmap: html.includes('heatmap-table') || html.includes('heatmap-card'),
    liveTable: html.includes('live-detail-table'),
    chartJsInline: html.includes('Chart') && !html.includes('cdn.jsdelivr.net/npm/chart.js'),
    drillBar: html.includes('id="drill-bar"'),
  }
  console.log('[smoke] html checks:', checks)

  const failed = Object.entries(checks).filter(([, ok]) => !ok)
  if (failed.length) {
    console.error('[smoke] 失败项:', failed.map(([k]) => k))
    process.exit(1)
  }

  if (dash.url && String(dash.url).startsWith('http')) {
    const res = await fetch(`${dash.url}api/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: [{ column: 'fcat', op: '=', value: '贴图' }],
        select: 'path,fcat,module,compress',
        limit: 5,
        offset: 0,
      }),
    })
    const body = (await res.json()) as { total_before_limit?: number; row_count?: number; error?: string }
    console.log('[smoke] live /api/rows:', body)
    if (body.error || !(body.total_before_limit! > 0)) {
      console.error('[smoke] live API 异常')
      process.exit(1)
    }
  }

  stopCsvLiveServer(sessionId)
  console.log('[smoke] PASS')
  process.exit(0)
}

main().catch((e) => {
  console.error('[smoke] 异常', e)
  process.exit(1)
})
