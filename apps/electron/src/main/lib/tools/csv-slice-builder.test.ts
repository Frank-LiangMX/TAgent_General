/**
 * csv-slice-builder 单元测试（列匹配逻辑，不依赖 SQLite 查询）
 */

import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { getCsvCacheRoot } from './csv-shared'
import { resolveSliceTarget } from './csv-slice-builder'

describe('csv-slice-builder 列/值解析', () => {
  const SESSION = `test-slice-resolve-${Date.now()}`
  let dir = ''

  beforeAll(() => {
    process.env.TAGENT_DEV = '1'
    dir = path.join(getCsvCacheRoot(), SESSION)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'meta.json'),
      JSON.stringify({
        csv_path: 'test.csv',
        csv_mtime: 1,
        csv_size: 1,
        loaded_at: new Date().toISOString(),
        row_count: 100,
        columns: [
          {
            name: 'fcat',
            sql_name: 'fcat',
            type: 'text',
            role: 'dimension',
            unique_count: 4,
            values: ['贴图', '模型', '动画', '音频'],
          },
          {
            name: 'module',
            sql_name: 'module',
            type: 'text',
            role: 'dimension',
            unique_count: 5,
            values: ['植被', '场景', '角色', 'UI', '特效'],
          },
          { name: 'compress', sql_name: 'compress', type: 'integer', role: 'metric' },
        ],
        overview: {},
      }),
      'utf-8'
    )
  })

  afterAll(() => {
    try {
      if (dir) fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  test('slice_query=贴图 自动匹配 fcat 列', () => {
    const r = resolveSliceTarget(SESSION, { slice_query: '贴图' })
    expect(r.filterColumn).toBe('fcat')
    expect(r.filterValue).toBe('贴图')
    expect(r.label).toBe('贴图')
    expect(r.viewId).toContain('slice-fcat')
  })

  test('filter_value=植被 匹配 module 列', () => {
    const r = resolveSliceTarget(SESSION, { filter_value: '植被' })
    expect(r.filterColumn).toBe('module')
    expect(r.filterValue).toBe('植被')
  })

  test('filter_column=fcat + filter_value=模型', () => {
    const r = resolveSliceTarget(SESSION, {
      filter_column: 'fcat',
      filter_value: '模型',
      label: '模型专页',
    })
    expect(r.filterColumn).toBe('fcat')
    expect(r.filterValue).toBe('模型')
    expect(r.label).toBe('模型专页')
  })

  test('无匹配值时抛错', () => {
    expect(() => resolveSliceTarget(SESSION, { slice_query: '不存在的类别xyz' })).toThrow(
      /未能在维度列中/
    )
  })

  test('无 query 参数时抛错', () => {
    expect(() => resolveSliceTarget(SESSION, {})).toThrow(/filter_value/)
  })
})
