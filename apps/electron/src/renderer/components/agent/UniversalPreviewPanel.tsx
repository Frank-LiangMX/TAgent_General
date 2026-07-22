/**
 * UniversalPreviewPanel — 右栏「预览」统一入口
 *
 * 与分屏 PreviewPanel 共用 previewFileMapAtom：
 * - url 模式 → WebPreviewFrame
 * - file 模式 → DiffTabContent（内嵌同一路由）
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'
import { FileSearch } from 'lucide-react'

import { agentSessionPathMapAtom, currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import {
  getPreviewDisplayTitle,
  isUrlPreview,
  previewFileMapAtom,
} from '@/atoms/preview-atoms'
import { WebPreviewFrame } from '@/components/agent/WebPreviewFrame'
import { DiffTabContent } from '@/components/diff/DiffTabContent'

function getFallbackDirPath(filePath: string, sessionPath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return lastSep > 0 ? filePath.slice(0, lastSep) : sessionPath
}

export function UniversalPreviewPanel(): React.ReactElement {
  const sessionId = useAtomValue(currentAgentSessionIdAtom)
  const fileMap = useAtomValue(previewFileMapAtom)
  const sessionPathMap = useAtomValue(agentSessionPathMapAtom)

  const preview = sessionId ? (fileMap.get(sessionId) ?? null) : null
  const sessionPath = sessionId ? (sessionPathMap.get(sessionId) ?? '') : ''

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-xs text-muted-foreground">
        选择会话后可预览文件或网页
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
        <FileSearch size={28} className="opacity-40" />
        <p className="text-center text-xs">点击消息中的文件路径或 CSV 看板卡片打开预览</p>
      </div>
    )
  }

  if (isUrlPreview(preview) && preview.url) {
    return (
      <WebPreviewFrame
        key={`${sessionId}:${preview.url}:${preview.reloadNonce ?? 0}`}
        agentSessionId={sessionId}
        initialUrl={preview.url}
        csvSessionId={preview.csvSessionId ?? null}
        filePath={preview.filePath ?? null}
        title={preview.title ?? getPreviewDisplayTitle(preview)}
        reloadNonce={preview.reloadNonce}
        showToolbar
      />
    )
  }

  if (!preview.filePath) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-xs text-muted-foreground">
        预览数据不完整
      </div>
    )
  }

  const dirPath =
    preview.dirPath || sessionPath || getFallbackDirPath(preview.filePath, sessionPath)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-content-area">
      <div className="flex h-8 shrink-0 items-center border-b border-border/30 px-3">
        <span className="truncate text-xs text-muted-foreground">
          {getPreviewDisplayTitle(preview)}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <DiffTabContent
          key={`${sessionId}:${preview.filePath}`}
          filePath={preview.filePath}
          dirPath={dirPath}
          sessionId={sessionId}
          gitRoot={preview.gitRoot}
          previewOnly={preview.previewOnly ?? true}
          readOnly={preview.readOnly}
          basePaths={preview.basePaths}
          baseRef={preview.baseRef}
        />
      </div>
    </div>
  )
}
