/**
 * csv-artifact-service：用真实临时文件，避免 mock node:fs 污染同进程其它测试
 */

import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tagent-csv-artifacts-'))
const artifactsPath = path.join(tempRoot, 'sess-1.json')

vi.mock('./config-paths', () => ({
  getAgentSessionCsvArtifactsPath: () => artifactsPath,
}))

const {
  listCsvArtifacts,
  recordCsvArtifact,
  buildCsvArtifactsContextBlock,
  CSV_ARTIFACT_OPS_HINT,
} = await import('./csv-artifact-service')

describe('csv-artifact-service', () => {
  beforeEach(() => {
    fs.mkdirSync(tempRoot, { recursive: true })
    if (fs.existsSync(artifactsPath)) fs.unlinkSync(artifactsPath)
  })

  afterEach(() => {
    if (fs.existsSync(artifactsPath)) fs.unlinkSync(artifactsPath)
  })

  afterAll(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  test('listCsvArtifacts 空文件返回 []', () => {
    expect(listCsvArtifacts('sess-1')).toEqual([])
  })

  test('recordCsvArtifact 新建并写入 JSON', () => {
    recordCsvArtifact('sess-1', {
      csvSessionId: 'csv-a',
      title: '测试看板',
      byte_unit: 'MB',
      views: ['overview', 'detail'],
      file_path: 'C:/tmp/dashboard.html',
      last_action: 'create',
    })

    expect(fs.existsSync(artifactsPath)).toBe(true)
    const written = JSON.parse(fs.readFileSync(artifactsPath, 'utf-8')) as Array<{
      csvSessionId: string
      title: string
      last_action: string
    }>
    expect(written).toHaveLength(1)
    expect(written[0]!.csvSessionId).toBe('csv-a')
    expect(written[0]!.title).toBe('测试看板')
    expect(written[0]!.last_action).toBe('create')
  })

  test('recordCsvArtifact 同 csvSessionId 更新而非追加', () => {
    fs.writeFileSync(
      artifactsPath,
      JSON.stringify([
        {
          csvSessionId: 'csv-a',
          title: '旧标题',
          byte_unit: 'auto',
          views: ['overview'],
          file_path: 'C:/tmp/old.html',
          last_action: 'create',
          updatedAt: '2026-07-22T10:00:00.000Z',
        },
      ]),
      'utf-8'
    )

    recordCsvArtifact('sess-1', {
      csvSessionId: 'csv-a',
      title: '新标题',
      byte_unit: 'MB',
      views: ['overview', 'cross'],
      file_path: 'C:/tmp/new.html',
      last_action: 'patch',
    })

    const written = JSON.parse(fs.readFileSync(artifactsPath, 'utf-8')) as Array<{
      title: string
      last_action: string
      byte_unit: string
    }>
    expect(written).toHaveLength(1)
    expect(written[0]!.title).toBe('新标题')
    expect(written[0]!.last_action).toBe('patch')
    expect(written[0]!.byte_unit).toBe('MB')
  })

  test('buildCsvArtifactsContextBlock 含 ops 提示', () => {
    fs.writeFileSync(
      artifactsPath,
      JSON.stringify([
        {
          csvSessionId: 'csv-a',
          title: '资源看板',
          byte_unit: 'GB',
          views: ['overview'],
          file_path: 'C:/tmp/d.html',
          last_action: 'create',
          updatedAt: '2026-07-22T12:00:00.000Z',
        },
      ]),
      'utf-8'
    )

    const block = buildCsvArtifactsContextBlock('sess-1')
    expect(block).toContain('<csv_artifacts>')
    expect(block).toContain('session_id=csv-a')
    expect(block).toContain('资源看板')
    expect(block).toContain(CSV_ARTIFACT_OPS_HINT)
  })
})
