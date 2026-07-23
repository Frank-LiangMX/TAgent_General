/**
 * CSV 共享查询层 / 多列 groupby / 看板 preset 测试
 *
 * 纯逻辑测试始终可跑；依赖 better-sqlite3 的集成测试在本地 Electron ABI
 * 下可能 skip（与 kanban-db.test 同策略，CI Node ABI 下全量跑）。
 */

import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  parseGroupByColumns,
  sanitizeColumnName,
  buildWhereClause,
  buildAggSelect,
  getCsvCacheRoot,
  runCsvQuery,
} from './csv-shared'
import { executeCsvDashboard } from './csv-dashboard-tool'
import { stopCsvLiveServer } from './csv-live-server'
import type { ToolCall } from '@tagent/core'

describe('csv-shared 纯逻辑', () => {
  test('sanitizeColumnName', () => {
    expect(sanitizeColumnName('fcat')).toBe('fcat')
    expect(sanitizeColumnName('foo-bar')).toBe('foo_bar')
  })

  test('parseGroupByColumns 支持逗号多列与数组', () => {
    expect(parseGroupByColumns('fcat,module')).toEqual(['fcat', 'module'])
    expect(parseGroupByColumns(['a', ' b '])).toEqual(['a', 'b'])
    expect(parseGroupByColumns(undefined)).toEqual([])
  })

  test('buildAggSelect 多列 groupby', () => {
    const sql = buildAggSelect(['fcat', 'module'], 'count,sum(compress)')
    expect(sql).toContain('fcat')
    expect(sql).toContain('module')
    expect(sql).toContain('COUNT(*) AS count')
    expect(sql).toContain('sum(compress) AS sum_compress')
  })

  test('buildWhereClause 多条件 AND', () => {
    const { sql, params } = buildWhereClause([
      { column: 'module', op: '=', value: '植被' },
      { column: 'compress', op: '>', value: 1000 },
    ])
    expect(sql).toBe(' WHERE module = ? AND compress > ?')
    expect(params).toEqual(['植被', 1000])
  })
})

describe('csv-shared / dashboard 集成（需 better-sqlite3）', () => {
  const TEST_SESSION = `test-csv-mdim-${Date.now()}`
  let sqliteOk = false

  function sessionDir(): string {
    return path.join(getCsvCacheRoot(), TEST_SESSION)
  }

  beforeAll(async () => {
    process.env.TAGENT_DEV = '1'
    try {
      const Database = (await import('better-sqlite3')).default
      const dir = sessionDir()
      fs.mkdirSync(dir, { recursive: true })
      const dbPath = path.join(dir, 'data.sqlite3')
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
      const db = new Database(dbPath)
      db.exec(`
        CREATE TABLE assets (
          id INTEGER PRIMARY KEY,
          path TEXT, fcat TEXT, module TEXT, compress INTEGER, scene_count INTEGER
        );
      `)
      const insert = db.prepare(
        'INSERT INTO assets (path, fcat, module, compress, scene_count) VALUES (?, ?, ?, ?, ?)'
      )
      const rows: Array<[string, string, string, number, number]> = [
        ['a/tex1.png', '贴图', '植被', 1024, 1],
        ['a/tex2.png', '贴图', '植被', 2048, 2],
        ['a/mesh1.fbx', '模型', '植被', 4096, 1],
        ['b/tex3.png', '贴图', '场景', 8192, 5],
        ['b/mesh2.fbx', '模型', '场景', 16384, 3],
        ['c/char.fbx', '模型', '角色', 32768, 10],
      ]
      const tx = db.transaction(() => {
        for (const r of rows) insert.run(...r)
      })
      tx()
      db.close()
      fs.writeFileSync(
        path.join(dir, 'meta.json'),
        JSON.stringify({
          csv_path: 'test.csv',
          csv_mtime: 1,
          csv_size: 1,
          loaded_at: new Date().toISOString(),
          row_count: 6,
          columns: [
            {
              name: 'fcat',
              sql_name: 'fcat',
              type: 'text',
              role: 'dimension',
              unique_count: 2,
              values: ['贴图', '模型'],
            },
            {
              name: 'module',
              sql_name: 'module',
              type: 'text',
              role: 'dimension',
              unique_count: 3,
              values: ['植被', '场景', '角色'],
            },
            { name: 'path', sql_name: 'path', type: 'text', role: 'dimension', unique_count: 6 },
            { name: 'compress', sql_name: 'compress', type: 'integer', role: 'metric' },
            { name: 'scene_count', sql_name: 'scene_count', type: 'integer', role: 'metric' },
          ],
          overview: {},
        }),
        'utf-8'
      )
      sqliteOk = true
    } catch (err) {
      console.warn('[csv-shared.test] skip 集成测试（better-sqlite3 ABI 不匹配）:', err)
      sqliteOk = false
    }
  })

  afterAll(() => {
    stopCsvLiveServer(TEST_SESSION)
    try {
      fs.rmSync(sessionDir(), { recursive: true, force: true })
      fs.rmSync(path.join(getCsvCacheRoot(), `${TEST_SESSION}-dashboard`), {
        recursive: true,
        force: true,
      })
    } catch {
      /* ignore */
    }
  })

  test('多列 groupby 交叉查询', () => {
    if (!sqliteOk) return
    const result = runCsvQuery(TEST_SESSION, {
      groupby: 'fcat,module',
      agg: 'count,sum(compress)',
      sort: 'sum_compress',
      sort_dir: 'desc',
      limit: 20,
    })
    expect(result.row_count).toBeGreaterThanOrEqual(4)
    const vegTex = result.rows.find((r) => r.fcat === '贴图' && r.module === '植被')
    expect(vegTex?.count).toBe(2)
  })

  test('preset=standard 三视图 + live API', async () => {
    if (!sqliteOk) return
    const toolCall = {
      id: 't2',
      name: 'csv_dashboard',
      arguments: {
        session_id: TEST_SESSION,
        action: 'create',
        preset: 'standard',
        live: 'true',
        title: '测试多维看板',
        overview_json: JSON.stringify([
          { type: 'stats', data: { 资源总数: '6' } },
          { type: 'chart', chart_type: 'pie', title: '类型', data: { 贴图: 3, 模型: 3 } },
        ]),
        cross_json: JSON.stringify([
          {
            type: 'table',
            title: '类型×模块交叉',
            columns: ['fcat', 'module', 'count'],
            rows: [{ fcat: '贴图', module: '植被', count: 2 }],
            sortable: true,
          },
        ]),
        detail_json: JSON.stringify([
          {
            type: 'filter_panel',
            dimensions: [
              { id: 'fcat', label: '资源类型', values: ['贴图', '模型'] },
              { id: 'module', label: '模块', values: ['植被', '场景', '角色'] },
            ],
          },
          {
            type: 'detail_table',
            live: true,
            title: '资源明细',
            columns: ['path', 'fcat', 'module', 'compress'],
            page_size: 10,
          },
        ]),
      },
    } as ToolCall

    const result = await executeCsvDashboard(toolCall)
    expect(result.isError).toBeFalsy()
    const body = JSON.parse(result.content)
    expect(body.view_count).toBe(3)
    expect(body.views).toEqual(['overview', 'cross', 'detail'])
    expect(body.live).toBe(true)
    expect(body.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//)

    const html = fs.readFileSync(body.file_path, 'utf-8')
    expect(html).toContain('id="view-cross"')
    expect(html).toContain('live-detail-table')
    expect(html).toContain('detail-filter-fcat')

    const rowsRes = await fetch(`${body.url}api/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: [{ column: 'module', op: '=', value: '植被' }],
        select: 'path,fcat,module',
        limit: 10,
        offset: 0,
      }),
    })
    const rowsJson = (await rowsRes.json()) as { total_before_limit: number }
    expect(rowsJson.total_before_limit).toBe(3)
  })

  test('create + query 风格 overview_json 拒绝写盘', async () => {
    if (!sqliteOk) return
    const rejectSession = `${TEST_SESSION}-reject-query`
    const rejectDir = path.join(getCsvCacheRoot(), `${rejectSession}-dashboard`)
    try {
      const toolCall = {
        id: 't-reject-query',
        name: 'csv_dashboard',
        arguments: {
          session_id: rejectSession,
          action: 'create',
          preset: 'standard',
          title: '错误贴图看板',
          overview_json: JSON.stringify([
            {
              filters: [{ column: 'fcat', op: '=', value: '贴图' }],
              groupby: 'module',
              agg: 'count,sum(compress)',
            },
          ]),
        },
      } as ToolCall

      const result = await executeCsvDashboard(toolCall)
      expect(result.isError).toBe(true)
      expect(result.content).toContain('csv_query')
      expect(result.content).toContain('add_view')
      expect(fs.existsSync(path.join(rejectDir, 'dashboard.html'))).toBe(false)
    } finally {
      stopCsvLiveServer(rejectSession)
      fs.rmSync(rejectDir, { recursive: true, force: true })
    }
  })

  test('create 不合规且已有看板时不覆盖原文件', async () => {
    if (!sqliteOk) return
    const preserveSession = `${TEST_SESSION}-preserve`
    const preserveDir = path.join(getCsvCacheRoot(), `${preserveSession}-dashboard`)
    const dashboardPath = path.join(preserveDir, 'dashboard.html')
    try {
      const goodCreate = {
        id: 't-good',
        name: 'csv_dashboard',
        arguments: {
          session_id: preserveSession,
          action: 'create',
          preset: 'auto',
          live: 'false',
          title: '原始看板',
        },
      } as ToolCall
      const goodResult = await executeCsvDashboard(goodCreate)
      expect(goodResult.isError).toBeFalsy()
      const originalHtml = fs.readFileSync(dashboardPath, 'utf-8')
      expect(originalHtml.length).toBeGreaterThan(100)

      const badCreate = {
        id: 't-bad',
        name: 'csv_dashboard',
        arguments: {
          session_id: preserveSession,
          action: 'create',
          preset: 'standard',
          title: '错误覆盖',
          overview_json: JSON.stringify([{ agg: 'count', groupby: 'fcat' }]),
        },
      } as ToolCall
      const badResult = await executeCsvDashboard(badCreate)
      expect(badResult.isError).toBe(true)
      expect(badResult.content).toContain('未被覆盖')
      expect(fs.readFileSync(dashboardPath, 'utf-8')).toBe(originalHtml)
    } finally {
      stopCsvLiveServer(preserveSession)
      fs.rmSync(preserveDir, { recursive: true, force: true })
    }
  })

  test('action=slice 默认走内存 live_tab，不写 dashboard.html', async () => {
    if (!sqliteOk) return
    const sliceSession = `${TEST_SESSION}-slice`
    const sliceDir = path.join(getCsvCacheRoot(), sliceSession)
    const dashDir = path.join(getCsvCacheRoot(), `${sliceSession}-dashboard`)
    const dashboardPath = path.join(dashDir, 'dashboard.html')
    try {
      fs.cpSync(sessionDir(), sliceDir, { recursive: true, force: true })
      stopCsvLiveServer(sliceSession)

      const createCall = {
        id: 't-create-slice',
        name: 'csv_dashboard',
        arguments: {
          session_id: sliceSession,
          action: 'create',
          preset: 'auto',
          live: 'true',
          title: '切片测试看板',
        },
      } as ToolCall
      const createRes = await executeCsvDashboard(createCall)
      expect(createRes.isError).toBeFalsy()
      const createBody = JSON.parse(createRes.content)
      const htmlBefore = fs.readFileSync(dashboardPath, 'utf-8')
      const mtimeBefore = fs.statSync(dashboardPath).mtimeMs

      const sliceCall = {
        id: 't-slice',
        name: 'csv_dashboard',
        arguments: {
          session_id: sliceSession,
          action: 'slice',
          filter_value: '贴图',
        },
      } as ToolCall
      const sliceRes = await executeCsvDashboard(sliceCall)
      expect(sliceRes.isError).toBeFalsy()
      const body = JSON.parse(sliceRes.content)
      expect(body.action).toBe('slice')
      expect(body.ephemeral).toBe(true)
      expect(body.active_view).toContain('slice-fcat')
      expect(body.hint).toContain('内存')
      expect(body.url).toContain('keep_live=1')

      // dashboard.html 不应被 slice 修改
      expect(fs.readFileSync(dashboardPath, 'utf-8')).toBe(htmlBefore)
      expect(fs.statSync(dashboardPath).mtimeMs).toBe(mtimeBefore)
      expect(htmlBefore).not.toContain(`id="view-${body.active_view}"`)

      // 内存 API 应有 tab
      const tabsRes = await fetch(`${createBody.url}api/live-tabs`)
      const tabsJson = (await tabsRes.json()) as { tabs: Array<{ id: string; label: string }> }
      expect(tabsJson.tabs.some((t) => t.id === body.active_view)).toBe(true)
    } finally {
      stopCsvLiveServer(sliceSession)
      fs.rmSync(sliceDir, { recursive: true, force: true })
      fs.rmSync(dashDir, { recursive: true, force: true })
    }
  })

  test('slice(persist=true) 落盘 add_view，写入 dashboard.html', async () => {
    if (!sqliteOk) return
    const persistSession = `${TEST_SESSION}-persist`
    const persistDir = path.join(getCsvCacheRoot(), persistSession)
    const dashDir = path.join(getCsvCacheRoot(), `${persistSession}-dashboard`)
    const dashboardPath = path.join(dashDir, 'dashboard.html')
    try {
      fs.cpSync(sessionDir(), persistDir, { recursive: true, force: true })
      stopCsvLiveServer(persistSession)

      const createCall = {
        id: 't-create-persist',
        name: 'csv_dashboard',
        arguments: {
          session_id: persistSession,
          action: 'create',
          preset: 'auto',
          live: 'true',
          title: '固化切片测试',
        },
      } as ToolCall
      const createRes = await executeCsvDashboard(createCall)
      expect(createRes.isError).toBeFalsy()
      const htmlBefore = fs.readFileSync(dashboardPath, 'utf-8')
      expect(htmlBefore).not.toContain('id="view-slice-fcat-')

      const persistCall = {
        id: 't-persist',
        name: 'csv_dashboard',
        arguments: {
          session_id: persistSession,
          action: 'slice',
          persist: 'true',
          filter_value: '贴图',
        },
      } as ToolCall
      const persistRes = await executeCsvDashboard(persistCall)
      expect(persistRes.isError).toBeFalsy()
      const body = JSON.parse(persistRes.content)
      expect(body.ephemeral).toBeFalsy()
      expect(body.active_view).toContain('slice-fcat')
      expect(body.views).toContain(body.active_view)
      expect(body.hint).toContain('加入 tab')

      const htmlAfter = fs.readFileSync(dashboardPath, 'utf-8')
      expect(htmlAfter).not.toBe(htmlBefore)
      expect(htmlAfter).toContain(`id="view-${body.active_view}"`)

      // 再次同值 persist → replace_view，不无限加 tab
      const again = await executeCsvDashboard({
        ...persistCall,
        id: 't-persist-2',
      } as ToolCall)
      expect(again.isError).toBeFalsy()
      const againBody = JSON.parse(again.content)
      expect(againBody.active_view).toBe(body.active_view)
      const viewOccurrences = (
        fs
          .readFileSync(dashboardPath, 'utf-8')
          .match(new RegExp(`id="view-${body.active_view}"`, 'g')) ?? []
      ).length
      expect(viewOccurrences).toBe(1)
    } finally {
      stopCsvLiveServer(persistSession)
      fs.rmSync(persistDir, { recursive: true, force: true })
      fs.rmSync(dashDir, { recursive: true, force: true })
    }
  })

  test('action=patch 改 byte_unit，不要求重新 prepare', async () => {
    if (!sqliteOk) return
    const patchSession = `${TEST_SESSION}-patch`
    const patchDir = path.join(getCsvCacheRoot(), patchSession)
    const dashDir = path.join(getCsvCacheRoot(), `${patchSession}-dashboard`)
    const dashboardPath = path.join(dashDir, 'dashboard.html')
    const metaPath = path.join(dashDir, 'meta.json')
    try {
      fs.cpSync(sessionDir(), patchDir, { recursive: true, force: true })
      stopCsvLiveServer(patchSession)

      const createRes = await executeCsvDashboard({
        id: 't-create-patch',
        name: 'csv_dashboard',
        arguments: {
          session_id: patchSession,
          action: 'create',
          preset: 'auto',
          live: 'true',
          title: '单位测试看板',
          byte_unit: 'auto',
        },
      } as ToolCall)
      expect(createRes.isError).toBeFalsy()

      const patchRes = await executeCsvDashboard({
        id: 't-patch',
        name: 'csv_dashboard',
        arguments: {
          session_id: patchSession,
          action: 'patch',
          byte_unit: 'MB',
          title: '单位测试看板(MB)',
        },
      } as ToolCall)
      expect(patchRes.isError).toBeFalsy()
      const body = JSON.parse(patchRes.content)
      expect(body.action).toBe('patch')
      expect(body.byte_unit).toBe('MB')
      expect(body.hint).toContain('未重新 prepare')
      expect(fs.readFileSync(dashboardPath, 'utf-8')).toContain('data-byte-unit="MB"')
      const dashMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as {
        display?: { byte_unit?: string; title?: string }
      }
      expect(dashMeta.display?.byte_unit).toBe('MB')
      expect(dashMeta.display?.title).toBe('单位测试看板(MB)')
    } finally {
      stopCsvLiveServer(patchSession)
      fs.rmSync(patchDir, { recursive: true, force: true })
      fs.rmSync(dashDir, { recursive: true, force: true })
    }
  })
})
