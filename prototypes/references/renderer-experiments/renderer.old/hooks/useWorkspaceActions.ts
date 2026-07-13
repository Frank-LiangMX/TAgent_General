/**
 * useWorkspaceActions — 工作区切换与创建的共享逻辑
 *
 * 抽离 WorkspaceSelector / WorkspaceManagerDialog 共用的切换/创建逻辑，
 * 避免多处实现漂移。重命名 / 删除 / 拖拽排序仅 WorkspaceManagerDialog
 * 内的弹窗需要，留在弹窗组件内。
 */

import { useAtom } from 'jotai'
import * as React from 'react'
import { toast } from 'sonner'

import type { AgentWorkspace } from '@tagent/shared'

import { agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'

interface UseWorkspaceActionsResult {
  workspaces: AgentWorkspace[]
  currentWorkspaceId: string | null
  /** 切换到指定工作区；已是当前工作区时无副作用 */
  selectWorkspace: (workspaceId: string) => void
  /** 创建并切到新工作区；成功返回新工作区，失败已 toast 并返回 null */
  createWorkspace: (name: string) => Promise<AgentWorkspace | null>
  /** 选择目录并创建项目工作区；成功返回新工作区，失败/取消返回 null */
  createProject: () => Promise<AgentWorkspace | null>
}

export function useWorkspaceActions(): UseWorkspaceActionsResult {
  const [workspaces, setWorkspaces] = useAtom(agentWorkspacesAtom)
  const [currentWorkspaceId, setCurrentWorkspaceId] = useAtom(currentAgentWorkspaceIdAtom)
  const createInFlightRef = React.useRef(false)

  const selectWorkspace = React.useCallback(
    (workspaceId: string): void => {
      if (workspaceId === currentWorkspaceId) return
      setCurrentWorkspaceId(workspaceId)
      window.electronAPI.updateSettings({ agentWorkspaceId: workspaceId }).catch(console.error)
    },
    [currentWorkspaceId, setCurrentWorkspaceId]
  )

  const createWorkspace = React.useCallback(
    async (name: string): Promise<AgentWorkspace | null> => {
      const trimmed = name.trim()
      if (!trimmed) return null
      if (createInFlightRef.current) return null
      createInFlightRef.current = true

      try {
        const workspace = await window.electronAPI.createAgentWorkspace(trimmed)
        setWorkspaces((prev) => [workspace, ...prev])
        setCurrentWorkspaceId(workspace.id)
        window.electronAPI.updateSettings({ agentWorkspaceId: workspace.id }).catch(console.error)
        return workspace
      } catch (error) {
        const msg = error instanceof Error ? error.message : '创建失败'
        toast.error(msg)
        return null
      } finally {
        createInFlightRef.current = false
      }
    },
    [setWorkspaces, setCurrentWorkspaceId]
  )

  const createProject = React.useCallback(async (): Promise<AgentWorkspace | null> => {
    try {
      const result = await window.electronAPI.openFolderDialog()
      if (!result) return null

      const workspace = await window.electronAPI.createProjectWorkspace(result.path)
      setWorkspaces((prev) => [workspace, ...prev])
      setCurrentWorkspaceId(workspace.id)
      window.electronAPI.updateSettings({ agentWorkspaceId: workspace.id }).catch(console.error)
      return workspace
    } catch (error) {
      const msg = error instanceof Error ? error.message : '创建项目失败'
      toast.error(msg)
      return null
    }
  }, [setWorkspaces, setCurrentWorkspaceId])

  return { workspaces, currentWorkspaceId, selectWorkspace, createWorkspace, createProject }
}
