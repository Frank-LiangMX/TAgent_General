/**
 * 统一预览入口 — 按 previewModePreferenceAtom 路由到 Tab 或右侧分屏。
 *
 * 用户仍可通过拖拽 preview Tab 出 TabBar、PreviewPanel / PreviewTabContent 顶栏按钮即时切换；
 * 本模块仅控制「下次打开」的默认行为。
 */

import * as React from 'react'
import { useStore } from 'jotai'

import {
  previewFileMapAtom,
  previewModePreferenceAtom,
  previewPanelOpenMapAtom,
  type PreviewFile,
} from '@/atoms/preview-atoms'
import {
  activeTabIdAtom,
  closeTab,
  getPreviewTabTitle,
  isPreviewTab,
  openTab,
  sessionViewStateMapAtom,
  tabsAtom,
} from '@/atoms/tab-atoms'

type JotaiStore = ReturnType<typeof useStore>

/** 按用户偏好打开预览（供非 Hook 组件通过 store 调用） */
export function openPreview(store: JotaiStore, sessionId: string, file: PreviewFile): void {
  store.set(previewFileMapAtom, (prev) => {
    const m = new Map(prev)
    m.set(sessionId, file)
    return m
  })

  const preferSplit = store.get(previewModePreferenceAtom) === 'split'

  if (preferSplit) {
    store.set(previewPanelOpenMapAtom, (prev) => {
      const m = new Map(prev)
      m.set(sessionId, true)
      return m
    })
    return
  }

  store.set(previewPanelOpenMapAtom, (prev) => {
    const m = new Map(prev)
    m.set(sessionId, false)
    return m
  })
  const result = openTab(store.get(tabsAtom), {
    type: 'preview',
    sessionId,
    title: getPreviewTabTitle(file.filePath),
  })
  store.set(tabsAtom, result.tabs)
  store.set(activeTabIdAtom, result.activeTabId)
}

export function useOpenPreview(): (sessionId: string, file: PreviewFile) => void {
  const store = useStore()
  return React.useCallback((sessionId: string, file: PreviewFile) => {
    openPreview(store, sessionId, file)
  }, [store])
}

/** 把 preview Tab 即时切换为右侧分屏（拖拽 tear-off / 顶栏按钮共用） */
export function tearOffPreviewToSplit(store: JotaiStore, tabId: string): void {
  const tabs = store.get(tabsAtom)
  const tab = tabs.find((t) => t.id === tabId)
  if (!tab || !isPreviewTab(tab)) return

  const sessionId = tab.sessionId
  const agentTab = tabs.find((t) => t.type === 'agent' && t.sessionId === sessionId)
  if (!agentTab) return

  const closed = closeTab(store.get(tabsAtom), store.get(activeTabIdAtom), tabId)
  store.set(tabsAtom, closed.tabs)
  store.set(activeTabIdAtom, agentTab.id)

  store.set(sessionViewStateMapAtom, (prev) => {
    const m = new Map(prev)
    m.set(sessionId, { previewTabOpen: false, lastView: 'session' })
    return m
  })

  store.set(previewPanelOpenMapAtom, (prev) => {
    const m = new Map(prev)
    m.set(sessionId, true)
    return m
  })
}
