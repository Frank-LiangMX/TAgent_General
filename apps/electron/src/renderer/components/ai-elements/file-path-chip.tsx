/**
 * FilePathChip — 文件路径可点击芯片
 *
 * 已迁入 @tagent/ui，此文件保留为 re-export + 回调注入。
 */

import { useStore } from 'jotai'

import { isAbsoluteFilePath } from '@tagent/shared'
import { FilePathChip as BaseFilePathChip } from '@tagent/ui'

import type { ComponentProps } from 'react'

import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { openPreview } from '@/components/diff/preview-opener'
import { FileTypeIcon } from '@/components/file-browser/FileTypeIcon'
import { getFileParentPath } from '@/lib/file-utils'

export type FilePathChipProps = ComponentProps<typeof BaseFilePathChip>

/** 合并候选 base，并为绝对路径附上父目录（Agent 写在附件旁的文件可预览） */
function mergeBasePaths(path: string, bases?: string[]): string[] | undefined {
  const merged: string[] = []
  const seen = new Set<string>()
  const push = (p: string | null | undefined) => {
    if (!p || seen.has(p)) return
    seen.add(p)
    merged.push(p)
  }
  for (const b of bases ?? []) push(b)
  if (isAbsoluteFilePath(path)) push(getFileParentPath(path))
  return merged.length > 0 ? merged : undefined
}

export function FilePathChip(props: FilePathChipProps) {
  const store = useStore()

  const handleResolveFile = async (path: string, bases?: string[]): Promise<string | null> => {
    const sessionId = store.get(currentAgentSessionIdAtom)
    const result = await window.electronAPI.resolveFilePath(path, {
      sessionId: sessionId ?? undefined,
      candidateBasePaths: mergeBasePaths(path, bases),
    })
    return typeof result === 'string' ? result : (result?.url ?? null)
  }

  const handleOpenFile = (filePath: string, options?: { basePaths?: string[] }) => {
    const sessionId = store.get(currentAgentSessionIdAtom)
    if (!sessionId) return
    openPreview(store, sessionId, {
      filePath,
      previewOnly: true,
      basePaths: mergeBasePaths(filePath, options?.basePaths),
    })
  }

  const handleGetSessionId = () => store.get(currentAgentSessionIdAtom)

  return (
    <BaseFilePathChip
      {...props}
      onResolveFile={props.onResolveFile ?? handleResolveFile}
      onOpenFile={props.onOpenFile ?? handleOpenFile}
      getSessionId={props.getSessionId ?? handleGetSessionId}
      FileIcon={
        props.FileIcon ??
        (FileTypeIcon as React.ComponentType<{
          name: string
          isDirectory?: boolean
          size?: number
        }>)
      }
    />
  )
}

// 重新导出纯工具函数
export {
  isAbsoluteFilePath,
  isRelativeFilePath,
  stripLineCol,
  getFileName,
  getExtension,
} from '@tagent/shared'
