/**
 * csv_dashboard 多 view 软上限与 HTML 结构测试
 */
import { describe, expect, test } from 'bun:test'
import { MAX_DASHBOARD_VIEWS } from './csv-dashboard-tool'

describe('csv-dashboard view cap', () => {
  test('MAX_DASHBOARD_VIEWS 为合理软上限', () => {
    expect(MAX_DASHBOARD_VIEWS).toBeGreaterThanOrEqual(8)
    expect(MAX_DASHBOARD_VIEWS).toBeLessThanOrEqual(12)
  })
})
