/**
 * OS 文件拖放 — 从资源管理器拖入时的统一处理
 */

import { MAX_ATTACHMENT_SIZE } from '@tagent/shared'
import { toast } from 'sonner'

import { fileToBase64 } from '@/lib/file-utils'

export interface OsFileDropContext {
  workspaceSlug: string
  sessionId?: string
  target: 'session' | 'workspace'
  /** 拖入文件：复制到工作区/会话目录（默认）或按路径附加 */
  fileDropMode?: 'copy' | 'attach'
  onFilesUploaded: () => void
  onFilesAttached?: (filePaths: string[]) => Promise<void> | void
  onFoldersDropped: (folderPaths: string[]) => void
}

async function saveDroppedFiles(
  files: globalThis.File[],
  ctx: OsFileDropContext
): Promise<void> {
  if (files.length === 0) return
  const isWorkspace = ctx.target === 'workspace'
  if (!isWorkspace && !ctx.sessionId) return

  const oversized: string[] = []
  const okFiles = files.filter((f) => {
    if (f.size > MAX_ATTACHMENT_SIZE) {
      oversized.push(f.name)
      return false
    }
    return true
  })

  if (oversized.length > 0) {
    toast.error(`以下文件超过 100MB，已跳过：${oversized.join('、')}`)
  }
  if (okFiles.length === 0) return

  const fileEntries = await Promise.all(
    okFiles.map(async (file) => ({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: await fileToBase64(file),
    }))
  )

  if (isWorkspace) {
    await window.electronAPI.saveFilesToWorkspaceFiles({
      workspaceSlug: ctx.workspaceSlug,
      files: fileEntries,
    })
  } else {
    await window.electronAPI.saveFilesToAgentSession({
      workspaceSlug: ctx.workspaceSlug,
      sessionId: ctx.sessionId!,
      files: fileEntries,
    })
  }

  ctx.onFilesUploaded()
  toast.success(`已添加 ${okFiles.length} 个文件`)
}

/** 智能路由：文件复制/附加，文件夹附加 */
export async function processOsFileDrop(
  e: React.DragEvent,
  ctx: OsFileDropContext
): Promise<void> {
  e.preventDefault()
  e.stopPropagation()

  const droppedFiles = Array.from(e.dataTransfer.files)
  if (droppedFiles.length === 0) return

  const pathMap = new Map<string, globalThis.File>()
  const paths: string[] = []
  for (const file of droppedFiles) {
    try {
      const path = window.electronAPI.getPathForFile(file)
      if (path) {
        paths.push(path)
        pathMap.set(path, file)
      }
    } catch {
      /* 无法解析路径时忽略 */
    }
  }

  if (paths.length > 0) {
    try {
      const { directories, files: filePaths } = await window.electronAPI.checkPathsType(paths)

      if (filePaths.length > 0) {
        const attachFiles = ctx.fileDropMode === 'attach' && ctx.onFilesAttached
        if (attachFiles) {
          await ctx.onFilesAttached!(filePaths)
          toast.success(`已附加 ${filePaths.length} 个文件`)
        } else {
          const regularFiles = filePaths.flatMap((p) => {
            const f = pathMap.get(p)
            return f ? [f] : []
          })
          if (regularFiles.length > 0) {
            await saveDroppedFiles(regularFiles, ctx)
          }
        }
      }

      if (directories.length > 0) {
        ctx.onFoldersDropped(directories)
      }
      return
    } catch (error) {
      console.error('[OS 文件拖放] 路径检测失败，回退为直接上传:', error)
    }
  }

  await saveDroppedFiles(droppedFiles, ctx)
}
