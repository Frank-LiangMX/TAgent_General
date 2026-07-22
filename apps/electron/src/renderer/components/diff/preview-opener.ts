/**
 * 统一预览入口 — 按 previewModePreferenceAtom 路由到 Tab 或右侧分屏。
 *
 * 支持本地文件（DiffTabContent）与网页 URL（WebPreviewFrame，含 CSV live dashboard）。
 */

import * as React from 'react'
import { useStore } from 'jotai'

import {
  getPreviewDisplayTitle,
  previewFileMapAtom,
  previewModePreferenceAtom,
  previewPanelOpenMapAtom,
  type PreviewFile,
} from '@/atoms/preview-atoms'
import {
  activeTabIdAtom,
  closeTab,
  getPreviewTabTitleFromPreview,
  isPreviewTab,
  openTab,
  sessionViewStateMapAtom,
  tabsAtom,
} from '@/atoms/tab-atoms'

type JotaiStore = ReturnType<typeof useStore>

export interface UrlPreviewInput {
  url: string
  title?: string | null
  csvSessionId?: string | null
  filePath?: string | null
  reloadNonce?: number
}

/** 打开预览面板（Tab 或分屏，取决于用户偏好） */
function openPreviewState(
  store: JotaiStore,
  sessionId: string,
  preview: PreviewFile,
  tabTitle: string
): void {
  store.set(previewFileMapAtom, (prev) => {
    const m = new Map(prev)
    m.set(sessionId, preview)
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
    title: tabTitle,
  })
  store.set(tabsAtom, result.tabs)
  store.set(activeTabIdAtom, result.activeTabId)
}

/** 按用户偏好打开本地文件预览 */
export function openPreview(store: JotaiStore, sessionId: string, file: PreviewFile): void {
  const preview: PreviewFile = {
    ...file,
    kind: 'file',
  }
  if (!preview.filePath) {
    console.warn('[openPreview] 缺少 filePath')
    return
  }
  openPreviewState(store, sessionId, preview, getPreviewTabTitleFromPreview(preview))
}

/** 打开网页 / CSV live dashboard 预览（与会话分屏或 Tab 同一壳） */
export function openUrlPreview(
  store: JotaiStore,
  sessionId: string,
  input: UrlPreviewInput
): void {
  const url = input.url.trim()
  if (!sessionId || !url) {
    console.warn('[openUrlPreview] 缺少 sessionId 或 url')
    return
  }

  const prev = store.get(previewFileMapAtom).get(sessionId)
  const reloadNonce =
    input.reloadNonce ??
    (prev?.csvSessionId === input.csvSessionId && prev?.reloadNonce != null
      ? prev.reloadNonce + 1
      : 1)

  const preview: PreviewFile = {
    kind: 'url',
    url,
    title: input.title?.trim() || undefined,
    csvSessionId: input.csvSessionId ?? undefined,
    filePath: input.filePath ?? undefined,
    reloadNonce,
    previewOnly: true,
    readOnly: true,
  }

  const tabTitle = `预览：${getPreviewDisplayTitle(preview)}`
  openPreviewState(store, sessionId, preview, tabTitle)
}

export function useOpenPreview(): (sessionId: string, file: PreviewFile) => void {
  const store = useStore()
  return React.useCallback(
    (sessionId: string, file: PreviewFile) => {
      openPreview(store, sessionId, file)
    },
    [store]
  )
}

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
