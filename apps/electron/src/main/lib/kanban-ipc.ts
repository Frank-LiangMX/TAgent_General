/**
 * Kanban 看板 IPC 处理器
 *
 * 由 main/ipc.ts 在 registerIpcHandlers() 中调用 registerKanbanIpcHandlers() 注册。
 * 每个处理器内部按需 lazy import kanban-db / kanban-dispatcher / agent-session-manager，
 * 避免主进程启动时强耦合 kanban 子系统。
 *
 * 通道：KANBAN_IPC_CHANNELS（@tagent/shared）
 * 广播：broadcastKanbanChanged() 向所有渲染窗口推送 CHANGED，触发前端刷新
 */

import { ipcMain, BrowserWindow } from 'electron'

import {
  KANBAN_IPC_CHANNELS,
  type KanbanBoard,
  type KanbanTask,
  type KanbanTaskStatus,
  type UnblockKanbanTaskInput,
  type CreateBoardFromDraftInput,
  type CreateBoardFromDraftResult,
  type ListKanbanBoardsInput,
  type CreateKanbanBoardIpcInput,
  type UpdateKanbanBoardInput,
  type DeleteKanbanBoardInput,
  type CreateKanbanTaskIpcInput,
  type AttachBoardToSessionInput,
  type DetachBoardFromSessionInput,
} from '@tagent/shared'

import { kanbanDbService } from './kanban-db'
import { getAgentSessionMeta, updateAgentSessionMeta } from './agent-session-manager'

/** 启动时 init 失败（如 better-sqlite3 ABI 不匹配）时，IPC 侧再试一次并给出修复指引 */
function ensureKanbanDb(): void {
  if (kanbanDbService.isInitialized()) return
  const result = kanbanDbService.initialize()
  if (!result.success) {
    throw new Error(
      `[看板] 数据库未就绪: ${result.error ?? 'unknown'}。请在 apps/electron 执行 bun run rebuild:native 后重启 dev`
    )
  }
}

/** 向所有渲染窗口广播看板数据变更，触发前端刷新 */
export function broadcastKanbanChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(KANBAN_IPC_CHANNELS.CHANGED)
    }
  }
}

/** 看板完成事件 payload（事件回流方案 B） */
export interface BoardCompletedEvent {
  /** 完成的看板 ID */
  boardId: string
  /** 看板绑定的主会话 ID（无则 undefined） */
  parentSessionId?: string
  /** 是否需要主会话汇总（B9，true 时渲染层自动注入 user 消息触发主会话） */
  requireSummary: boolean
  /** 完成统计 */
  summary: {
    total: number
    done: number
    failed: number
  }
}

/**
 * 向所有渲染窗口广播看板完成事件
 *
 * dispatcher 检测到某 board 所有任务终态后调用。
 * 渲染层监听后根据 requireSummary 决定：
 * - requireSummary=true：向主会话注入 user 消息「汇总看板结果」触发 Agent 汇总
 * - requireSummary=false：只发桌面通知 + toast，不触发主会话
 */
export function broadcastBoardCompleted(
  boardId: string,
  parentSessionId: string | undefined,
  requireSummary: boolean,
  summary: { total: number; done: number; failed: number }
): void {
  const payload: BoardCompletedEvent = { boardId, parentSessionId, requireSummary, summary }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(KANBAN_IPC_CHANNELS.BOARD_COMPLETED, payload)
    }
  }
}

/** 暂停看板调度（B5：per-board 标记，不停全局 timer，不影响其他看板） */
export function pauseKanbanBoard(boardId: string): void {
  ensureKanbanDb()
  kanbanDbService.updateBoard(boardId, { paused: true })
  broadcastKanbanChanged()
  console.log(`[看板] 暂停调度: ${boardId}`)
}

/** 恢复看板调度（B5：清除 paused 标记，dispatcher 下个 tick 自动派工） */
export function resumeKanbanBoard(boardId: string): void {
  ensureKanbanDb()
  kanbanDbService.updateBoard(boardId, { paused: false })
  broadcastKanbanChanged()
  console.log(`[看板] 恢复调度: ${boardId}`)
}

/** 解除任务阻塞：状态从 blocked → ready，清空 blockedReason */
export function unblockKanbanTask(input: UnblockKanbanTaskInput): void {
  ensureKanbanDb()
  kanbanDbService.updateTaskStatus(input.taskId, {
    status: 'ready',
    blockedReason: undefined,
  })
  console.log(
    `[看板] 解除阻塞: ${input.taskId}${input.reason ? `（原因：${input.reason}）` : ''}`
  )
  broadcastKanbanChanged()
}

/**
 * 重试失败任务：状态从 failed → ready，清空 error
 *
 * 让 dispatcher 下个 tick 重新派工。assigneeSessionId 保留（便于追溯上次失败的子会话），
 * startedAt 保留（累计原始执行时间），resultSummary 清空。
 */
export function retryKanbanTask(taskId: string): void {
  ensureKanbanDb()
  const task = kanbanDbService.getTask(taskId)
  if (!task) {
    throw new Error(`任务不存在: ${taskId}`)
  }
  if (task.status !== 'failed') {
    throw new Error(`只有 failed 状态的任务可重试，当前状态: ${task.status}`)
  }
  kanbanDbService.updateTaskStatus(taskId, {
    status: 'ready',
    error: undefined,
    resultSummary: undefined,
  })
  console.log(`[看板] 重试任务: ${taskId}（${task.title}）`)
  broadcastKanbanChanged()
}

/** 把已有看板绑定到会话（写回 session meta.boardId，会话顶部显示团队 Tab） */
export function attachBoardToSession(input: AttachBoardToSessionInput): void {
  ensureKanbanDb()
  const board = kanbanDbService.getBoard(input.boardId)
  if (!board) {
    throw new Error(`看板不存在: ${input.boardId}`)
  }
  if (!getAgentSessionMeta(input.sessionId)) {
    throw new Error(`主会话不存在: ${input.sessionId}`)
  }
  updateAgentSessionMeta(input.sessionId, { boardId: input.boardId })
  broadcastKanbanChanged()
  console.log(`[看板] 绑定看板到会话: board=${input.boardId}, session=${input.sessionId}`)
}

/** 解绑会话的看板（清除 session meta.boardId，会话顶部隐藏团队 Tab） */
export function detachBoardFromSession(input: DetachBoardFromSessionInput): void {
  if (!getAgentSessionMeta(input.sessionId)) {
    throw new Error(`主会话不存在: ${input.sessionId}`)
  }
  updateAgentSessionMeta(input.sessionId, { boardId: undefined })
  broadcastKanbanChanged()
  console.log(`[看板] 解绑会话看板: session=${input.sessionId}`)
}

/**
 * 草稿升级自动建板：按 RequirementBlock 创建 board + task
 *
 * 流程：
 * 1. 创建 board（rootGoal, parentSessionId, originBridge='desktop'）
 * 2. 写回 AgentSessionMeta.boardId（触发「团队」Tab 显示）
 * 3. 按 requirements 顺序建 task，priority 按 label 顺序递减（R-1 优先级最高）
 * 4. resolveReadyTasks 提升无依赖任务为 ready（dispatcher 可立即派工）
 * 5. 广播 CHANGED
 */
export function createBoardFromDraft(input: CreateBoardFromDraftInput): CreateBoardFromDraftResult {
  ensureKanbanDb()
  const { sessionId, channelId, workspaceId, rootGoal, requirements } = input

  // 校验主会话存在
  const sessionMeta = getAgentSessionMeta(sessionId)
  if (!sessionMeta) {
    throw new Error(`主会话不存在: ${sessionId}`)
  }

  // 1. 创建看板
  const board = kanbanDbService.createBoard({
    rootGoal,
    parentSessionId: sessionId,
    originBridge: 'desktop',
  })

  // 2. 写回主会话 meta.boardId（渲染进程据此显示「团队」Tab）
  updateAgentSessionMeta(sessionId, { boardId: board.id })

  // 3. 按 requirements 建任务（R-1 优先级最高，依次递减）
  const baseTaskInput = {
    boardId: board.id,
    channelId,
    ...(workspaceId ? { metadata: { workspaceId } } : {}),
  }
  const tasks = requirements.map((req, idx) => {
    const bodyParts = [req.description]
    if (req.acceptanceCriteria && req.acceptanceCriteria.length > 0) {
      bodyParts.push('', '验收标准:')
      for (const ac of req.acceptanceCriteria) {
        bodyParts.push(`- ${ac}`)
      }
    }
    return kanbanDbService.createTask({
      ...baseTaskInput,
      title: `${req.label}: ${req.title}`,
      body: bodyParts.join('\n'),
      priority: (requirements.length - idx) * 10,
    })
  })

  // 4. 提升无依赖任务为 ready
  kanbanDbService.resolveReadyTasks()

  // 5. 广播变更
  broadcastKanbanChanged()

  console.log(
    `[看板] 草稿升级建板: board=${board.id}, tasks=${tasks.length}, session=${sessionId}`
  )

  return { boardId: board.id, tasks, board }
}

/** 列出某看板下全部任务 */
export function listKanbanTasks(boardId: string): KanbanTask[] {
  ensureKanbanDb()
  return kanbanDbService.listTasksByBoard(boardId)
}

/** 获取看板信息 */
export function getKanbanBoard(boardId: string) {
  ensureKanbanDb()
  return kanbanDbService.getBoard(boardId)
}

/** 列出所有看板（B4：全局看板视图） */
export function listKanbanBoards(input?: ListKanbanBoardsInput): KanbanBoard[] {
  ensureKanbanDb()
  return kanbanDbService.listBoards(input)
}

/** 独立创建看板（B4：不绑定会话） */
export function createKanbanBoard(input: CreateKanbanBoardIpcInput): KanbanBoard {
  ensureKanbanDb()
  const board = kanbanDbService.createBoard({
    rootGoal: input.rootGoal,
    title: input.title,
    parentSessionId: input.parentSessionId,
    mode: input.mode,
    originChatId: input.originChatId,
    originBridge: input.originBridge,
  })
  // 若提供了 parentSessionId，写回主会话 meta.boardId（触发「团队」Tab 显示）
  if (input.parentSessionId) {
    updateAgentSessionMeta(input.parentSessionId, { boardId: board.id })
  }
  broadcastKanbanChanged()
  console.log(
    `[看板] 独立建板: board=${board.id}, mode=${board.mode}, session=${input.parentSessionId ?? 'none'}`
  )
  return board
}

/** 更新看板（B4：标题/状态；B5：并发上限/暂停） */
export function updateKanbanBoard(input: UpdateKanbanBoardInput): KanbanBoard | null {
  ensureKanbanDb()
  const board = kanbanDbService.updateBoard(input.boardId, {
    title: input.title,
    status: input.status,
    maxConcurrent: input.maxConcurrent,
    paused: input.paused,
  })
  broadcastKanbanChanged()
  console.log(`[看板] 更新看板: ${input.boardId}`)
  return board
}

/** 删除看板（B4：软删除=cancelled，硬删除=DELETE） */
export function deleteKanbanBoard(input: DeleteKanbanBoardInput): void {
  ensureKanbanDb()
  kanbanDbService.deleteBoard(input.boardId, input.hard ?? false)
  broadcastKanbanChanged()
  console.log(`[看板] 删除看板: ${input.boardId} (hard=${input.hard ?? false})`)
}

/**
 * 新建任务（B5：UI 创建任务闭环）
 *
 * 任务初始状态为 pending，由 dispatcher 的 resolveReadyTasks() 提升为 ready 后才会派工。
 * channelId 必填，由渲染层从全局选中渠道兜底传入。
 */
export function createKanbanTask(input: CreateKanbanTaskIpcInput): KanbanTask {
  ensureKanbanDb()
  const task = kanbanDbService.createTask(input)
  // 提升无依赖任务为 ready（新任务无 parentTaskId 依赖时立即可派工）
  kanbanDbService.resolveReadyTasks()
  broadcastKanbanChanged()
  console.log(`[看板] 新建任务: task=${task.id}, board=${task.boardId}, title="${task.title}"`)
  return task
}

/** 更新任务状态（供 unblock 等场景使用，导出给 IPC 层） */
export function updateKanbanTaskStatus(
  taskId: string,
  update: {
    status: KanbanTaskStatus
    blockedReason?: string
    resultSummary?: string
    error?: string
  }
): void {
  kanbanDbService.updateTaskStatus(taskId, update)
  broadcastKanbanChanged()
}

/**
 * 注册 Kanban IPC 处理器
 *
 * 在 main/ipc.ts 的 registerIpcHandlers() 中调用一次即可。
 * 所有处理器均返回 Promise，错误会被 IPC 自动包装为 reject。
 */
export function registerKanbanIpcHandlers(): void {
  ipcMain.handle(KANBAN_IPC_CHANNELS.LIST_TASKS, async (_event, boardId: string) => {
    return listKanbanTasks(boardId)
  })

  ipcMain.handle(KANBAN_IPC_CHANNELS.GET_BOARD, async (_event, boardId: string) => {
    return getKanbanBoard(boardId)
  })

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.LIST_BOARDS,
    async (_event, input?: ListKanbanBoardsInput) => {
      return listKanbanBoards(input)
    }
  )

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.CREATE_BOARD,
    async (_event, input: CreateKanbanBoardIpcInput) => {
      return createKanbanBoard(input)
    }
  )

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.UPDATE_BOARD,
    async (_event, input: UpdateKanbanBoardInput) => {
      return updateKanbanBoard(input)
    }
  )

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.DELETE_BOARD,
    async (_event, input: DeleteKanbanBoardInput) => {
      deleteKanbanBoard(input)
    }
  )

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.CREATE_TASK,
    async (_event, input: CreateKanbanTaskIpcInput) => {
      return createKanbanTask(input)
    }
  )

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.CREATE_BOARD_FROM_DRAFT,
    async (_event, input: CreateBoardFromDraftInput) => {
      return createBoardFromDraft(input)
    }
  )

  ipcMain.handle(KANBAN_IPC_CHANNELS.PAUSE_BOARD, async (_event, boardId: string) => {
    pauseKanbanBoard(boardId)
  })

  ipcMain.handle(KANBAN_IPC_CHANNELS.RESUME_BOARD, async (_event, boardId: string) => {
    resumeKanbanBoard(boardId)
  })

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.UNBLOCK_TASK,
    async (_event, input: UnblockKanbanTaskInput) => {
      unblockKanbanTask(input)
    }
  )

  ipcMain.handle(KANBAN_IPC_CHANNELS.RETRY_TASK, async (_event, taskId: string) => {
    retryKanbanTask(taskId)
  })

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.ATTACH_BOARD_TO_SESSION,
    async (_event, input: AttachBoardToSessionInput) => {
      attachBoardToSession(input)
    }
  )

  ipcMain.handle(
    KANBAN_IPC_CHANNELS.DETACH_BOARD_FROM_SESSION,
    async (_event, input: DetachBoardFromSessionInput) => {
      detachBoardFromSession(input)
    }
  )
}
