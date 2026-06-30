/**
 * Kanban 看板 IPC 通道常量与请求/响应类型
 *
 * 渲染进程通过 window.electronAPI.kanban.* 调用，主进程在 main/ipc.ts 注册处理器。
 * 通道命名与 automation 一致：动词:名词 形式，CHANGED 为 main→renderer 广播。
 */

import type { KanbanBoard, KanbanTask } from './kanban'

/** Kanban 相关 IPC 通道常量 */
export const KANBAN_IPC_CHANNELS = {
  /** 列出某看板下全部任务 */
  LIST_TASKS: 'kanban:list-tasks',
  /** 获取看板信息 */
  GET_BOARD: 'kanban:get-board',
  /** 注入演示数据（创建 board + 4 条 mock 任务，验证 UI 用） */
  SEED_DEMO: 'kanban:seed-demo',
  /** 看板数据变更事件（main → renderer，任务状态变化时推送） */
  CHANGED: 'kanban:changed',
  /** 暂停看板调度（停止 tick，不清空在途任务） */
  PAUSE_BOARD: 'kanban:pause-board',
  /** 恢复看板调度 */
  RESUME_BOARD: 'kanban:resume-board',
  /** 解除任务阻塞（blocked → ready） */
  UNBLOCK_TASK: 'kanban:unblock-task',
} as const

/** seedDemo 输入 */
export interface SeedKanbanDemoInput {
  /** 主会话 ID（作为 board.parentSessionId，并写回 meta.boardId） */
  sessionId: string
  /** AI 渠道 ID（任务继承） */
  channelId: string
  /** 工作区 ID（创建工人子会话时使用，可选） */
  workspaceId?: string
}

/** seedDemo 返回 */
export interface SeedKanbanDemoResult {
  /** 创建的看板 ID */
  boardId: string
  /** 创建的任务列表 */
  tasks: KanbanTask[]
  /** 看板信息 */
  board: KanbanBoard
}

/** 解除阻塞输入 */
export interface UnblockKanbanTaskInput {
  /** 任务 ID */
  taskId: string
  /** 可选：解除原因（写入 metadata.unblockReason） */
  reason?: string
}
