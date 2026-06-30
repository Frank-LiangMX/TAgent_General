/**
 * Kanban 看板 Jotai 状态管理
 *
 * 管理 boardId / tasks 的加载与 CHANGED 事件订阅。
 * boardId 从 agentSessionsAtom 中对应 session meta 的 boardId 字段派生。
 * tasks 通过 atomFamily(boardId) 缓存，CHANGED 事件触发重新加载。
 */

import { useEffect, useCallback } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { atomFamily } from 'jotai/utils'

import type { KanbanBoard, KanbanTask } from '@tagent/shared'

import { agentSessionsAtom } from './agent-atoms'

/** 按 boardId 缓存的 tasks atom family */
export const kanbanTasksAtomFamily = atomFamily((boardId: string) => {
  return atom<KanbanTask[]>([])
})

/** 按 boardId 缓存的 board 信息 atom family */
export const kanbanBoardAtomFamily = atomFamily((boardId: string) => {
  return atom<KanbanBoard | null>(null)
})

/** 按 sessionId 缓存的 boardId 派生 atom（从 session meta 读取） */
export const sessionBoardIdAtomFamily = atomFamily((sessionId: string) => {
  return atom<string | undefined>((get) => {
    const sessions = get(agentSessionsAtom)
    const meta = sessions.find((s) => s.id === sessionId)
    return meta?.boardId
  })
})

/** 按 sessionId 缓存的 sourceKanbanTaskId 派生 atom（判断是否为工人嵌套会话） */
export const sessionSourceKanbanTaskIdAtomFamily = atomFamily((sessionId: string) => {
  return atom<string | undefined>((get) => {
    const sessions = get(agentSessionsAtom)
    const meta = sessions.find((s) => s.id === sessionId)
    return meta?.sourceKanbanTaskId
  })
})

/** 按 sessionId 记录二级 Tab 选择（对话 | 团队） */
export const sessionAgentSubTabAtomFamily = atomFamily((sessionId: string) => {
  return atom<'chat' | 'team'>('chat')
})

/** 按 boardId 记录选中的 task ID（Master-Detail 右栏） */
export const selectedKanbanTaskIdAtomFamily = atomFamily((boardId: string) => {
  return atom<string | null>(null)
})

/** 看板加载状态 atom family（避免并发重复请求） */
const kanbanLoadingAtomFamily = atomFamily((boardId: string) => {
  return atom<boolean>(false)
})

/**
 * Hook：加载并订阅某 session 的看板数据
 *
 * - 从 session meta 派生 boardId
 * - boardId 存在时加载 board + tasks
 * - 订阅 KANBAN_CHANGED 事件，变更时重新加载
 *
 * @returns { boardId, tasks, board, loading, refresh }
 */
export function useKanbanBoard(sessionId: string): {
  boardId: string | undefined
  tasks: KanbanTask[]
  board: KanbanBoard | null
  loading: boolean
  refresh: () => Promise<void>
} {
  const boardId = useAtomValue(sessionBoardIdAtomFamily(sessionId))
  const tasks = useAtomValue(kanbanTasksAtomFamily(boardId ?? '__none__'))
  const board = useAtomValue(kanbanBoardAtomFamily(boardId ?? '__none__'))
  const loading = useAtomValue(kanbanLoadingAtomFamily(boardId ?? '__none__'))
  const setTasks = useSetAtom(kanbanTasksAtomFamily(boardId ?? '__none__'))
  const setBoard = useSetAtom(kanbanBoardAtomFamily(boardId ?? '__none__'))
  const setLoading = useSetAtom(kanbanLoadingAtomFamily(boardId ?? '__none__'))

  const loadBoard = useCallback(async () => {
    if (!boardId) return
    setLoading(true)
    try {
      const [boardData, taskList] = await Promise.all([
        window.electronAPI.kanban.getBoard(boardId),
        window.electronAPI.kanban.listTasks(boardId),
      ])
      setBoard(boardData)
      setTasks(taskList)
    } catch (err) {
      console.error('[看板] 加载失败:', err)
    } finally {
      setLoading(false)
    }
  }, [boardId, setBoard, setTasks, setLoading])

  useEffect(() => {
    if (!boardId) return
    void loadBoard()
  }, [boardId, loadBoard])

  useEffect(() => {
    if (!boardId) return
    const unsubscribe = window.electronAPI.kanban.onChanged(() => {
      void loadBoard()
    })
    return unsubscribe
  }, [boardId, loadBoard])

  return { boardId, tasks, board, loading, refresh: loadBoard }
}
