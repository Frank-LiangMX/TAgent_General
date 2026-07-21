import { describe, expect, test } from 'vitest'

import type { TabItem } from './tab-atoms'

import { closeTab, createRailTabId, getPersistableTabState, openTab } from './tab-atoms'

function sessionTab(sessionId: string, title: string): TabItem {
  return {
    id: sessionId,
    type: 'agent',
    sessionId,
    title,
    mode: 'general',
  }
}

describe('rail 附属标签分组', () => {
  test('Given 两个会话 When 会话 A 晋升多个右栏分页 Then 子标签连续插在 A 后且不影响 B', () => {
    const initial = [sessionTab('session-a', '会话 A'), sessionTab('session-b', '会话 B')]

    const withFiles = openTab(initial, {
      type: 'rail',
      sessionId: 'session-a',
      railItem: 'files',
      title: '文件',
    })
    const withCrew = openTab(withFiles.tabs, {
      type: 'rail',
      sessionId: 'session-a',
      railItem: 'crew',
      title: '班组',
    })

    expect(withCrew.tabs.map((tab) => tab.id)).toEqual([
      'session-a',
      createRailTabId('session-a', 'files'),
      createRailTabId('session-a', 'crew'),
      'session-b',
    ])
    expect(withCrew.tabs[1]).toMatchObject({
      type: 'rail',
      sessionId: 'session-a',
      railItem: 'files',
    })
  })

  test('Given 会话已有附属标签 When 关闭父会话 Then 同会话附属标签一并关闭', () => {
    const initial = [sessionTab('session-a', '会话 A'), sessionTab('session-b', '会话 B')]
    const withChild = openTab(initial, {
      type: 'rail',
      sessionId: 'session-a',
      railItem: 'design',
      title: '设计',
    })

    const result = closeTab(withChild.tabs, withChild.activeTabId, 'session-a')

    expect(result.tabs.map((tab) => tab.id)).toEqual(['session-b'])
    expect(result.activeTabId).toBe('session-b')
  })

  test('Given 两个会话都晋升文件分页 When 关闭会话 A Then 只清理 A 的文件标签', () => {
    const initial = [sessionTab('session-a', '会话 A'), sessionTab('session-b', '会话 B')]
    const withA = openTab(initial, {
      type: 'rail',
      sessionId: 'session-a',
      railItem: 'files',
      title: '文件',
    })
    const withBoth = openTab(withA.tabs, {
      type: 'rail',
      sessionId: 'session-b',
      railItem: 'files',
      title: '文件',
    })

    const result = closeTab(withBoth.tabs, withBoth.activeTabId, 'session-a')

    expect(result.tabs.map((tab) => tab.id)).toEqual([
      'session-b',
      createRailTabId('session-b', 'files'),
    ])
    expect(result.activeTabId).toBe(createRailTabId('session-b', 'files'))
  })

  test('Given 激活附属标签 When 单独关闭它 Then 返回父会话且不关闭父会话', () => {
    const parent = sessionTab('session-a', '会话 A')
    const withChild = openTab([parent], {
      type: 'rail',
      sessionId: 'session-a',
      railItem: 'browser',
      title: '预览',
    })

    const result = closeTab(withChild.tabs, withChild.activeTabId, withChild.activeTabId)

    expect(result.tabs).toEqual([parent])
    expect(result.activeTabId).toBe('session-a')
  })

  test('Given 附属标签处于激活态 When 保存标签状态 Then 持久化父会话为激活项', () => {
    const parent = sessionTab('session-a', '会话 A')
    const withChild = openTab([parent], {
      type: 'rail',
      sessionId: 'session-a',
      railItem: 'btw',
      title: '旁注',
    })

    expect(getPersistableTabState(withChild.tabs, withChild.activeTabId)).toEqual({
      tabs: [parent],
      activeTabId: 'session-a',
    })
  })
})
