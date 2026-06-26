/**
 * ProjectManagerDialog — 项目管理弹窗
 *
 * 管理项目工作区（用户选择的本地代码目录）：
 * - 列出所有项目，点击切换
 * - 新建项目（选择目录）
 * - 重命名（hover 行内编辑）
 * - 删除（含 AlertDialog 二次确认）
 * - 拖拽排序并持久化
 *
 * 每行显示项目名 + 目录路径截断，取代旧版的仅名称。
 */

import { useAtom } from 'jotai'
import { FolderOpen, Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { AgentWorkspace } from '@tagent/shared'

import { agentWorkspacesAtom } from '@/atoms/agent-atoms'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkspaceActions } from '@/hooks/useWorkspaceActions'
import { cn } from '@/lib/utils'

interface ProjectManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 截断路径，保留最后两级目录 + 盘符/根 */
function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path
  const parts = path.split('/')
  if (parts.length <= 3) return path
  const last = parts.slice(-2).join('/')
  const prefix = parts[0]! // 根或盘符
  return `${prefix}/.../${last}`
}

export function ProjectManagerDialog({
  open,
  onOpenChange,
}: ProjectManagerDialogProps): React.ReactElement {
  const { workspaces, currentWorkspaceId, selectWorkspace, createProject } = useWorkspaceActions()
  const [, setWorkspaces] = useAtom(agentWorkspacesAtom)

  // 重命名状态
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const editInputRef = React.useRef<HTMLInputElement>(null)

  // 删除确认状态
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null)

  // 拖拽状态
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = React.useState<{
    id: string
    position: 'before' | 'after'
  } | null>(null)

  // 打开时清掉中间态
  React.useEffect(() => {
    if (open) {
      setEditingId(null)
      setDeleteTargetId(null)
    }
  }, [open])

  /** 切换项目 */
  const handleSelect = (workspace: AgentWorkspace): void => {
    if (editingId) return
    selectWorkspace(workspace.id)
  }

  /** 新建项目 — 选择目录 */
  const handleCreateProject = async (): Promise<void> => {
    await createProject()
  }

  // ===== 重命名 =====

  const handleStartRename = (e: React.MouseEvent, ws: AgentWorkspace): void => {
    e.stopPropagation()
    setEditingId(ws.id)
    setEditName(ws.name)
    requestAnimationFrame(() => {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    })
  }

  const handleRename = async (): Promise<void> => {
    if (!editingId) return
    const trimmed = editName.trim()

    if (!trimmed) {
      setEditingId(null)
      return
    }

    try {
      const updated = await window.electronAPI.updateAgentWorkspace(editingId, { name: trimmed })
      setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
    } catch (error) {
      const msg = error instanceof Error ? error.message : '重命名失败'
      toast.error(msg)
    } finally {
      setEditingId(null)
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return
      e.preventDefault()
      handleRename()
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  // ===== 删除 =====

  const handleStartDelete = (e: React.MouseEvent, wsId: string): void => {
    e.stopPropagation()
    setDeleteTargetId(wsId)
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTargetId) return

    try {
      await window.electronAPI.deleteAgentWorkspace(deleteTargetId)
      const remaining = workspaces.filter((w) => w.id !== deleteTargetId)
      setWorkspaces(remaining)

      if (deleteTargetId === currentWorkspaceId && remaining.length > 0) {
        selectWorkspace(remaining[0]!.id)
      }
    } catch (error) {
      console.error('[ProjectManagerDialog] 删除项目失败:', error)
    } finally {
      setDeleteTargetId(null)
    }
  }

  const canDelete = (ws: AgentWorkspace): boolean => {
    return ws.slug !== 'default' && workspaces.length > 1
  }

  // ===== 拖拽排序 =====

  const handleDragStart = (e: React.DragEvent, wsId: string): void => {
    setDragId(wsId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', wsId)
  }

  const handleDragOver = (e: React.DragEvent, wsId: string): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!dragId || wsId === dragId) {
      setDropIndicator(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientY - rect.top) / rect.height
    let position: 'before' | 'after'
    if (ratio < 0.35) {
      position = 'before'
    } else if (ratio > 0.65) {
      position = 'after'
    } else {
      if (dropIndicator?.id === wsId) return
      position = ratio < 0.5 ? 'before' : 'after'
    }
    if (dropIndicator?.id === wsId && dropIndicator.position === position) return
    setDropIndicator({ id: wsId, position })
  }

  const handleDragLeave = (e: React.DragEvent): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropIndicator(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetId: string): void => {
    e.preventDefault()
    if (!dragId || dragId === targetId || !dropIndicator || dropIndicator.id !== targetId) {
      setDragId(null)
      setDropIndicator(null)
      return
    }

    const fromIdx = workspaces.findIndex((w) => w.id === dragId)
    const toIdx = workspaces.findIndex((w) => w.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...workspaces]
    const [moved] = reordered.splice(fromIdx, 1)
    const adjustedToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
    const insertIdx = dropIndicator.position === 'after' ? adjustedToIdx + 1 : adjustedToIdx
    reordered.splice(insertIdx, 0, moved!)

    setWorkspaces(reordered)
    setDragId(null)
    setDropIndicator(null)

    window.electronAPI.reorderAgentWorkspaces(reordered.map((w) => w.id)).catch(console.error)
  }

  const handleDragEnd = (): void => {
    setDragId(null)
    setDropIndicator(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border/40">
            <DialogTitle>项目管理</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              每个项目对应一个本地代码目录，Agent 将在该目录内工作。
            </DialogDescription>
          </DialogHeader>

          {/* 顶部操作条：新建项目 */}
          <div className="px-4 py-2 border-b border-border/30 flex-shrink-0">
            <button
              type="button"
              onClick={handleCreateProject}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-foreground/70 bg-primary/5 hover:bg-primary/10 transition-colors border border-dashed border-[hsl(var(--dashed-border))] hover:border-[hsl(var(--dashed-border-hover))]"
              title="选择目录新建项目"
            >
              <Plus size={13} />
              <span>选择目录新建项目</span>
            </button>
          </div>

          {/* 项目列表 */}
          <div className="flex flex-col p-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {workspaces.map((ws) => (
              <div key={ws.id} className="relative">
                {dropIndicator?.id === ws.id && dropIndicator.position === 'before' && (
                  <div className="absolute top-0 left-1 right-1 h-0.5 bg-primary rounded-full z-10" />
                )}

                <div
                  draggable={editingId !== ws.id}
                  onDragStart={(e) => handleDragStart(e, ws.id)}
                  onDragOver={(e) => handleDragOver(e, ws.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, ws.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleSelect(ws)}
                  className={cn(
                    'group w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] transition-colors duration-100 cursor-pointer',
                    ws.id === currentWorkspaceId
                      ? 'bg-foreground/[0.08] text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                      : 'text-foreground/70 hover:bg-foreground/[0.04]',
                    dragId === ws.id && 'opacity-40'
                  )}
                >
                  <GripVertical
                    size={13}
                    className="flex-shrink-0 text-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                  />

                  <FolderOpen size={14} className="flex-shrink-0 text-foreground/40" />

                  {editingId === ws.id ? (
                    <input
                      ref={editInputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={handleRename}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 bg-transparent text-[13px] text-foreground border-b border-primary/50 outline-none px-0.5"
                      maxLength={50}
                    />
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{ws.name}</span>
                        {ws.projectDirectory && (
                          <span className="block truncate text-[10px] text-muted-foreground font-mono">
                            {truncatePath(ws.projectDirectory)}
                          </span>
                        )}
                      </div>

                      {ws.id === currentWorkspaceId && (
                        <span className="flex-shrink-0 text-[10px] font-medium text-primary/70 uppercase tracking-wide">
                          当前
                        </span>
                      )}

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => handleStartRename(e, ws)}
                          className="p-1 rounded hover:bg-foreground/[0.08] text-foreground/30 hover:text-foreground/60 transition-colors"
                          title="重命名"
                        >
                          <Pencil size={12} />
                        </button>
                        {canDelete(ws) && (
                          <button
                            onClick={(e) => handleStartDelete(e, ws.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-foreground/30 hover:text-destructive transition-colors"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {dropIndicator?.id === ws.id && dropIndicator.position === 'after' && (
                  <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-primary rounded-full z-10" />
                )}
              </div>
            ))}

            {workspaces.length === 0 && (
              <div className="py-6 text-center text-[12px] text-foreground/40">
                暂无项目，点击上方按钮选择目录创建
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTargetId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              删除后项目配置将被移除，但目录文件会保留。确定要删除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
