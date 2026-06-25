/**
 * WorkspaceFilesView — 工作区文件树（目录区「工作区」功能区内容）
 *
 * 与 SidePanel 中的 session 端文件面板共享数据底座（workspaceAttachedDirectoriesMapAtom /
 * workspaceAttachedFilesMapAtom / getWorkspaceFilesPath），但行为独立：
 * - 不依赖 sessionId
 * - 不显示"添加到聊天" / "在文件夹中显示"等会话级操作
 * - 拖拽附加与按钮附加都走工作区级 IPC
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { X, FolderSearch, ChevronRight, FolderOpen, Info } from 'lucide-react'
import * as React from 'react'

import type { FileEntry } from '@tagent/shared'

import {
  workspaceAttachedDirectoriesMapAtom,
  workspaceAttachedFilesMapAtom,
  workspaceFilesVersionAtom,
  currentAgentWorkspaceIdAtom,
  agentWorkspacesAtom,
} from '@/atoms/agent-atoms'
import {
  workspaceSelectedDirectoryAtom,
  workspaceSelectedFileAtom,
} from '@/atoms/workspace-explorer'
import {
  FileBrowser,
  FileDropZone,
  FileTypeIcon,
  FileSearchBar,
  computeTreeRowLayout,
  AncestorGuides,
  STICKY_ROW_BASE_CLASS,
  canBeSticky,
} from '@/components/file-browser'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollProgressContainer } from '@/components/ui/scroll-progress-container'
import { useWorkspaceFileDropActions } from '@/components/agent/WorkspaceFileDropSurface'
import { cn } from '@/lib/utils'

interface WorkspaceFilesViewProps {
  /** 唯一标识，用于 host 端的 React key（切换工作区时强制重建） */
  workspaceKey: string
  /** sidebar = 侧栏紧凑；navigator = 主从布局导航器；main = 宽屏（遗留） */
  layout?: 'sidebar' | 'navigator' | 'main'
}

const actionButtonClass =
  'h-6 w-6 flex-shrink-0 rounded-md text-muted-foreground/75 hover:bg-accent/70 hover:text-foreground [&_svg]:size-3.5'

function getPathBasename(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath
}

export function WorkspaceFilesView({
  workspaceKey,
  layout = 'sidebar',
}: WorkspaceFilesViewProps): React.ReactElement {
  // 当前工作区
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const workspaceName = workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? '工作区'
  const workspaceSlug = workspaces.find((w) => w.id === currentWorkspaceId)?.slug ?? null

  // 工作区级附加目录 / 文件
  const wsAttachedDirsMap = useAtomValue(workspaceAttachedDirectoriesMapAtom)
  const setWsAttachedDirsMap = useSetAtom(workspaceAttachedDirectoriesMapAtom)
  const wsAttachedDirs = currentWorkspaceId ? (wsAttachedDirsMap.get(currentWorkspaceId) ?? []) : []

  const wsAttachedFilesMap = useAtomValue(workspaceAttachedFilesMapAtom)
  const setWsAttachedFilesMap = useSetAtom(workspaceAttachedFilesMapAtom)
  const wsAttachedFiles = currentWorkspaceId
    ? (wsAttachedFilesMap.get(currentWorkspaceId) ?? [])
    : []

  // 加载工作区级附加目录
  React.useEffect(() => {
    if (!workspaceSlug || !currentWorkspaceId) return
    window.electronAPI
      .getWorkspaceDirectories(workspaceSlug)
      .then((dirs) => {
        setWsAttachedDirsMap((prev) => {
          const map = new Map(prev)
          map.set(currentWorkspaceId, dirs)
          return map
        })
      })
      .catch(console.error)
  }, [workspaceSlug, currentWorkspaceId, setWsAttachedDirsMap])

  // 加载工作区级附加文件
  React.useEffect(() => {
    if (!workspaceSlug || !currentWorkspaceId) return
    window.electronAPI
      .getWorkspaceAttachedFiles(workspaceSlug)
      .then((files) => {
        setWsAttachedFilesMap((prev) => {
          const map = new Map(prev)
          map.set(currentWorkspaceId, files)
          return map
        })
      })
      .catch(console.error)
  }, [workspaceSlug, currentWorkspaceId, setWsAttachedFilesMap])

  // 加载工作区文件目录路径
  const [workspaceFilesPath, setWorkspaceFilesPath] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!workspaceSlug) {
      setWorkspaceFilesPath(null)
      return
    }
    window.electronAPI
      .getWorkspaceFilesPath(workspaceSlug)
      .then(setWorkspaceFilesPath)
      .catch(() => setWorkspaceFilesPath(null))
  }, [workspaceSlug])

  const filesVersion = useAtomValue(workspaceFilesVersionAtom)
  const setFilesVersion = useSetAtom(workspaceFilesVersionAtom)
  const isNavigator = layout === 'navigator'
  const [selectedFile, setSelectedFile] = useAtom(workspaceSelectedFileAtom)
  const setSelectedDirectory = useSetAtom(workspaceSelectedDirectoryAtom)

  const handleOpenInOs = React.useCallback((filePath: string) => {
    window.electronAPI.openFile(filePath).catch(console.error)
  }, [])

  const handleInspectFile = React.useCallback(
    (filePath: string) => {
      setSelectedFile(filePath)
      setSelectedDirectory(null)
    },
    [setSelectedFile, setSelectedDirectory]
  )

  const handleInspectDirectory = React.useCallback(
    (dirPath: string) => {
      setSelectedDirectory(dirPath)
      setSelectedFile(null)
    },
    [setSelectedDirectory, setSelectedFile]
  )

  const handleFileActivate = React.useCallback(
    (filePath: string) => {
      if (isNavigator) {
        handleInspectFile(filePath)
        return
      }
      handleOpenInOs(filePath)
    },
    [handleInspectFile, handleOpenInOs, isNavigator]
  )

  // 附加 / 移除目录 — 拖放由外层 WorkspaceFileDropSurface 处理
  const { handleFilesUploaded, handleFilesAttached, handleAttachFolder, handleFoldersDropped } =
    useWorkspaceFileDropActions()

  const handleDetachDirectory = React.useCallback(
    async (dirPath: string) => {
      if (!workspaceSlug || !currentWorkspaceId) return
      try {
        const updated = await window.electronAPI.detachWorkspaceDirectory({
          workspaceSlug,
          directoryPath: dirPath,
        })
        setWsAttachedDirsMap((prev) => {
          const map = new Map(prev)
          if (updated.length > 0) {
            map.set(currentWorkspaceId, updated)
          } else {
            map.delete(currentWorkspaceId)
          }
          return map
        })
      } catch (error) {
        console.error('[WorkspaceFilesView] 移除附加目录失败:', error)
      }
    },
    [workspaceSlug, currentWorkspaceId, setWsAttachedDirsMap]
  )

  // 附加 / 移除文件
  const handleDetachFile = React.useCallback(
    async (filePath: string) => {
      if (!workspaceSlug || !currentWorkspaceId) return
      try {
        const updated = await window.electronAPI.detachWorkspaceFile({ workspaceSlug, filePath })
        setWsAttachedFilesMap((prev) => {
          const map = new Map(prev)
          if (updated.length > 0) {
            map.set(currentWorkspaceId, updated)
          } else {
            map.delete(currentWorkspaceId)
          }
          return map
        })
      } catch (error) {
        console.error('[WorkspaceFilesView] 移除附加文件失败:', error)
      }
    },
    [workspaceSlug, currentWorkspaceId, setWsAttachedFilesMap]
  )

  const breadcrumb = React.useMemo(() => {
    if (!workspaceFilesPath) return ''
    const parts = workspaceFilesPath.split('/').filter(Boolean)
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : workspaceFilesPath
  }, [workspaceFilesPath])

  const hasAttachedItems = wsAttachedDirs.length > 0 || wsAttachedFiles.length > 0

  // 切换工作区时强制重置内部状态（通过 key 实现）
  if (!currentWorkspaceId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs px-4 text-center">
        <FolderOpen size={24} className="mb-2 opacity-50" />
        <span>请先选择工作区</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'min-h-0',
        layout === 'main'
          ? 'flex h-full flex-col gap-5 px-6 pb-6 pt-10 xl:px-8'
          : layout === 'navigator'
            ? 'flex h-full min-h-0 flex-1 flex-col'
            : 'flex-1 flex flex-col pt-0.5 mx-2 mb-2'
      )}
      key={workspaceKey}
    >
      {/* Header */}
      {layout === 'navigator' ? (
        <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border/40 px-3">
          <FolderOpen size={12} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
            {workspaceName}
          </span>
        </div>
      ) : layout === 'main' ? (
        <div className="rounded-3xl border border-border/60 bg-card/90 px-5 py-4 shadow-sm shadow-foreground/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                <FolderOpen className="size-3.5" />
                <span>工作区文件</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{workspaceName}</h2>
                <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  main view
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                这里直接承接文件功能区的内容，但用更宽的主区排版展示，避免和 sidebar
                共享同一套紧凑样式。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {workspaceFilesPath && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.electronAPI.openFile(workspaceFilesPath).catch(console.error)
                      }
                    >
                      <FolderSearch size={14} />
                      <span className="ml-1">打开目录</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>在 Finder 中打开工作区文件目录</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <MiniStat label="附加目录" value={String(wsAttachedDirs.length)} />
            <MiniStat label="附加文件" value={String(wsAttachedFiles.length)} />
            <MiniStat label="工作区路径" value={breadcrumb || '未就绪'} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 px-2 h-[32px] flex-shrink-0">
          <FolderOpen className="size-3 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">工作区文件</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px]">
              <p>工作区内所有会话可访问的文件和文件夹，每个新对话都可以自动读取</p>
            </TooltipContent>
          </Tooltip>
          <span
            className="text-[10px] text-muted-foreground/70 truncate flex-1 min-w-0"
            title={workspaceFilesPath ?? ''}
          >
            {breadcrumb}
          </span>
          {workspaceFilesPath && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={actionButtonClass}
                  onClick={() =>
                    window.electronAPI.openFile(workspaceFilesPath).catch(console.error)
                  }
                >
                  <FolderSearch />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>在 Finder 中打开工作区文件目录</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* 搜索栏 */}
      <div
        className={cn(
          layout === 'main'
            ? 'rounded-2xl border border-border/60 bg-card/90 px-4 py-3 shadow-sm shadow-foreground/5'
            : '',
          layout === 'navigator' && 'shrink-0 border-b border-border/40 px-2 py-2'
        )}
      >
        <FileSearchBar
          workspaceFilesPath={workspaceFilesPath}
          sessionPath={null}
          sessionAttachedDirs={[]}
          workspaceAttachedDirs={wsAttachedDirs}
          placeholder="搜索工作区文件..."
          onFilePreview={handleFileActivate}
        />
      </div>

      {/* 文件列表 */}
      <ScrollProgressContainer
        className={cn(
          'min-h-0 flex-1',
          layout === 'main' &&
            'rounded-3xl border border-border/60 bg-card/90 shadow-sm shadow-foreground/5'
        )}
        contentClassName={cn('pb-1', layout === 'main' ? 'p-4' : '')}
      >
        {wsAttachedFiles.length > 0 && (
          <AttachedFilesSection
            attachedFiles={wsAttachedFiles}
            onDetach={handleDetachFile}
            onFilePreview={handleFileActivate}
          />
        )}
        {wsAttachedDirs.length > 0 && (
          <AttachedDirsSection
            attachedDirs={wsAttachedDirs}
            onDetach={handleDetachDirectory}
            refreshVersion={filesVersion}
            onFilePreview={handleFileActivate}
            inspectMode={isNavigator}
            onDirectoryInspect={handleInspectDirectory}
          />
        )}
        {workspaceFilesPath && (
          <>
            {hasAttachedItems && (
              <div className="text-[11px] font-medium text-muted-foreground mb-1 px-3 pt-2">
                工作文件（存储于该工作区目录）
              </div>
            )}
            <FileBrowser
              rootPath={workspaceFilesPath}
              hideToolbar
              embedded
              hideEmpty={hasAttachedItems}
              onFilePreview={handleOpenInOs}
              inspectMode={isNavigator}
              onFileInspect={handleInspectFile}
              onDirectoryInspect={handleInspectDirectory}
              inspectPath={isNavigator ? selectedFile : null}
            />
          </>
        )}
        <FileDropZone
          workspaceSlug={workspaceSlug ?? ''}
          target="workspace"
          onFilesUploaded={handleFilesUploaded}
          onFilesAttached={handleFilesAttached}
          onAttachFolder={handleAttachFolder}
          onFoldersDropped={handleFoldersDropped}
        />
      </ScrollProgressContainer>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/35 px-3 py-1.5 text-xs text-foreground/80">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}

// ===== 本地精简版：附加文件列表 =====

interface AttachedFilesSectionProps {
  attachedFiles: string[]
  onDetach: (filePath: string) => void
  onFilePreview?: (filePath: string) => void
}

function AttachedFilesSection({
  attachedFiles,
  onDetach,
  onFilePreview,
}: AttachedFilesSectionProps): React.ReactElement {
  return (
    <div className="pt-2.5 pb-1 flex-shrink-0">
      <div className="text-[11px] font-medium text-muted-foreground mb-1 px-3">
        附加文件（Agent 可以按原路径读取）
      </div>
      {attachedFiles.map((filePath) => {
        const name = getPathBasename(filePath)
        const entry: FileEntry = { name, path: filePath, isDirectory: false }
        return (
          <div
            key={filePath}
            className="flex items-center gap-1 py-1 pl-2 pr-2 text-sm cursor-pointer hover:bg-accent/50 group mx-2 rounded-lg"
            onClick={() => onFilePreview?.(filePath)}
          >
            <span className="w-3.5 flex-shrink-0" />
            <FileTypeIcon name={name} isDirectory={false} />
            <span className="text-xs truncate flex-1" title={filePath}>
              {name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                void onDetach(filePath)
              }}
            >
              <X className="size-3" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}

// ===== 本地精简版：附加目录树 =====

interface AttachedDirsSectionProps {
  attachedDirs: string[]
  onDetach: (dirPath: string) => void
  refreshVersion: number
  onFilePreview?: (filePath: string) => void
  inspectMode?: boolean
  onDirectoryInspect?: (dirPath: string) => void
}

function AttachedDirsSection({
  attachedDirs,
  onDetach,
  refreshVersion,
  onFilePreview,
  inspectMode,
  onDirectoryInspect,
}: AttachedDirsSectionProps): React.ReactElement {
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(new Set())

  const handleSelect = React.useCallback((path: string, ctrlKey: boolean) => {
    setSelectedPaths((prev) => {
      if (ctrlKey) {
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
        }
        return next
      }
      return new Set([path])
    })
  }, [])

  return (
    <div className="pt-2.5 pb-1 flex-shrink-0">
      <div className="text-[11px] font-medium text-muted-foreground mb-1 px-3">
        附加目录（Agent 可以读取并操作此外部文件夹）
      </div>
      {attachedDirs.map((dir) => (
        <AttachedDirTree
          key={dir}
          dirPath={dir}
          onDetach={() => onDetach(dir)}
          selectedPaths={selectedPaths}
          onSelect={handleSelect}
          refreshVersion={refreshVersion}
          onFilePreview={onFilePreview}
          inspectMode={inspectMode}
          onDirectoryInspect={onDirectoryInspect}
        />
      ))}
    </div>
  )
}

interface AttachedDirTreeProps {
  dirPath: string
  onDetach: () => void
  selectedPaths: Set<string>
  onSelect: (path: string, ctrlKey: boolean) => void
  refreshVersion: number
  onFilePreview?: (filePath: string) => void
  inspectMode?: boolean
  onDirectoryInspect?: (dirPath: string) => void
}

function AttachedDirTree({
  dirPath,
  onDetach,
  selectedPaths,
  onSelect,
  refreshVersion,
  onFilePreview,
  inspectMode,
  onDirectoryInspect,
}: AttachedDirTreeProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<FileEntry[]>([])
  const [loaded, setLoaded] = React.useState(false)

  const dirName = dirPath.split('/').filter(Boolean).pop() || dirPath

  // 目录区不需要 sessionId 校验，传空字符串即可
  React.useEffect(() => {
    if (expanded && loaded) {
      window.electronAPI
        .listAttachedDirectory(dirPath, { sessionId: '', candidateBasePaths: undefined })
        .then((items) => setChildren(items))
        .catch((err) => console.error('[WorkspaceFilesView/AttachedDirTree] 刷新失败:', err))
    }
  }, [refreshVersion])

  const toggleExpand = async (): Promise<void> => {
    if (!expanded && !loaded) {
      try {
        const items = await window.electronAPI.listAttachedDirectory(dirPath, {
          sessionId: '',
          candidateBasePaths: undefined,
        })
        setChildren(items)
        setLoaded(true)
      } catch (err) {
        console.error('[WorkspaceFilesView/AttachedDirTree] 加载失败:', err)
      }
    }
    setExpanded(!expanded)
  }

  const { paddingLeft, guideLeft } = computeTreeRowLayout(0)
  const isSticky = expanded

  return (
    <div className="relative">
      <div
        data-sticky-row={isSticky ? 'true' : undefined}
        className={cn(
          'relative flex h-8 items-center gap-1 pr-2 text-sm cursor-pointer group transition-colors',
          isSticky && cn(STICKY_ROW_BASE_CLASS, 'top-0 z-10'),
          isSticky ? 'hover:bg-accent' : 'hover:bg-accent/50'
        )}
        style={{ paddingLeft }}
        onClick={() => {
          if (inspectMode) onDirectoryInspect?.(dirPath)
          void toggleExpand()
        }}
      >
        <ChevronRight
          className={cn(
            'size-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150',
            expanded && 'rotate-90'
          )}
        />
        <FileTypeIcon name={dirName} isDirectory isOpen={expanded} />
        <span className="text-xs truncate flex-1" title={dirPath}>
          {dirName}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onDetach()
          }}
        >
          <X className="size-3" />
        </Button>
      </div>
      {expanded && (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1 top-0 w-px bg-border/70"
            style={{ left: guideLeft }}
          />
          {children.length === 0 && loaded && (
            <div
              className="text-[11px] text-muted-foreground/50 py-1"
              style={{ paddingLeft: paddingLeft + 24 }}
            >
              空文件夹
            </div>
          )}
          {children.map((child) => (
            <AttachedDirItem
              key={child.path}
              entry={child}
              depth={1}
              selectedPaths={selectedPaths}
              onSelect={onSelect}
              onFilePreview={onFilePreview}
              inspectMode={inspectMode}
              onDirectoryInspect={onDirectoryInspect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AttachedDirItemProps {
  entry: FileEntry
  depth: number
  selectedPaths: Set<string>
  onSelect: (path: string, ctrlKey: boolean) => void
  onFilePreview?: (filePath: string) => void
  inspectMode?: boolean
  onDirectoryInspect?: (dirPath: string) => void
}

function AttachedDirItem({
  entry,
  depth,
  selectedPaths,
  onSelect,
  onFilePreview,
  inspectMode,
  onDirectoryInspect,
}: AttachedDirItemProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<FileEntry[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const isSelected = selectedPaths.has(entry.path)

  const toggleDir = async (): Promise<void> => {
    if (!entry.isDirectory) return
    if (!expanded && !loaded) {
      try {
        const items = await window.electronAPI.listAttachedDirectory(entry.path, {
          sessionId: '',
          candidateBasePaths: undefined,
        })
        setChildren(items)
        setLoaded(true)
      } catch (err) {
        console.error('[WorkspaceFilesView/AttachedDirItem] 加载失败:', err)
      }
    }
    setExpanded(!expanded)
  }

  const handleClick = (e: React.MouseEvent): void => {
    const isMulti = e.ctrlKey || e.metaKey
    onSelect(entry.path, isMulti)
    if (isMulti) return
    if (entry.isDirectory) {
      if (inspectMode) onDirectoryInspect?.(entry.path)
      void toggleDir()
    } else {
      onFilePreview?.(entry.path)
    }
  }

  const { paddingLeft, guideLeft, stickyTop, stickyZIndex } = computeTreeRowLayout(depth)
  const isSticky = entry.isDirectory && expanded && canBeSticky(depth)

  return (
    <>
      <div
        data-sticky-row={isSticky ? 'true' : undefined}
        className={cn(
          'relative flex h-8 items-center gap-1 pr-2 text-sm cursor-pointer group transition-colors',
          isSticky && STICKY_ROW_BASE_CLASS,
          isSelected ? 'bg-accent' : isSticky ? 'hover:bg-accent' : 'hover:bg-accent/50'
        )}
        style={{
          paddingLeft,
          top: isSticky ? stickyTop : undefined,
          zIndex: isSticky ? stickyZIndex : undefined,
        }}
        onClick={handleClick}
      >
        {isSticky && <AncestorGuides depth={depth} isSelected={isSelected} />}
        {entry.isDirectory ? (
          <ChevronRight
            className={cn(
              'size-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150',
              expanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <FileTypeIcon name={entry.name} isDirectory={entry.isDirectory} isOpen={expanded} />
        <span className="truncate text-xs flex-1">{entry.name}</span>
      </div>
      {expanded && (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1 top-0 w-px bg-border/70"
            style={{ left: guideLeft }}
          />
          {children.length === 0 && loaded && (
            <div
              className="text-[11px] text-muted-foreground/50 py-1"
              style={{ paddingLeft: paddingLeft + 24 }}
            >
              空文件夹
            </div>
          )}
          {children.map((child) => (
            <AttachedDirItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPaths={selectedPaths}
              onSelect={onSelect}
              onFilePreview={onFilePreview}
              inspectMode={inspectMode}
              onDirectoryInspect={onDirectoryInspect}
            />
          ))}
        </div>
      )}
    </>
  )
}
