/**
 * useWorkspaceFileDrop — 工作区文件页 OS 拖放（左栏树 + 右栏预览共用）
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'

import {
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  workspaceAttachedDirectoriesMapAtom,
  workspaceAttachedFilesMapAtom,
  workspaceFilesVersionAtom,
} from '@/atoms/agent-atoms'
import { useOsFileDrop } from '@/lib/use-os-file-drop'

export interface UseWorkspaceFileDropResult {
  workspaceSlug: string | null
  isDragOver: boolean
  dropZoneProps: ReturnType<typeof useOsFileDrop>['dropZoneProps']
  handleFilesUploaded: () => void
  handleFilesAttached: (filePaths: string[]) => Promise<void>
  handleAttachFolder: () => Promise<void>
  handleFoldersDropped: (folderPaths: string[]) => Promise<void>
}

/** Electron：必须在窗口级 dragover 上 preventDefault，否则子区域收不到 drop */
function useElectronFileDropGuard(enabled: boolean): void {
  React.useEffect(() => {
    if (!enabled) return

    const onDragOver = (event: DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
    }

    window.addEventListener('dragover', onDragOver)
    return () => window.removeEventListener('dragover', onDragOver)
  }, [enabled])
}

export function useWorkspaceFileDrop(): UseWorkspaceFileDropResult {
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const workspaceSlug = workspaces.find((w) => w.id === currentWorkspaceId)?.slug ?? null

  const setWsAttachedDirsMap = useSetAtom(workspaceAttachedDirectoriesMapAtom)
  const setWsAttachedFilesMap = useSetAtom(workspaceAttachedFilesMapAtom)
  const setFilesVersion = useSetAtom(workspaceFilesVersionAtom)

  const attachWorkspaceDir = React.useCallback(
    async (dirPath: string) => {
      if (!workspaceSlug || !currentWorkspaceId) return
      const updated = await window.electronAPI.attachWorkspaceDirectory({
        workspaceSlug,
        directoryPath: dirPath,
      })
      setWsAttachedDirsMap((prev) => {
        const map = new Map(prev)
        map.set(currentWorkspaceId, updated)
        return map
      })
    },
    [workspaceSlug, currentWorkspaceId, setWsAttachedDirsMap]
  )

  const handleAttachFolder = React.useCallback(async () => {
    try {
      const result = await window.electronAPI.openFolderDialog()
      if (result) await attachWorkspaceDir(result.path)
    } catch (error) {
      console.error('[工作区文件拖放] 附加文件夹失败:', error)
    }
  }, [attachWorkspaceDir])

  const handleFoldersDropped = React.useCallback(
    async (folderPaths: string[]) => {
      for (const dirPath of folderPaths) {
        try {
          await attachWorkspaceDir(dirPath)
        } catch (error) {
          console.error('[工作区文件拖放] 拖拽附加文件夹失败:', error)
        }
      }
    },
    [attachWorkspaceDir]
  )

  const attachWorkspaceFile = React.useCallback(
    async (filePath: string) => {
      if (!workspaceSlug || !currentWorkspaceId) return
      const updated = await window.electronAPI.attachWorkspaceFile({ workspaceSlug, filePath })
      setWsAttachedFilesMap((prev) => {
        const map = new Map(prev)
        map.set(currentWorkspaceId, updated)
        return map
      })
    },
    [workspaceSlug, currentWorkspaceId, setWsAttachedFilesMap]
  )

  const handleFilesAttached = React.useCallback(
    async (filePaths: string[]) => {
      for (const filePath of filePaths) {
        try {
          await attachWorkspaceFile(filePath)
        } catch (error) {
          console.error('[工作区文件拖放] 附加文件失败:', error)
        }
      }
    },
    [attachWorkspaceFile]
  )

  const handleFilesUploaded = React.useCallback(() => {
    setFilesVersion((prev) => prev + 1)
  }, [setFilesVersion])

  const enabled = !!workspaceSlug
  useElectronFileDropGuard(enabled)

  const { isDragOver, dropZoneProps } = useOsFileDrop(
    {
      workspaceSlug: workspaceSlug ?? '',
      target: 'workspace',
      fileDropMode: 'copy',
      onFilesUploaded: handleFilesUploaded,
      onFilesAttached: handleFilesAttached,
      onFoldersDropped: handleFoldersDropped,
    },
    !enabled
  )

  return {
    workspaceSlug,
    isDragOver,
    dropZoneProps,
    handleFilesUploaded,
    handleFilesAttached,
    handleAttachFolder,
    handleFoldersDropped,
  }
}
