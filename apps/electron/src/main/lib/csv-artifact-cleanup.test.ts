/**
 * clearAgentSessionCsvCache 窄测：temp dir + mock getCsvCacheRoot
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const tmpRoot = path.join(os.tmpdir(), `tagent-csv-cleanup-${Date.now()}`)
const cacheRoot = path.join(tmpRoot, 'csv-cache')
const artifactsDir = path.join(tmpRoot, 'csv-artifacts')

vi.mock('./tools/csv-shared', () => ({
  getCsvCacheRoot: () => cacheRoot,
}))

vi.mock('./config-paths', () => ({
  getAgentSessionCsvArtifactsPath: (id: string) => path.join(artifactsDir, `${id}.json`),
}))

const stopCsvLiveServerMock = vi.fn()
vi.mock('./tools/csv-live-server', () => ({
  stopCsvLiveServer: (...args: unknown[]) => stopCsvLiveServerMock(...args),
}))

const { clearAgentSessionCsvCache, recordCsvArtifact } = await import('./csv-artifact-service')

describe('clearAgentSessionCsvCache', () => {
  const agentSessionId = 'agent-sess-1'
  const csvSessionId = 'csv-session-1'

  beforeEach(() => {
    fs.mkdirSync(cacheRoot, { recursive: true })
    fs.mkdirSync(artifactsDir, { recursive: true })
    stopCsvLiveServerMock.mockClear()
  })

  afterEach(() => {
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('清理 artifacts 记录的 csvSessionId 对应目录与索引', () => {
    const sessionDir = path.join(cacheRoot, csvSessionId)
    const dashboardDir = path.join(cacheRoot, `${csvSessionId}-dashboard`)
    fs.mkdirSync(sessionDir, { recursive: true })
    fs.writeFileSync(path.join(sessionDir, 'meta.json'), '{}')
    fs.mkdirSync(dashboardDir, { recursive: true })
    fs.writeFileSync(path.join(dashboardDir, 'live.json'), '{}')

    recordCsvArtifact(agentSessionId, {
      csvSessionId,
      title: '测试看板',
      byte_unit: 'MB',
      views: ['overview'],
      file_path: 'C:/tmp/dashboard.html',
      last_action: 'create',
    })

    clearAgentSessionCsvCache(agentSessionId)

    expect(stopCsvLiveServerMock).toHaveBeenCalledWith(csvSessionId)
    expect(fs.existsSync(sessionDir)).toBe(false)
    expect(fs.existsSync(dashboardDir)).toBe(false)
    expect(fs.existsSync(path.join(artifactsDir, `${agentSessionId}.json`))).toBe(false)
  })

  test('无 artifacts 时不误删 csv-cache 其他目录', () => {
    const otherSession = 'other-agent-csv-session'
    const otherDir = path.join(cacheRoot, otherSession)
    fs.mkdirSync(otherDir, { recursive: true })
    fs.writeFileSync(path.join(otherDir, 'meta.json'), '{}')

    clearAgentSessionCsvCache('agent-with-no-artifacts')

    expect(fs.existsSync(otherDir)).toBe(true)
    expect(stopCsvLiveServerMock).not.toHaveBeenCalled()
  })

  test('多个 csvSessionId 去重后逐一清理', () => {
    const ids = ['csv-a', 'csv-b']
    for (const id of ids) {
      fs.mkdirSync(path.join(cacheRoot, id), { recursive: true })
      fs.mkdirSync(path.join(cacheRoot, `${id}-dashboard`), { recursive: true })
    }

    recordCsvArtifact(agentSessionId, {
      csvSessionId: 'csv-a',
      title: 'A',
      byte_unit: 'MB',
      views: [],
      file_path: 'C:/a.html',
      last_action: 'create',
    })
    recordCsvArtifact(agentSessionId, {
      csvSessionId: 'csv-b',
      title: 'B',
      byte_unit: 'GB',
      views: [],
      file_path: 'C:/b.html',
      last_action: 'create',
    })

    clearAgentSessionCsvCache(agentSessionId)

    expect(stopCsvLiveServerMock).toHaveBeenCalledTimes(2)
    expect(stopCsvLiveServerMock).toHaveBeenCalledWith('csv-a')
    expect(stopCsvLiveServerMock).toHaveBeenCalledWith('csv-b')
    expect(fs.existsSync(path.join(cacheRoot, 'csv-a'))).toBe(false)
    expect(fs.existsSync(path.join(cacheRoot, 'csv-b-dashboard'))).toBe(false)
  })
})
