/**
 * 统一预览入口 — 路由到右栏「预览」页（browser）。
 *
 * 支持本地文件（DiffTabContent）与网页 URL（WebPreviewFrame，含 CSV live dashboard）。
 * 历史上有「内联分屏 / 临时标签页」两套展示形态，现已统一收口到右栏预览页。
 */

import * as React from 'react'
import { useStore } from 'jotai'

import {
  previewFileMapAtom,
  type PreviewFile,
} from '@/atoms/preview-atoms'
import { setAgentSidePanelOpenForSession } from '@/atoms/agent-atoms'
import { setRightRailItemForSession } from '@/atoms/app-mode'

type JotaiStore = ReturnType<typeof useStore>

export interface UrlPreviewInput {
  url: string
  title?: string | null
  csvSessionId?: string | null
  filePath?: string | null
  reloadNonce?: number
}

/** 打开预览：写入预览数据 + 弹出右栏并选中「预览」页 */
function openPreviewState(
  store: JotaiStore,
  sessionId: string,
  preview: PreviewFile
): void {
  store.set(previewFileMapAtom, (prev) => {
    const m = new Map(prev)
    m.set(sessionId, preview)
    return m
  })

  // 统一路由到右栏预览页：选中 browser 项并展开右栏
  setRightRailItemForSession(store, sessionId, 'browser')
  setAgentSidePanelOpenForSession(store, sessionId, true)
}

/** 打开本地文件预览（路由到右栏预览页） */
export function openPreview(store: JotaiStore, sessionId: string, file: PreviewFile): void {
  const preview: PreviewFile = {
    ...file,
    kind: 'file',
  }
  if (!preview.filePath) {
    console.warn('[openPreview] 缺少 filePath')
    return
  }
  openPreviewState(store, sessionId, preview)
}

/** 打开网页 / CSV live dashboard 预览（路由到右栏预览页） */
export function openUrlPreview(store: JotaiStore, sessionId: string, input: UrlPreviewInput): void {
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

  openPreviewState(store, sessionId, preview)
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
