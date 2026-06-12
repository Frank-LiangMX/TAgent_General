/**
 * WorkspaceFileInspector — 文件功能区主区检视面板
 *
 * 侧栏 Navigator 选中文件/目录后，主区展示预览与操作。
 */

import { useAtomValue } from 'jotai'
import {
  ExternalLink,
  File,
  FolderOpen,
  FolderSearch,
  Loader2,
} from 'lucide-react'
import * as React from 'react'

import {
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  workspaceAttachedDirectoriesMapAtom,
} from '@/atoms/agent-atoms'
import {
  workspaceSelectedDirectoryAtom,
  workspaceSelectedFileAtom,
} from '@/atoms/workspace-explorer'
import { isImageFile } from '@/components/agent/SDKMessageRenderer'
import { FileTypeIcon } from '@/components/file-browser'
import { RailInspectorHeader } from '@/components/app-shell/RailInspectorHeader'
import { Button } from '@/components/ui/button'
const TEXT_PREVIEW_MAX_BYTES = 256 * 1024

function getPathBasename(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath
}

function buildPathCrumbs(targetPath: string, workspaceName: string): { label: string }[] {
  const segments = targetPath.split(/[\\/]/).filter(Boolean)
  const crumbs = [{ label: workspaceName }]
  const tail = segments.slice(-3)
  for (const segment of tail) {
    crumbs.push({ label: segment })
  }
  return crumbs
}

export function WorkspaceFileInspector(): React.ReactElement {
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null
  const wsAttachedDirsMap = useAtomValue(workspaceAttachedDirectoriesMapAtom)
  const attachedDirs = currentWorkspaceId
    ? (wsAttachedDirsMap.get(currentWorkspaceId) ?? [])
    : []

  const selectedFile = useAtomValue(workspaceSelectedFileAtom)
  const selectedDirectory = useAtomValue(workspaceSelectedDirectoryAtom)

  const [workspaceFilesPath, setWorkspaceFilesPath] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!workspace?.slug) {
      setWorkspaceFilesPath(null)
      return
    }
    window.electronAPI.getWorkspaceFilesPath(workspace.slug).then(setWorkspaceFilesPath).catch(() => {
      setWorkspaceFilesPath(null)
    })
  }, [workspace?.slug])

  if (!workspace) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-8">
        <EmptyState
          icon={<FolderOpen size={28} className="text-muted-foreground/40" />}
          title="选择一个工作区"
          description="在侧栏选择工作区后，即可浏览并预览文件。"
        />
      </div>
    )
  }

  if (!selectedFile && !selectedDirectory) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-8">
        <EmptyState
          icon={<File size={28} className="text-muted-foreground/40" />}
          title="从左侧选择文件"
          description="单击文件可在主区预览；双击将在系统中打开。目录会显示内容概览。"
        />
      </div>
    )
  }

  if (selectedDirectory) {
    return (
      <DirectoryInspector
        workspaceName={workspace.name}
        dirPath={selectedDirectory}
        workspaceFilesPath={workspaceFilesPath}
        attachedDirs={attachedDirs}
      />
    )
  }

  return (
    <FileInspector
      workspaceName={workspace.name}
      filePath={selectedFile!}
      workspaceFilesPath={workspaceFilesPath}
      attachedDirs={attachedDirs}
    />
  )
}

function FileInspector({
  workspaceName,
  filePath,
  workspaceFilesPath,
  attachedDirs,
}: {
  workspaceName: string
  filePath: string
  workspaceFilesPath: string | null
  attachedDirs: string[]
}): React.ReactElement {
  const fileName = getPathBasename(filePath)
  const isImage = isImageFile(fileName)
  const [loading, setLoading] = React.useState(true)
  const [content, setContent] = React.useState<string | null>(null)
  const [resolvedPath, setResolvedPath] = React.useState<string | null>(null)
  const [imageSrc, setImageSrc] = React.useState<string | null>(null)
  const [tooLarge, setTooLarge] = React.useState(false)

  const candidateBasePaths = React.useMemo(() => {
    const paths = [...attachedDirs]
    if (workspaceFilesPath) paths.push(workspaceFilesPath)
    return paths
  }, [attachedDirs, workspaceFilesPath])

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    setContent(null)
    setImageSrc(null)
    setTooLarge(false)
    setResolvedPath(null)

    if (isImage) {
      setResolvedPath(filePath)
      setImageSrc(`file://${filePath.replace(/\\/g, '/')}`)
      setLoading(false)
      return () => { alive = false }
    }

    window.electronAPI
      .resolveAndReadFile(filePath, { candidateBasePaths })
      .then((result) => {
        if (!alive) return
        if (!result) {
          setContent(null)
          return
        }
        setResolvedPath(result.resolvedPath)
        if (result.content.length > TEXT_PREVIEW_MAX_BYTES) {
          setTooLarge(true)
          return
        }
        setContent(result.content)
      })
      .catch((err) => {
        if (!alive) return
        console.error('[WorkspaceFileInspector] 读取文件失败:', err)
        setContent(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => { alive = false }
  }, [filePath, candidateBasePaths, isImage])

  const crumbs = buildPathCrumbs(filePath, workspaceName)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RailInspectorHeader
        crumbs={crumbs}
        title={fileName}
        description={resolvedPath ?? filePath}
        actions={(
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => window.electronAPI.openFile(filePath).catch(console.error)}
            >
              <ExternalLink size={14} />
              <span className="ml-1.5">打开</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => window.electronAPI.showInFolder(filePath).catch(console.error)}
            >
              <FolderSearch size={14} />
              <span className="ml-1.5">在文件夹中显示</span>
            </Button>
          </>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            正在加载预览…
          </div>
        ) : isImage && imageSrc ? (
          <div className="flex justify-center">
            <img
              src={imageSrc}
              alt={fileName}
              className="max-h-[min(70vh,640px)] max-w-full rounded-xl border border-border/50 object-contain shadow-sm"
            />
          </div>
        ) : tooLarge ? (
          <PreviewFallback
            icon={<FileTypeIcon name={fileName} isDirectory={false} />}
            title="文件较大"
            description="此文件超过预览大小限制，请使用「打开」在系统中查看。"
          />
        ) : content != null ? (
          <pre className="overflow-x-auto rounded-xl border border-border/50 bg-muted/25 p-4 font-mono text-xs leading-6 text-foreground/90">
            {content}
          </pre>
        ) : (
          <PreviewFallback
            icon={<FileTypeIcon name={fileName} isDirectory={false} />}
            title="无法预览"
            description="此文件类型暂不支持内联预览，可使用「打开」在默认应用中查看。"
          />
        )}
      </div>
    </div>
  )
}

function DirectoryInspector({
  workspaceName,
  dirPath,
  workspaceFilesPath,
  attachedDirs,
}: {
  workspaceName: string
  dirPath: string
  workspaceFilesPath: string | null
  attachedDirs: string[]
}): React.ReactElement {
  const dirName = getPathBasename(dirPath)
  const [loading, setLoading] = React.useState(true)
  const [entries, setEntries] = React.useState<{ name: string; isDirectory: boolean }[]>([])

  const isAttached = attachedDirs.some((d) => dirPath === d || dirPath.startsWith(`${d}/`) || dirPath.startsWith(`${d}\\`))

  React.useEffect(() => {
    let alive = true
    setLoading(true)

    const listPromise = isAttached
      ? window.electronAPI.listAttachedDirectory(dirPath, { sessionId: '', candidateBasePaths: undefined })
      : window.electronAPI.listDirectory(dirPath)

    listPromise
      .then((items) => {
        if (!alive) return
        setEntries(items.map((item) => ({ name: item.name, isDirectory: item.isDirectory })))
      })
      .catch((err) => {
        if (!alive) return
        console.error('[WorkspaceFileInspector] 读取目录失败:', err)
        setEntries([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => { alive = false }
  }, [dirPath, isAttached])

  const crumbs = buildPathCrumbs(dirPath, workspaceName)
  const fileCount = entries.filter((e) => !e.isDirectory).length
  const folderCount = entries.filter((e) => e.isDirectory).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RailInspectorHeader
        crumbs={crumbs}
        title={dirName}
        description={dirPath}
        actions={(
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => window.electronAPI.openFile(dirPath).catch(console.error)}
          >
            <FolderOpen size={14} />
            <span className="ml-1.5">打开目录</span>
          </Button>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="mb-4 flex flex-wrap gap-2">
          <StatPill label="文件夹" value={String(folderCount)} />
          <StatPill label="文件" value={String(fileCount)} />
          {workspaceFilesPath && dirPath === workspaceFilesPath ? (
            <StatPill label="类型" value="工作区根目录" />
          ) : isAttached ? (
            <StatPill label="类型" value="附加目录" />
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            正在读取目录…
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">此目录为空。</p>
        ) : (
          <ul className="divide-y divide-border/40 rounded-xl border border-border/50 bg-muted/15">
            {entries.slice(0, 80).map((entry) => (
              <li
                key={entry.name}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground/85"
              >
                <FileTypeIcon name={entry.name} isDirectory={entry.isDirectory} />
                <span className="truncate">{entry.name}</span>
              </li>
            ))}
            {entries.length > 80 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                还有 {entries.length - 80} 项未显示…
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}): React.ReactElement {
  return (
    <div className="max-w-md rounded-2xl border border-dashed border-border/60 bg-muted/15 px-8 py-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/40">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function PreviewFallback({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}): React.ReactElement {
  return (
    <div className="flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border/60 bg-muted/15 px-6 py-8 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <h4 className="mt-3 text-sm font-medium text-foreground">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}
