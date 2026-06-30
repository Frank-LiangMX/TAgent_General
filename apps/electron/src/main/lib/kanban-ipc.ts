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
  type KanbanTask,
  type KanbanTaskStatus,
  type SeedKanbanDemoInput,
  type SeedKanbanDemoResult,
  type UnblockKanbanTaskInput,
} from '@tagent/shared'

import { kanbanDbService } from './kanban-db'
import { startKanbanDispatcher, stopKanbanDispatcher } from './kanban-dispatcher'
import { getAgentSessionMeta, updateAgentSessionMeta, createAgentSession } from './agent-session-manager'

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

/** 暂停看板调度（停止 tick，不清空在途任务） */
export function pauseKanbanBoard(boardId: string): void {
  // 当前 dispatcher 为全局单例（非 per-board），暂停即停 tick
  // boardId 参数保留，未来 per-board 调度时使用
  void boardId
  stopKanbanDispatcher()
  console.log(`[看板] 暂停调度: ${boardId}`)
}

/** 恢复看板调度 */
export function resumeKanbanBoard(boardId: string): void {
  void boardId
  startKanbanDispatcher()
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
 * 注入演示数据：创建 board + 4 条 mock 任务，写回主会话 meta.boardId
 *
 * 任务分布：1 done、1 running、1 blocked、1 pending（ready）
 * running 任务创建占位子会话并写入 assigneeSessionId（不 sendMessage）
 */
export function seedDemoKanban(input: SeedKanbanDemoInput): SeedKanbanDemoResult {
  ensureKanbanDb()
  const { sessionId, channelId, workspaceId } = input

  // 校验主会话存在
  const sessionMeta = getAgentSessionMeta(sessionId)
  if (!sessionMeta) {
    throw new Error(`主会话不存在: ${sessionId}`)
  }

  // 1. 创建看板
  const board = kanbanDbService.createBoard({
    rootGoal: '演示看板：验证 Kanban v1 团队 Tab 交互',
    parentSessionId: sessionId,
    originBridge: 'desktop',
  })

  // 2. 写回主会话 meta.boardId（渲染进程据此显示「团队」Tab）
  updateAgentSessionMeta(sessionId, { boardId: board.id })

  // 3. 创建 4 条演示任务
  const baseTaskInput = {
    boardId: board.id,
    channelId,
    ...(workspaceId ? { metadata: { workspaceId } } : {}),
  }

  // 3.1 done 任务（已完成）
  const doneTask = kanbanDbService.createTask({
    ...baseTaskInput,
    title: '调研技术选型',
    body: '调研本项目可用的多 Agent 编排方案，输出选型报告',
    priority: 10,
  })
  kanbanDbService.updateTaskStatus(doneTask.id, {
    status: 'done',
    resultSummary: '选定 Electron 内嵌调度器 + headless 子会话方案，避免引入外部 Gateway。',
  })

  // 3.2 running 任务（执行中）—— 创建占位子会话写入 assigneeSessionId
  const runningTask = kanbanDbService.createTask({
    ...baseTaskInput,
    title: '搭建项目脚手架',
    body: '初始化 monorepo 结构、配置 TypeScript + Vite + Tailwind',
    priority: 8,
  })
  const runningSession = createAgentSession(runningTask.title, channelId, workspaceId, 'general')
  updateAgentSessionMeta(runningSession.id, {
    parentBoardId: board.id,
    sourceKanbanTaskId: runningTask.id,
  })
  kanbanDbService.updateTaskStatus(runningTask.id, {
    status: 'running',
    assigneeSessionId: runningSession.id,
  })

  // 3.3 blocked 任务（等待输入）
  const blockedTask = kanbanDbService.createTask({
    ...baseTaskInput,
    title: '设计数据库 Schema',
    body: '设计看板任务表的 SQLite Schema，需等待上游确认字段需求',
    priority: 5,
  })
  kanbanDbService.updateTaskStatus(blockedTask.id, {
    status: 'blocked',
    blockedReason: '等待上游确认 metadata 字段需求（blackboard 范围）',
  })

  // 3.4 pending 任务（待办，依赖解析后会提升为 ready）
  const pendingTask = kanbanDbService.createTask({
    ...baseTaskInput,
    title: '编写集成测试',
    body: '为 kanban-ipc handlers 编写集成测试，覆盖 seedDemo 流程',
    priority: 3,
  })
  // 无依赖，直接提升为 ready（演示用）
  kanbanDbService.resolveReadyTasks()
  void pendingTask

  // 4. 广播变更
  broadcastKanbanChanged()

  const tasks = kanbanDbService.listTasksByBoard(board.id)
  console.log(
    `[看板] 注入演示数据: board=${board.id}, tasks=${tasks.length}, session=${sessionId}`
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
    KANBAN_IPC_CHANNELS.SEED_DEMO,
    async (_event, input: SeedKanbanDemoInput) => {
      return seedDemoKanban(input)
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
}
