/**
 * WorkspaceManagerDialog — 工作区管理弹窗
 *
 * 把原本嵌在 LeftSidebar 内的 WorkspaceSelector 能力完整搬到 Dialog 中：
 * - 列出所有工作区，点击切换
 * - 新建工作区
 * - 重命名（hover 行内编辑）
 * - 删除（含 AlertDialog 二次确认）
 * - 拖拽排序并持久化
 *
 * 通过 `useWorkspaceActions` 共享 select/create 逻辑，
 * 删除时直接调用 `window.electronAPI.deleteAgentWorkspace`，
 * 与旧 `WorkspaceSelector` 行为一致。
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

interface WorkspaceManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkspaceManagerDialog({
  open,
  onOpenChange,
}: WorkspaceManagerDialogProps): React.ReactElement {
  const { workspaces, currentWorkspaceId, selectWorkspace, createWorkspace } = useWorkspaceActions()
  const [, setWorkspaces] = useAtom(agentWorkspacesAtom)

  // 新建状态
  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const createInputRef = React.useRef<HTMLInputElement>(null)

  // 重命名状态
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const editInputRef = React.useRef<HTMLInputElement>(null)

  // 删除确认状态
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null)

  // 拖拽状态
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = React.useState<{ id: string; position: 'before' | 'after' } | null>(null)

  // 打开时清掉中间态，避免上次未保存的编辑/输入残留
  React.useEffect(() => {
    if (open) {
      setCreating(false)
      setNewName('')
      setEditingId(null)
      setDeleteTargetId(null)
    }
  }, [open])

  /** 切换工作区 */
  const handleSelect = (workspace: AgentWorkspace): void => {
    if (editingId) return
    selectWorkspace(workspace.id)
  }

  // ===== 新建 =====

  const handleStartCreate = (): void => {
    setCreating(true)
    setNewName('')
    requestAnimationFrame(() => {
      createInputRef.current?.focus()
    })
  }

  const handleCreate = async (): Promise<void> => {
    const trimmed = newName.trim()
    if (!trimmed) {
      setCreating(false)
      return
    }
    await createWorkspace(trimmed)
    setCreating(false)
  }

  const handleCreateKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return
      e.preventDefault()
      handleCreate()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setCreating(false)
    }
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
      console.error('[WorkspaceManagerDialog] 删除工作区失败:', error)
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
    // 根据鼠标在目标元素的上半/下半部分决定插入位置
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
            <DialogTitle>工作区</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              管理 Agent 模式下的工作区。可新建、重命名、删除和排序。
            </DialogDescription>
          </DialogHeader>

          {/* 顶部操作条：新建工作区 */}
          <div className="px-4 py-2 border-b border-border/30 flex-shrink-0">
            <button
              type="button"
              onClick={handleStartCreate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-foreground/70 bg-primary/5 hover:bg-primary/10 transition-colors border border-dashed border-[hsl(var(--dashed-border))] hover:border-[hsl(var(--dashed-border-hover))]"
              title="新建工作区"
            >
              <Plus size={13} />
              <span>新建工作区</span>
            </button>
          </div>

          {/* 工作区列表 */}
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
                    dragId === ws.id && 'opacity-40',
                  )}
                >
                  <GripVertical size={13} className="flex-shrink-0 text-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />

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
                      <span className="flex-1 min-w-0 truncate">{ws.name}</span>

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

            {/* 新建工作区输入框 */}
            {creating && (
              <div className="flex items-center gap-2 px-2 py-2">
                <FolderOpen size={14} className="flex-shrink-0 text-foreground/40" />
                <input
                  ref={createInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  onBlur={() => setCreating(false)}
                  placeholder="工作区名称..."
                  className="flex-1 min-w-0 bg-transparent text-[13px] text-foreground border-b border-primary/50 outline-none px-0.5"
                  maxLength={50}
                />
              </div>
            )}

            {workspaces.length === 0 && !creating && (
              <div className="py-6 text-center text-[12px] text-foreground/40">
                暂无工作区，点击右上角"新建"创建
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗（嵌套在 Dialog 内） */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(v) => { if (!v) setDeleteTargetId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除工作区</AlertDialogTitle>
            <AlertDialogDescription>
              删除后工作区配置将被移除，但目录文件会保留。确定要删除吗？
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
