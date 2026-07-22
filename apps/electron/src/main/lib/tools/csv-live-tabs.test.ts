/**
 * CSV AI 内存 Tab 存储测试
 */

import { describe, expect, test, afterEach } from 'vitest'
import {
  clearLiveTabs,
  listLiveTabs,
  removeLiveTab,
  resetLiveTabsStore,
  upsertLiveTab,
} from './csv-live-tabs'

describe('csv-live-tabs 内存存储', () => {
  const SESSION = 'test-live-tabs'

  afterEach(() => {
    resetLiveTabsStore()
  })

  test('upsert 同 id 替换', () => {
    upsertLiveTab(SESSION, { id: 'tab-a', label: '贴图', sectionsHtml: '<div>A</div>' })
    upsertLiveTab(SESSION, { id: 'tab-a', label: '贴图2', sectionsHtml: '<div>B</div>' })
    const tabs = listLiveTabs(SESSION)
    expect(tabs).toHaveLength(1)
    expect(tabs[0]?.label).toBe('贴图2')
    expect(tabs[0]?.sectionsHtml).toContain('B')
  })

  test('remove 与 clear', () => {
    upsertLiveTab(SESSION, { id: 't1', label: 'T1', sectionsHtml: '<div>1</div>' })
    upsertLiveTab(SESSION, { id: 't2', label: 'T2', sectionsHtml: '<div>2</div>' })
    expect(removeLiveTab(SESSION, 't1')).toBe(true)
    expect(listLiveTabs(SESSION)).toHaveLength(1)
    expect(clearLiveTabs(SESSION)).toBe(1)
    expect(listLiveTabs(SESSION)).toHaveLength(0)
  })
})
