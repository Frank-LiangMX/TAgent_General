/**
 * CSV live server：刷新后 ensure 可重启 + sticky 端口
 */

import { describe, expect, test, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { getCsvCacheRoot } from './csv-shared'
import {
  ensureCsvLiveServer,
  stopCsvLiveServer,
  findSessionIdByLiveUrl,
} from './csv-live-server'

describe('csv-live-server 恢复', () => {
  const TEST_SESSION = `test-csv-live-restore-${Date.now()}`

  function dashDir(): string {
    return path.join(getCsvCacheRoot(), `${TEST_SESSION}-dashboard`)
  }

  afterAll(() => {
    stopCsvLiveServer(TEST_SESSION)
    try {
      fs.rmSync(dashDir(), { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  test('ensure → stop → ensure 再次可用，并写入 live.json', async () => {
    process.env.TAGENT_DEV = '1'
    fs.mkdirSync(dashDir(), { recursive: true })
    fs.writeFileSync(path.join(dashDir(), 'dashboard.html'), '<html><body>ok</body></html>', 'utf-8')

    const first = await ensureCsvLiveServer(TEST_SESSION)
    expect(first.ok).toBe(true)
    expect(first.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/)
    expect(first.sessionId).toBe(TEST_SESSION)

    const liveMetaPath = path.join(dashDir(), 'live.json')
    expect(fs.existsSync(liveMetaPath)).toBe(true)
    const meta = JSON.parse(fs.readFileSync(liveMetaPath, 'utf-8')) as { port: number }
    expect(meta.port).toBe(first.port)

    // 模拟主进程内存 Map 清空（刷新/重启）
    stopCsvLiveServer(TEST_SESSION)

    const second = await ensureCsvLiveServer(TEST_SESSION)
    expect(second.ok).toBe(true)
    expect(second.port).toBe(first.port) // sticky
    expect(second.url).toBe(first.url)

    const found = findSessionIdByLiveUrl(second.url)
    expect(found).toBe(TEST_SESSION)

    // HTTP 可访问
    const res = await fetch(second.url)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('ok')
  })

  test('live-tabs API upsert/list/delete', async () => {
    process.env.TAGENT_DEV = '1'
    const tabSession = `test-live-tabs-api-${Date.now()}`
    const dir = path.join(getCsvCacheRoot(), `${tabSession}-dashboard`)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'dashboard.html'), '<html><body><div id="ai-live-views"></div></body></html>', 'utf-8')

    try {
      const live = await ensureCsvLiveServer(tabSession)
      expect(live.ok).toBe(true)

      const upsert = await fetch(`${live.url}api/live-tabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'live-test',
          label: '测试',
          sectionsHtml: '<div class="view-content">ok</div>',
        }),
      })
      expect(upsert.status).toBe(200)

      const list = await fetch(`${live.url}api/live-tabs`)
      const listJson = (await list.json()) as { tabs: Array<{ id: string }> }
      expect(listJson.tabs.some((t) => t.id === 'live-test')).toBe(true)

      const delOne = await fetch(`${live.url}api/live-tabs/live-test`, { method: 'DELETE' })
      expect(delOne.status).toBe(200)

      const cleared = await fetch(`${live.url}api/live-tabs`, { method: 'DELETE' })
      expect(cleared.status).toBe(200)
      const after = await fetch(`${live.url}api/live-tabs`)
      const afterJson = (await after.json()) as { tabs: unknown[] }
      expect(afterJson.tabs).toHaveLength(0)
    } finally {
      stopCsvLiveServer(tabSession)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('无 dashboard.html 时 ensure 失败', async () => {
    process.env.TAGENT_DEV = '1'
    const missing = `missing-dash-${Date.now()}`
    const result = await ensureCsvLiveServer(missing)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/dashboard\.html/)
  })
})
