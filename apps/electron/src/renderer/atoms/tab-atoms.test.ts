import { describe, expect, test } from 'vitest'

import type { TabItem } from './tab-atoms'

import { closeTab, getPersistableTabState, openTab } from './tab-atoms'

function sessionTab(sessionId: string, title: string): TabItem {
  return {
    id: sessionId,
    type: 'agent',
    sessionId,
    title,
    mode: 'general',
  }
}

describe('preview 附属标签', () => {
  test('Given 会话 When 打开预览 Then 预览紧跟父会话', () => {
    const initial = [sessionTab('session-a', '会话 A'), sessionTab('session-b', '会话 B')]
    const result = openTab(initial, {
      type: 'preview',
      sessionId: 'session-a',
      title: '预览：a.ts',
    })

    expect(result.tabs.map((tab) => tab.id)).toEqual([
      'session-a',
      '__preview__:session-a',
      'session-b',
    ])
    expect(result.activeTabId).toBe('__preview__:session-a')
  })

  test('Given 会话已有预览 When 关闭父会话 Then 预览一并关闭', () => {
    const withPreview = openTab([sessionTab('session-a', '会话 A')], {
      type: 'preview',
      sessionId: 'session-a',
      title: '预览：a.ts',
    })

    const result = closeTab(withPreview.tabs, withPreview.activeTabId, 'session-a')
    expect(result.tabs).toEqual([])
    expect(result.activeTabId).toBeNull()
  })

  test('Given 激活预览标签 When 保存标签状态 Then 持久化父会话为激活项', () => {
    const parent = sessionTab('session-a', '会话 A')
    const withPreview = openTab([parent], {
      type: 'preview',
      sessionId: 'session-a',
      title: '预览：a.ts',
    })

    expect(getPersistableTabState(withPreview.tabs, withPreview.activeTabId)).toEqual({
      tabs: [parent],
      activeTabId: 'session-a',
    })
  })
})
