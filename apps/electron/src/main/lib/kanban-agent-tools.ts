/**
 * 看板 Agent 工具集（Kanban Agent Tools）
 *
 * 仅工具 schema 定义 + handler 骨架，不注入 orchestrator。
 * export buildKanbanAgentTools() 供后续 agent-orchestrator.ts 在 MCP 注入阶段调用
 * （参考 injectAutomationMcpServer 的注入位置，见 agent-orchestrator.ts 中 TODO 注释）。
 *
 * 已接线 kanban-db：所有 handler 调用 kanbanDbService 实现 CRUD。
 *
 * 工具清单（与 docs/plans/2026-06-30-task-kanban-orchestration-design.md §5.3 对齐）：
 * - kanban_create_board：主 Agent 创建看板（rootGoal + parentSessionId）
 * - kanban_add_task：主 Agent / 调度器追加任务
 * - kanban_list_tasks：列出看板下任务（支持状态过滤）
 * - kanban_block：工人标记任务阻塞（缺信息 / 等待外部）
 * - kanban_comment：blackboard 风格注释（任意方；kanban-db 暂无对应 API，待 Phase D）
 *
 * 模式隔离：v1 仅 general 模式注入；TA 模式禁止注入本工具集（见 §6.1） */

import type {
  CreateKanbanBoardInput,
  CreateKanbanTaskInput,
  KanbanBoard,
  KanbanTask,
  KanbanTaskStatus,
} from '@tagent/shared'

import { kanbanDbService } from './kanban-db'

/** MCP 工具结果格式（与 automation-agent-tools 的 AutomationToolResult 一致） */
export interface KanbanToolResult extends Record<string, unknown> {
  content: Array<{ type: 'text'; text: string }>
}

/** 单个看板工具定义：名称 + 描述 + JSON Schema + handler */
export interface KanbanAgentTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<KanbanToolResult>
}

// ===== 工具入参类型（handler 内部参数解析用，与 @tagent/shared 的 Create*Input 对齐） =====

export interface KanbanCreateBoardArgs {
  rootGoal: string
  parentSessionId: string
  originChatId?: string
  originBridge?: 'wechat' | 'wps' | 'feishu' | 'dingtalk' | 'desktop'
}

export interface KanbanAddTaskArgs {
  boardId: string
  title: string
  body: string
  roleId?: string
  channelId: string
  modelId?: string
  priority?: number
  parentTaskId?: string
}

export interface KanbanListTasksArgs {
  boardId: string
  status?:
    | 'pending'
    | 'ready'
    | 'running'
    | 'blocked'
    | 'review'
    | 'done'
    | 'failed'
    | 'cancelled'
}

export interface KanbanBlockArgs {
  taskId: string
  reason: string
}

export interface KanbanCommentArgs {
  taskId: string
  comment: string
}

// ===== 依赖 kanban-db：已接线，直接调用 kanbanDbService =====
//
// kanbanDbService 暴露的方法（与设计 §3 / Phase A DoD 对齐）：
//   createBoard(input): KanbanBoard
//   createTask(input): KanbanTask
//   listTasksByBoard(boardId): KanbanTask[]
//   updateTaskStatus(taskId, update): void
//   （addTaskComment 待 Phase D blackboard 落地）

// ===== 工具辅助 =====

function jsonResult(payload: unknown): KanbanToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  }
}

function assertNonBlank(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} 不能为空`)
  }
  return value.trim()
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

const ALLOWED_ORIGIN_BRIDGES: ReadonlySet<string> = new Set([
  'wechat',
  'wps',
  'feishu',
  'dingtalk',
  'desktop',
])

function parseOriginBridge(value: unknown): KanbanCreateBoardArgs['originBridge'] | undefined {
  if (typeof value !== 'string') return undefined
  return ALLOWED_ORIGIN_BRIDGES.has(value)
    ? (value as KanbanCreateBoardArgs['originBridge'])
    : undefined
}

const ALLOWED_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'ready',
  'running',
  'blocked',
  'review',
  'done',
  'failed',
  'cancelled',
])

function parseStatus(value: unknown): KanbanListTasksArgs['status'] | undefined {
  if (typeof value !== 'string') return undefined
  return ALLOWED_STATUSES.has(value) ? (value as KanbanListTasksArgs['status']) : undefined
}

// ===== 工具 schema（JSON Schema） =====

const kanbanCreateBoardSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    rootGoal: {
      type: 'string',
      description: '用户原始目标（看板根任务，会作为 root 任务标题展示）',
    },
    parentSessionId: {
      type: 'string',
      description: '发起该看板的 Agent 会话 ID（用于侧栏父子会话关联）',
    },
    originChatId: {
      type: 'string',
      description: '可选：IM 来源 chatId（用于回推完成通知）',
    },
    originBridge: {
      type: 'string',
      enum: ['wechat', 'wps', 'feishu', 'dingtalk', 'desktop'],
      description: '可选：IM 来源桥类型',
    },
  },
  required: ['rootGoal', 'parentSessionId'],
  additionalProperties: false,
}

const kanbanAddTaskSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    boardId: { type: 'string', description: '所属看板 ID' },
    title: { type: 'string', description: '任务标题（一行简述）' },
    body: { type: 'string', description: '给工人的完整 prompt' },
    roleId: { type: 'string', description: '可选：绑定角色库 ID（决定 model / 权限）' },
    channelId: {
      type: 'string',
      description: '可选：覆盖看板默认渠道（v1 不推荐跨渠道）',
    },
    modelId: { type: 'string', description: '可选：指定模型 ID（否则由 roleId 解析）' },
    priority: {
      type: 'number',
      description: '可选：优先级（数字越大越优先；默认 0）',
    },
    parentTaskId: { type: 'string', description: '可选：父任务 ID（构建分解树）' },
  },
  required: ['boardId', 'title', 'channelId'],
  additionalProperties: false,
}

const kanbanListTasksSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    boardId: { type: 'string', description: '看板 ID' },
    status: {
      type: 'string',
      enum: ['pending', 'ready', 'running', 'blocked', 'review', 'done', 'failed', 'cancelled'],
      description: '可选：按状态过滤（不传则列出全部）',
    },
  },
  required: ['boardId'],
  additionalProperties: false,
}

const kanbanBlockSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    taskId: { type: 'string', description: '要标记阻塞的任务 ID' },
    reason: {
      type: 'string',
      description: '阻塞原因（缺信息 / 等待外部输入 / 权限不足等）',
    },
  },
  required: ['taskId', 'reason'],
  additionalProperties: false,
}

const kanbanCommentSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    taskId: { type: 'string', description: '目标任务 ID' },
    comment: { type: 'string', description: '注释内容（写入任务 metadata.blackboard）' },
  },
  required: ['taskId', 'comment'],
  additionalProperties: false,
}

// ===== 工具 handler =====

async function handleCreateBoard(args: Record<string, unknown>): Promise<KanbanToolResult> {
  const input: CreateKanbanBoardInput = {
    rootGoal: assertNonBlank(args.rootGoal, 'rootGoal'),
    parentSessionId: assertNonBlank(args.parentSessionId, 'parentSessionId'),
    originChatId: optionalString(args.originChatId),
    originBridge: parseOriginBridge(args.originBridge),
  }
  const board: KanbanBoard = kanbanDbService.createBoard(input)
  return jsonResult({ boardId: board.id, created: true })
}

async function handleAddTask(args: Record<string, unknown>): Promise<KanbanToolResult> {
  const input: CreateKanbanTaskInput = {
    boardId: assertNonBlank(args.boardId, 'boardId'),
    title: assertNonBlank(args.title, 'title'),
    body: optionalString(args.body) ?? '',
    roleId: optionalString(args.roleId),
    channelId: assertNonBlank(args.channelId, 'channelId'),
    modelId: optionalString(args.modelId),
    priority:
      typeof args.priority === 'number' && Number.isFinite(args.priority) ? args.priority : undefined,
    parentTaskId: optionalString(args.parentTaskId),
  }
  const task: KanbanTask = kanbanDbService.createTask(input)
  return jsonResult({ taskId: task.id, created: true })
}

async function handleListTasks(args: Record<string, unknown>): Promise<KanbanToolResult> {
  const boardId = assertNonBlank(args.boardId, 'boardId')
  const statusFilter = parseStatus(args.status) as KanbanTaskStatus | undefined
  const allTasks: KanbanTask[] = kanbanDbService.listTasksByBoard(boardId)
  const tasks =
    statusFilter === undefined ? allTasks : allTasks.filter((t) => t.status === statusFilter)
  return jsonResult({ tasks, count: tasks.length })
}

async function handleBlock(args: Record<string, unknown>): Promise<KanbanToolResult> {
  const taskId = assertNonBlank(args.taskId, 'taskId')
  const reason = assertNonBlank(args.reason, 'reason')
  kanbanDbService.updateTaskStatus(taskId, {
    status: 'blocked',
    blockedReason: reason,
  })
  return jsonResult({ taskId, status: 'blocked', reason })
}

async function handleComment(args: Record<string, unknown>): Promise<KanbanToolResult> {
  const taskId = assertNonBlank(args.taskId, 'taskId')
  const comment = assertNonBlank(args.comment, 'comment')
  // TODO(kanban): kanban-db 尚未提供 addTaskComment / metadata 更新 API，
  // Phase D blackboard 落地后补齐。当前返回「未实现」错误，调用方应感知。
  void taskId
  void comment
  throw new Error(
    '[看板工具] kanban_comment 尚未实现：kanban-db 未提供 addTaskComment / metadata 更新 API（待 Phase D）'
  )
}

// ===== 构建工具表 =====

/**
 * 构建看板 Agent 工具表
 *
 * 返回 `Record<toolName, KanbanAgentTool>`，供后续 orchestrator 注入 MCP 时遍历包装为
 * `sdk.tool(...)` 调用（参考 automation-agent-tools.ts 的 injectAutomationMcpServer 实现）。
 */
export function buildKanbanAgentTools(): Record<string, KanbanAgentTool> {
  return {
    kanban_create_board: {
      name: 'kanban_create_board',
      description:
        '创建 TAgent 看板（长任务多 Agent 编排容器）。传入 rootGoal 与发起会话 ID，调度器会自动 tick 派工。仅 general 模式可用。',
      inputSchema: kanbanCreateBoardSchema,
      handler: handleCreateBoard,
    },
    kanban_add_task: {
      name: 'kanban_add_task',
      description:
        '向看板追加任务。每个任务由调度器派给一个 headless 工人子会话执行。可指定角色 / 模型 / 优先级 / 父任务。',
      inputSchema: kanbanAddTaskSchema,
      handler: handleAddTask,
    },
    kanban_list_tasks: {
      name: 'kanban_list_tasks',
      description:
        '列出看板下的任务，支持按状态过滤（pending/ready/running/blocked/review/done/failed/cancelled）。',
      inputSchema: kanbanListTasksSchema,
      handler: handleListTasks,
    },
    kanban_block: {
      name: 'kanban_block',
      description:
        '工人标记当前任务阻塞（缺信息 / 等待外部输入 / 权限不足）。阻塞后会触发 IM 通知，等待用户回复 unblock。',
      inputSchema: kanbanBlockSchema,
      handler: handleBlock,
    },
    kanban_comment: {
      name: 'kanban_comment',
      description:
        '向任务的 blackboard 写入注释（任意方可调用，用于跨任务共享上下文 / 备注）。',
      inputSchema: kanbanCommentSchema,
      handler: handleComment,
    },
  }
}
