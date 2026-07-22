/**
 * csv-auto-builder 纯逻辑测试（不依赖 better-sqlite3）
 */

import { describe, expect, test } from 'vitest'
import {
  pickChartDimensions,
  pickMetrics,
  buildStackedPivot,
  scoreDimension,
  pickCrossPairs,
  pickDetailColumns,
  pickFilterSelectDims,
  isWeakChartDimension,
  formatBytes,
} from './csv-auto-builder'
import type { CsvColumnMeta } from './csv-shared'

describe('csv-auto-builder 维度/度量选择', () => {
  test('formatBytes 固定 MB', () => {
    expect(formatBytes(40.7 * 1024 * 1024 * 1024, 'MB')).toMatch(/MB$/)
    expect(formatBytes(1048576, 'MB')).toBe('1.00 MB')
    expect(formatBytes(1024, 'auto')).toBe('1.00 KB')
  })

  const columns: CsvColumnMeta[] = [
    { name: 'path', sql_name: 'path', type: 'text', role: 'dimension', unique_count: 999000 },
    { name: 'fcat', sql_name: 'fcat', type: 'text', role: 'dimension', unique_count: 8, values: ['贴图', '模型'] },
    { name: 'module', sql_name: 'module', type: 'text', role: 'dimension', unique_count: 20 },
    { name: 'owner', sql_name: 'owner', type: 'text', role: 'dimension', unique_count: 3 },
    { name: 'compress', sql_name: 'compress', type: 'integer', role: 'metric' },
    { name: 'scene_count', sql_name: 'scene_count', type: 'integer', role: 'metric' },
  ]

  test('排除 path 等高基数列，保留 fcat/module/owner', () => {
    const dims = pickChartDimensions(columns, 999000)
    const names = dims.map((d) => d.sql_name)
    expect(names).toContain('fcat')
    expect(names).toContain('module')
    expect(names).toContain('owner')
    expect(names).not.toContain('path')
  })

  test('度量优先 compress', () => {
    const metrics = pickMetrics(columns)
    expect(metrics[0]?.sql_name).toBe('compress')
  })

  test('buildStackedPivot 生成多系列', () => {
    const pivot = buildStackedPivot(
      [
        { fcat: '贴图', module: '植被', sum_compress: 10 },
        { fcat: '贴图', module: '场景', sum_compress: 20 },
        { fcat: '模型', module: '植被', sum_compress: 5 },
        { fcat: '模型', module: '角色', sum_compress: 40 },
      ],
      'fcat',
      'module',
      'sum_compress'
    )
    expect(pivot.labels.length).toBeGreaterThanOrEqual(2)
    expect(pivot.datasets.length).toBeGreaterThanOrEqual(2)
    expect(pivot.datasets[0]?.data.length).toBe(pivot.labels.length)
  })
})

describe('csv-auto-builder 语义打分与排序', () => {
  test('语义名分高于低基数无名列；scene_count / 二值旗标降权', () => {
    const owner: CsvColumnMeta = {
      name: 'owner',
      sql_name: 'owner',
      type: 'text',
      role: 'dimension',
      unique_count: 5,
    }
    const noise: CsvColumnMeta = {
      name: 'misc_code',
      sql_name: 'misc_code',
      type: 'text',
      role: 'dimension',
      unique_count: 3,
    }
    const sceneAsDim: CsvColumnMeta = {
      name: 'scene_count',
      sql_name: 'scene_count',
      type: 'integer',
      role: 'dimension',
      unique_count: 4,
    }
    const flag: CsvColumnMeta = {
      name: 'is_active',
      sql_name: 'is_active',
      type: 'text',
      role: 'dimension',
      unique_count: 2,
    }
    expect(scoreDimension(owner)).toBeGreaterThan(scoreDimension(noise))
    expect(scoreDimension(owner)).toBeGreaterThan(scoreDimension(sceneAsDim))
    expect(scoreDimension(owner)).toBeGreaterThan(scoreDimension(flag))
    expect(isWeakChartDimension(flag)).toBe(true)
    expect(isWeakChartDimension(sceneAsDim)).toBe(true)
  })

  test('pickChartDimensions 语义序：owner/fcat/module 优先于 scene 旗标', () => {
    const cols: CsvColumnMeta[] = [
      { name: 'scene_flag', sql_name: 'scene_flag', type: 'text', role: 'dimension', unique_count: 2 },
      { name: 'fcat', sql_name: 'fcat', type: 'text', role: 'dimension', unique_count: 8 },
      { name: 'module', sql_name: 'module', type: 'text', role: 'dimension', unique_count: 20 },
      { name: 'owner', sql_name: 'owner', type: 'text', role: 'dimension', unique_count: 4 },
      { name: 'geo_tag', sql_name: 'geo_tag', type: 'text', role: 'dimension', unique_count: 3 },
      { name: 'path', sql_name: 'path', type: 'text', role: 'dimension', unique_count: 50000 },
    ]
    const dims = pickChartDimensions(cols, 50000)
    const names = dims.map((d) => d.sql_name)
    expect(names[0]).toMatch(/owner|fcat|module|geo_tag/)
    expect(names.indexOf('owner')).toBeLessThan(names.indexOf('scene_flag'))
    expect(names.indexOf('fcat')).toBeLessThan(names.indexOf('scene_flag'))
    expect(names).not.toContain('path')
  })

  test('≥3 维时 pickCrossPairs 返回 2 对，且避开弱旗标优先对', () => {
    const dims = pickChartDimensions(
      [
        { name: 'fcat', sql_name: 'fcat', type: 'text', role: 'dimension', unique_count: 8 },
        { name: 'module', sql_name: 'module', type: 'text', role: 'dimension', unique_count: 15 },
        { name: 'owner', sql_name: 'owner', type: 'text', role: 'dimension', unique_count: 4 },
        { name: 'is_ok', sql_name: 'is_ok', type: 'text', role: 'dimension', unique_count: 2 },
      ],
      1000
    )
    const pairs = pickCrossPairs(dims)
    expect(pairs.length).toBe(2)
    const flat = pairs.flat().map((d) => d.sql_name)
    // 强维进交叉；弱旗标不进入优先对
    expect(flat).toContain('owner')
    expect(flat).toContain('fcat')
    expect(flat).not.toContain('is_ok')
    // 第一对应为得分最高的两强维
    expect(pairs[0]!.map((d) => d.sql_name).sort()).toEqual(['fcat', 'owner'].sort())
  })

  test('pickDetailColumns 把 path/owner/module/fcat/compress 靠前，允许 >12 列', () => {
    const cols: CsvColumnMeta[] = [
      { name: 'zzz', sql_name: 'zzz', type: 'text', role: 'dimension', unique_count: 10 },
      { name: 'scene_count', sql_name: 'scene_count', type: 'integer', role: 'metric' },
      { name: 'compress', sql_name: 'compress', type: 'integer', role: 'metric' },
      { name: 'geo_tag', sql_name: 'geo_tag', type: 'text', role: 'dimension', unique_count: 3 },
      { name: 'fcat', sql_name: 'fcat', type: 'text', role: 'dimension', unique_count: 8 },
      { name: 'module', sql_name: 'module', type: 'text', role: 'dimension', unique_count: 20 },
      { name: 'owner', sql_name: 'owner', type: 'text', role: 'dimension', unique_count: 4 },
      { name: 'path', sql_name: 'path', type: 'text', role: 'dimension', unique_count: 999 },
      { name: 'tex_pixels', sql_name: 'tex_pixels', type: 'integer', role: 'metric' },
      { name: 'vertex_count', sql_name: 'vertex_count', type: 'integer', role: 'metric' },
      { name: 'face_count', sql_name: 'face_count', type: 'integer', role: 'metric' },
      { name: 'a1', sql_name: 'a1', type: 'text', role: 'dimension', unique_count: 5 },
      { name: 'a2', sql_name: 'a2', type: 'text', role: 'dimension', unique_count: 5 },
      { name: 'a3', sql_name: 'a3', type: 'text', role: 'dimension', unique_count: 5 },
      { name: 'a4', sql_name: 'a4', type: 'text', role: 'dimension', unique_count: 5 },
      { name: 'a5', sql_name: 'a5', type: 'text', role: 'dimension', unique_count: 5 },
      { name: 'a6', sql_name: 'a6', type: 'text', role: 'dimension', unique_count: 5 },
      { name: 'a7', sql_name: 'a7', type: 'text', role: 'dimension', unique_count: 5 },
    ]
    const ordered = pickDetailColumns(cols, 18)
    expect(ordered[0]).toBe('path')
    expect(ordered.indexOf('owner')).toBeLessThan(ordered.indexOf('zzz'))
    expect(ordered.indexOf('fcat')).toBeLessThan(ordered.indexOf('scene_count'))
    expect(ordered.indexOf('compress')).toBeLessThan(ordered.indexOf('a1'))
    expect(ordered.length).toBeGreaterThan(12)
    expect(ordered.length).toBeLessThanOrEqual(18)
  })

  test('pickFilterSelectDims 最多 8 个，强维在前', () => {
    const dims: CsvColumnMeta[] = [
      { name: 'is_x', sql_name: 'is_x', type: 'text', role: 'dimension', unique_count: 2 },
      { name: 'fcat', sql_name: 'fcat', type: 'text', role: 'dimension', unique_count: 8 },
      { name: 'module', sql_name: 'module', type: 'text', role: 'dimension', unique_count: 12 },
      { name: 'owner', sql_name: 'owner', type: 'text', role: 'dimension', unique_count: 4 },
      { name: 'geo_tag', sql_name: 'geo_tag', type: 'text', role: 'dimension', unique_count: 3 },
      { name: 'status', sql_name: 'status', type: 'text', role: 'dimension', unique_count: 5 },
      { name: 'region', sql_name: 'region', type: 'text', role: 'dimension', unique_count: 6 },
      { name: 'platform', sql_name: 'platform', type: 'text', role: 'dimension', unique_count: 4 },
      { name: 'channel', sql_name: 'channel', type: 'text', role: 'dimension', unique_count: 7 },
      { name: 'brand', sql_name: 'brand', type: 'text', role: 'dimension', unique_count: 5 },
    ]
    const picked = pickFilterSelectDims(dims, 8)
    expect(picked.length).toBe(8)
    expect(picked[0]?.sql_name).not.toBe('is_x')
    expect(picked.map((d) => d.sql_name)).toContain('fcat')
  })
})
