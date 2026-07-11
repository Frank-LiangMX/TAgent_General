/**
 * FilePathChip — 文件路径可点击芯片
 *
 * 已迁入 @tagent/ui，此文件保留为 re-export + 回调注入。
 */

import { useStore } from 'jotai'

import { FilePathChip as BaseFilePathChip } from '@tagent/ui'

import type { ComponentProps } from 'react'

import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { openPreview } from '@/components/diff/preview-opener'
import { FileTypeIcon } from '@/components/file-browser/FileTypeIcon'

interface FilePathChipProps extends ComponentProps<typeof BaseFilePathChip> {}

export function FilePathChip(props: FilePathChipProps) {
  const store = useStore()

  const handleResolveFile = async (path: string, bases?: string[]): Promise<string | null> => {
    const sessionId = store.get(currentAgentSessionIdAtom)
    return window.electronAPI.resolveFilePath(path, {
      sessionId: sessionId ?? undefined,
      candidateBasePaths: bases,
    })
  }

  const handleOpenFile = (filePath: string, options?: { basePaths?: string[] }) => {
    const sessionId = store.get(currentAgentSessionIdAtom)
    if (!sessionId) return
    openPreview(store, sessionId, {
      filePath,
      previewOnly: true,
      basePaths: options?.basePaths,
    })
  }

  const handleGetSessionId = () => store.get(currentAgentSessionIdAtom)

  return (
    <BaseFilePathChip
      {...props}
      onResolveFile={props.onResolveFile ?? handleResolveFile}
      onOpenFile={props.onOpenFile ?? handleOpenFile}
      getSessionId={props.getSessionId ?? handleGetSessionId}
      FileIcon={props.FileIcon ?? FileTypeIcon}
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
