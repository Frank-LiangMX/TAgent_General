/**
 * csv_prepare 缓存命中 / 变更重建
 *
 * 依赖 better-sqlite3；Bun 下 ABI 不匹配时整组 skip（与 csv-shared.test 同策略）。
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { ToolCall } from '@tagent/core'
import { executeCsvPrepare } from './csv-prepare-tool'
import { getCsvCacheRoot } from './csv-shared'

describe('csv_prepare 缓存', () => {
  const SESSION = `test-csv-prepare-${Date.now()}`
  let csvPath = ''
  let sqliteOk = false

  function sessionDir(): string {
    return path.join(getCsvCacheRoot(), SESSION)
  }

  beforeAll(async () => {
    process.env.TAGENT_DEV = '1'
    try {
      const Database = (await import('better-sqlite3')).default
      // 真正打开一次，确认 native binding 可用（仅 import 不够）
      const probeDir = path.join(getCsvCacheRoot(), `${SESSION}-probe`)
      fs.mkdirSync(probeDir, { recursive: true })
      const probeDb = path.join(probeDir, 'probe.sqlite3')
      const db = new Database(probeDb)
      db.close()
      fs.rmSync(probeDir, { recursive: true, force: true })

      const fixtures = path.join(getCsvCacheRoot(), `${SESSION}-fixtures`)
      fs.mkdirSync(fixtures, { recursive: true })
      csvPath = path.join(fixtures, 'sample.csv')
      fs.writeFileSync(csvPath, 'path,fcat,compress\na.png,贴图,1024\nb.fbx,模型,2048\n', 'utf-8')
      sqliteOk = true
    } catch (err) {
      console.warn('[csv-prepare-tool.test] skip（better-sqlite3 ABI 不匹配）:', err)
      sqliteOk = false
    }
  })

  afterAll(() => {
    try {
      fs.rmSync(sessionDir(), { recursive: true, force: true })
      fs.rmSync(path.join(getCsvCacheRoot(), `${SESSION}-fixtures`), {
        recursive: true,
        force: true,
      })
      fs.rmSync(path.join(getCsvCacheRoot(), `${SESSION}-probe`), {
        recursive: true,
        force: true,
      })
    } catch {
      /* ignore */
    }
  })

  test('同 mtime 二次 prepare 命中缓存', async () => {
    if (!sqliteOk) return
    expect(fs.existsSync(csvPath)).toBe(true)
    const call = {
      id: 'prep-1',
      name: 'csv_prepare',
      arguments: { path: csvPath, session_id: SESSION },
    } as ToolCall

    const first = await executeCsvPrepare(call)
    expect(first.isError).toBeFalsy()
    const firstBody = JSON.parse(first.content) as {
      status: string
      row_count: number
      from_cache?: boolean
    }
    expect(firstBody.status).toBe('ready')
    expect(firstBody.from_cache).toBe(false)
    expect(firstBody.row_count).toBe(2)

    const metaPath = path.join(sessionDir(), 'meta.json')
    const metaBefore = fs.readFileSync(metaPath, 'utf-8')
    const mtimeBefore = fs.statSync(path.join(sessionDir(), 'data.sqlite3')).mtimeMs

    const second = await executeCsvPrepare({ ...call, id: 'prep-2' } as ToolCall)
    expect(second.isError).toBeFalsy()
    const secondBody = JSON.parse(second.content) as {
      status: string
      row_count: number
      from_cache?: boolean
    }
    expect(secondBody.status).toBe('ready')
    expect(secondBody.from_cache).toBe(true)
    expect(secondBody.row_count).toBe(2)
    expect(fs.readFileSync(metaPath, 'utf-8')).toBe(metaBefore)
    expect(fs.statSync(path.join(sessionDir(), 'data.sqlite3')).mtimeMs).toBe(mtimeBefore)
  })

  test('CSV mtime 变更后重建缓存', async () => {
    if (!sqliteOk) return
    const call = {
      id: 'prep-3',
      name: 'csv_prepare',
      arguments: { path: csvPath, session_id: SESSION },
    } as ToolCall

    const primed = await executeCsvPrepare(call)
    expect(primed.isError).toBeFalsy()
    const metaBefore = JSON.parse(
      fs.readFileSync(path.join(sessionDir(), 'meta.json'), 'utf-8')
    ) as {
      csv_mtime: number
      row_count: number
    }

    fs.writeFileSync(
      csvPath,
      'path,fcat,compress\na.png,贴图,1024\nb.fbx,模型,2048\nc.png,贴图,512\n',
      'utf-8'
    )
    // 推高 mtime（秒级），避免与缓存 meta 相同
    const bumpSec = Math.floor(Date.now() / 1000) + 60
    fs.utimesSync(csvPath, bumpSec, bumpSec)

    const rebuilt = await executeCsvPrepare({ ...call, id: 'prep-4' } as ToolCall)
    expect(rebuilt.isError).toBeFalsy()
    const body = JSON.parse(rebuilt.content) as { row_count: number; from_cache?: boolean }
    expect(body.from_cache).toBe(false)
    expect(body.row_count).toBe(3)
    const metaAfter = JSON.parse(
      fs.readFileSync(path.join(sessionDir(), 'meta.json'), 'utf-8')
    ) as {
      csv_mtime: number
      row_count: number
    }
    expect(metaAfter.row_count).toBe(3)
    expect(metaAfter.csv_mtime).not.toBe(metaBefore.csv_mtime)
  })
})
