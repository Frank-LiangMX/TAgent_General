/**
 * Kanban（任务看板编排）相关类型定义
 *
 * 长任务多 Agent 编排的内核数据模型。主 Agent 拆解目标 → 任务持久化在 SQLite 看板
 * → 调度器循环派工 → 每条任务由工人（Collaboration 子会话）执行。
 *
 * 设计参考：docs/plans/2026-06-30-task-kanban-orchestration-design.md §3
 */

// ===== 任务状态 =====

/**
 * 看板任务状态机
 * - pending：待办（依赖未满足，等待上游 done 后提升为 ready）
 * - ready：可领取（依赖已满足，等待调度器派工）
 * - running：执行中（工人已领取，子会话运行中）
 * - blocked：等待输入/权限/外部（Phase C IM 交互用，Phase A 内核不产生）
 * - review：待验收（Phase D Verifier 类型任务用）
 * - done：完成
 * - failed：失败
 * - cancelled：取消
 */
export type KanbanTaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'review'
  | 'done'
  | 'failed'
  | 'cancelled'

// ===== 看板任务 =====

/**
 * 看板任务（kanban.db 中的一行）
 *
 * 存储路径：~/.tagent[-dev]/kanban.db（SQLite WAL 模式）
 */
export interface KanbanTask {
  /** 任务 ID，格式 t_xxxx */
  id: string
  /** 所属看板 ID（通常 = 父会话 ID 或 rootGoalId） */
  boardId: string
  /** 父任务 ID（分解树，可选） */
  parentTaskId?: string
  /** 任务标题 */
  title: string
  /** 给工人的 prompt 内容 */
  body: string
  /** 任务状态 */
  status: KanbanTaskStatus
  /** 绑定角色库 ID（见 AgentRoleProfile，Phase B 引入） */
  roleId?: string
  /** 执行子会话 ID（工人领取后写入） */
  assigneeSessionId?: string
  /** AI 渠道 ID，继承自 board，不跨渠道 */
  channelId: string
  /** 模型 ID（可由 roleId 解析，否则继承渠道默认） */
  modelId?: string
  /** 优先级（数字越大越先派工，默认 0） */
  priority: number
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
  /** 开始执行时间戳 */
  startedAt?: number
  /** 完成时间戳 */
  finishedAt?: number
  /** 失败原因（status === 'failed' 时） */
  error?: string
  /** 工人完成后的摘要（status === 'done' 时） */
  resultSummary?: string
  /** 阻塞原因（status === 'blocked' 时） */
  blockedReason?: string
  /** blackboard 共享上下文（Phase D） */
  metadata?: KanbanTaskMetadata
}

/**
 * 看板任务元数据（blackboard 共享上下文）
 *
 * 松散结构：字段都是可选，按需写入。KanbanTask.metadata 历史为 Record<string, unknown>，
 * 此 interface 定义推荐 shape，便于 TypeScript 使用者获得类型提示；
 * 运行时不强制校验，未知字段保留兼容。
 */
export interface KanbanTaskMetadata extends Record<string, unknown> {
  /**
   * 被自动拒绝的 approval 列表（worker 场景防死锁用）
   *
   * worker 在 auto 模式下触发任何 approval（包括 ExitPlanMode / AskUserQuestion）
   * 都会被自动 deny 并追加到此列表，便于事后审计工人执行过程中的卡点。
   */
  blockedApprovals?: BlockedApprovalRecord[]
  /**
   * blackboard 评论列表（D+2 跨任务交接通道）
   *
   * 主会话 / worker 都可写。下一个 worker 启动时会把同板其他 task 的 blackboard
   * 摘要注入 body，作为跨任务上下文交接（参考 hermes kanban_comment）。
   */
  blackboard?: BlackboardComment[]
  /**
   * 进度日志列表（worker 执行过程中的 task_progress 事件记录）
   *
   * 实时推送：orchestrator 收到 SDK task_progress 后追加到此数组，
   * 并通过 kanban:task-progress IPC 广播给前端。
   * 任务终态后不再追加新条目。
   */
  progressLogs?: ProgressLogEntry[]
}

/** 单条 blackboard 评论（跨任务交接通道） */
export interface BlackboardComment {
  /** 评论内容 */
  comment: string
  /** 作者（'main' / 'worker' / worker session id 等） */
  author: string
  /** 时间戳（ms） */
  ts: number
}

/** 单条进度日志（task_progress SDK 事件） */
export interface ProgressLogEntry {
  /** 进度描述（如 "正在分析代码..."） */
  text: string
  /** 当前状态（如 "analyzing" / "writing" / "reviewing"） */
  status?: string
  /** 最近使用的工具名 */
  lastToolName?: string
  /** 时间戳（ms） */
  ts: number
}

/** 单条被自动拒绝的 approval 记录 */
export interface BlockedApprovalRecord {
  /** 触发 approval 的工具名（如 'Write' / 'ExitPlanMode' / 'AskUserQuestion'） */
  tool: string
  /** 工具入参（用于审计具体调用） */
  input: unknown
  /** 拒绝原因（如 'worker auto_deny' / 'worker 场景不支持交互式 approval'） */
  reason: string
  /** 拒绝时间戳（ms） */
  timestamp: number
}

// ===== 看板 =====

/** 看板状态 */
export type KanbanBoardStatus = 'active' | 'completed' | 'cancelled'

/** 看板 IM 来源桥接类型 */
export type KanbanBoardOriginBridge = 'wechat' | 'wps' | 'feishu' | 'dingtalk' | 'desktop'

/** 看板所属模式（双模式隔离用，单 DB + mode 字段过滤） */
export type KanbanBoardMode = 'general' | 'ta'

/**
 * 看板（一个长跑目标的容器）
 *
 * 一个看板包含 N 个任务，任务间通过 KanbanTaskLink 建立依赖。
 * B4 起看板为独立实体：parentSessionId 可选（保留追溯来源），支持全局列表。
 */
export interface KanbanBoard {
  /** 看板 ID */
  id: string
  /** 用户原始目标 */
  rootGoal: string
  /** 发起会话 ID（可选，B4 起看板可脱离会话独立存在） */
  parentSessionId?: string
  /** 看板展示名（全局列表用，不填则用 rootGoal 截断） */
  title?: string
  /** 所属模式（双模式隔离，默认 general） */
  mode: KanbanBoardMode
  /** IM 来源聊天 ID（Bridge 绑定，用于推通知） */
  originChatId?: string
  /** IM 来源桥接类型 */
  originBridge?: KanbanBoardOriginBridge
  /** 看板状态 */
  status: KanbanBoardStatus
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
  /** 该看板最大并发任务数（默认 3，B5 per-board 并发隔离） */
  maxConcurrent: number
  /** 是否暂停调度（true 时 dispatcher 跳过该看板的 ready 任务派工，B5） */
  paused: boolean
  /**
   * 完成后是否需要主会话汇总（B9 事件回流区分）
   *
   * - true：分析/审计/调研/重构总结类任务，交付物是综合报告，
   *   board 全部完成后自动注入 user 消息触发主会话汇总
   * - false（默认）：批量改资产/批量生成文件/批量执行类任务，
   *   交付物是独立文件/资产/task.resultSummary，只发通知不触发主会话
   */
  requireSummary?: boolean
  /**
   * 看板工作目录（worker 子会话项目根）
   *
   * 建板时从主会话 cwd 记录。kanban_add_task 注入 body 时优先用此字段，
   * 让 worker headless 子会话拿到绝对路径，避免到处 Glob/Grep 找项目根。
   * 未记录时 fallback 到主进程 cwd。
   */
  cwd?: string
}

// ===== 任务依赖 =====

/** 任务链接类型 */
export type KanbanTaskLinkType = 'blocks' | 'relates'

/**
 * 任务依赖关系
 *
 * - blocks：fromTaskId 完成（done）前，toTaskId 保持 pending
 * - relates：弱关联，不影响状态机（Phase D blackboard 用）
 */
export interface KanbanTaskLink {
  /** 阻塞方任务 ID（前置任务） */
  fromTaskId: string
  /** 被阻塞方任务 ID（后继任务） */
  toTaskId: string
  /** 链接类型 */
  type: KanbanTaskLinkType
}

// ===== 创建/更新输入 =====

/** 创建看板的输入 */
export interface CreateKanbanBoardInput {
  /** 用户原始目标 */
  rootGoal: string
  /** 发起会话 ID（可选，B4 起看板可脱离会话独立存在） */
  parentSessionId?: string
  /** 看板展示名（可选，不填则用 rootGoal） */
  title?: string
  /** 所属模式（默认 general） */
  mode?: KanbanBoardMode
  /** IM 来源聊天 ID */
  originChatId?: string
  /** IM 来源桥接类型 */
  originBridge?: KanbanBoardOriginBridge
  /** 最大并发任务数（默认 3，B5 per-board 并发隔离） */
  maxConcurrent?: number
  /** 完成后是否需要主会话汇总（B9，默认 false） */
  requireSummary?: boolean
  /** 看板工作目录（worker 子会话项目根，未传则由 orchestrator 兜底填主会话 cwd） */
  cwd?: string
}

/** 创建任务的输入 */
export interface CreateKanbanTaskInput {
  /** 所属看板 ID */
  boardId: string
  /** 父任务 ID */
  parentTaskId?: string
  /** 任务标题 */
  title: string
  /** 给工人的 prompt */
  body?: string
  /** 绑定角色库 ID */
  roleId?: string
  /** AI 渠道 ID */
  channelId: string
  /** 模型 ID */
  modelId?: string
  /** 优先级（默认 0） */
  priority?: number
  /** blackboard 元数据 */
  metadata?: Record<string, unknown>
}

/** 更新任务状态的输入 */
export interface UpdateKanbanTaskStatusInput {
  /** 新状态 */
  status: KanbanTaskStatus
  /** 失败原因 */
  error?: string
  /** 完成摘要 */
  resultSummary?: string
  /** 阻塞原因 */
  blockedReason?: string
  /** 执行子会话 ID */
  assigneeSessionId?: string
}

// ===== 调度器配置 =====

/** 探索期默认最大并发任务数（保守值，避免 kscc 内网过载） */
export const KANBAN_DEFAULT_MAX_CONCURRENT = 3

/** 调度器 tick 周期：每 30s 扫描一次 ready 任务 */
export const KANBAN_TICK_INTERVAL_MS = 30_000

// ===== 渠道模型查询器（跨渠道分配用） =====

/**
 * 渠道模型查询器（用于看板跨渠道模型分配）
 *
 * 支持场景：
 * - kscc 看板：只从 kscc 内部分配模型（禁止跳外部）
 * - 外部 API 看板：可轮询所有外部渠道模型（充分利用资源）
 * - 角色库 channelId：可指定渠道，但需检查合规性（kscc 看板不能跳外部）
 */
export interface KanbanChannelModelsGetter {
  /**
   * 获取指定渠道的所有可用模型 ID
   *
   * @param channelId 渠道 ID
   * @returns 该渠道下已启用模型的 ID 列表
   */
  getModels: (channelId: string) => string[]

  /**
   * 判断渠道是否为 kscc 内网
   *
   * @param channelId 渠道 ID
   * @returns true = kscc 内网渠道（禁止跳外部 API）
   */
  isKsccChannel: (channelId: string) => boolean

  /**
   * 获取所有外部 API 渠道 ID 列表
   *
   * 用于外部看板轮询分配时，获取所有可用外部渠道（openai/deepseek/claude/gemini 等）。
   * kscc 渠道不在此列表中。
   *
   * @returns 外部 API 渠道 ID 列表（已启用且非 kscc）
   */
  getExternalChannels: () => string[]
}
