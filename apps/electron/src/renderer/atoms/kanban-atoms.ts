/**
 * Kanban 看板 Jotai 状态管理
 *
 * 管理 boardId / tasks 的加载与 CHANGED 事件订阅。
 * boardId 从 agentSessionsAtom 中对应 session meta 的 boardId 字段派生。
 * tasks 通过 atomFamily(boardId) 缓存，CHANGED 事件触发重新加载。
 */

import { useEffect, useCallback, useState } from 'react'
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

// ===== B4：全局看板列表（独立实体，不依赖 session） =====

import type { KanbanBoardMode, KanbanBoardStatus } from '@tagent/shared'

/** 全局看板列表 atom（不依赖 session） */
export const kanbanBoardsAtom = atom<KanbanBoard[]>([])

/** 全局看板列表加载状态 */
export const kanbanBoardsLoadingAtom = atom<boolean>(false)

/** 当前选中的看板 ID（B4：点击看板项后主区切换到看板详情） */
export const selectedKanbanBoardIdAtom = atom<string | null>(null)

/** 全局看板列表过滤器（mode/status 可选） */
export const kanbanBoardsFilterAtom = atom<{
  mode?: KanbanBoardMode
  status?: KanbanBoardStatus
}>({})

/**
 * Hook：加载所有看板（B4 全局视图）
 *
 * - 支持按 mode/status 过滤
 * - 订阅 KANBAN_CHANGED 事件自动刷新
 *
 * @returns { boards, loading, filter, setFilter, refresh }
 */
export function useKanbanBoards(): {
  boards: KanbanBoard[]
  loading: boolean
  filter: { mode?: KanbanBoardMode; status?: KanbanBoardStatus }
  setFilter: (filter: { mode?: KanbanBoardMode; status?: KanbanBoardStatus }) => void
  refresh: () => Promise<void>
} {
  const filter = useAtomValue(kanbanBoardsFilterAtom)
  const boards = useAtomValue(kanbanBoardsAtom)
  const loading = useAtomValue(kanbanBoardsLoadingAtom)
  const setBoards = useSetAtom(kanbanBoardsAtom)
  const setLoading = useSetAtom(kanbanBoardsLoadingAtom)
  const setFilter = useSetAtom(kanbanBoardsFilterAtom)

  const loadBoards = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI.kanban.listBoards(filter)
      setBoards(list)
    } catch (err) {
      console.error('[看板] 加载看板列表失败:', err)
    } finally {
      setLoading(false)
    }
  }, [filter, setBoards, setLoading])

  useEffect(() => {
    void loadBoards()
  }, [loadBoards])

  useEffect(() => {
    const unsubscribe = window.electronAPI.kanban.onChanged(() => {
      void loadBoards()
    })
    return unsubscribe
  }, [loadBoards])

  return { boards, loading, filter, setFilter, refresh: loadBoards }
}

/**
 * Hook：加载选中看板的详情与任务列表（B4 看板详情主视图）
 *
 * - boardId 为 null 时返回空态
 * - 订阅 KANBAN_CHANGED 事件自动刷新
 *
 * @returns { boardId, board, tasks, loading, refresh }
 */
export function useSelectedKanbanBoard(boardId: string | null): {
  boardId: string | null
  board: KanbanBoard | null
  tasks: KanbanTask[]
  loading: boolean
  refresh: () => Promise<void>
} {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [loading, setLoading] = useState(false)

  const loadBoard = useCallback(async () => {
    if (!boardId) {
      setBoard(null)
      setTasks([])
      return
    }
    setLoading(true)
    try {
      const [boardData, taskList] = await Promise.all([
        window.electronAPI.kanban.getBoard(boardId),
        window.electronAPI.kanban.listTasks(boardId),
      ])
      setBoard(boardData)
      setTasks(taskList)
    } catch (err) {
      console.error('[看板] 加载看板详情失败:', err)
    } finally {
      setLoading(false)
    }
  }, [boardId])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  useEffect(() => {
    if (!boardId) return
    const unsubscribe = window.electronAPI.kanban.onChanged(() => {
      void loadBoard()
    })
    return unsubscribe
  }, [boardId, loadBoard])

  return { boardId, board, tasks, loading, refresh: loadBoard }
}
