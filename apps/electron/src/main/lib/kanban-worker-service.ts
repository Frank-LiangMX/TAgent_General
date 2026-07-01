/**
 * 看板工人服务（Kanban Worker Service）
 *
 * 把一条看板任务以 headless Agent 子会话形式执行。
 * 参考 automation-scheduler 的「createAgentSession + runRegisteredHeadlessAgent」模式。
 *
 * 职责：
 * - 为 task 创建独立子会话（写入 parentBoardId / sourceKanbanTaskId 到 AgentSessionMeta）
 * - 通过 runRegisteredHeadlessAgent headless 执行，triggeredBy='kanban'
 * - 强制 bypassPermissions（无人值守写操作场景必备，否则会因权限弹窗永久阻塞）
 * - 防递归 prompt 前缀（避免工人再创建看板 / automation）
 * - 完成回调 → updater.markTaskDone；失败 → updater.markTaskFailed
 *
 * 已接线 kanban-db：createKanbanDbUpdater() 工厂调用 kanbanDbService.updateTaskStatus，
 * dispatcher 默认注入真实 updater；测试可 options.updater 注入 mock。
 *
 * KanbanWorkerTask / KanbanWorkerBoardContext 为本文件最小契约，字段命名与
 * @tagent/shared 的 KanbanTask / KanbanBoard 对齐，Phase B 可直接复用完整类型。
 *
 * 模式隔离：v1 仅 general 模式可调用本服务；TA 模式禁止创建看板
 * （见 docs/plans/2026-06-30-task-kanban-orchestration-design.md §6.1）。
 * 调用方应自行判断 mode==='general'，本服务不再二次校验。
 */

import { powerSaveBlocker } from 'electron'

import type { AgentExternalRunSource, SDKMessage } from '@tagent/shared'

import { createAgentSession, getAgentSessionSDKMessages, updateAgentSessionMeta } from './agent-session-manager'
import { runRegisteredHeadlessAgent } from './agent-headless-runner-registry'
import { kanbanDbService } from './kanban-db'
import { getRoleById } from './agent-role-service'
import type { KanbanWorkerRunner } from './kanban-dispatcher'

/**
 * 看板工人任务契约
 *
 * 仅声明 runKanbanTaskHeadless 实际读取的字段，避免与 kanban-db 完整 KanbanTask 类型耦合。
 * 字段命名与 @tagent/shared KanbanTask 对齐，Phase B 可直接复用。
 */
export interface KanbanWorkerTask {
  /** 任务 ID（形如 t_xxxx） */
  id: string
  /** 所属看板 ID */
  boardId: string
  /** 任务标题（用于子会话标题） */
  title: string
  /** 给工人的 prompt */
  body: string
  /** 渠道 ID（继承自 board，不跨渠道） */
  channelId: string
  /** 模型 ID（可由 roleId 解析；为空时由 orchestrator 兜底默认模型） */
  modelId?: string
  /** 角色 ID（绑定角色库，worker 启动时注入 role.systemPrompt + permissionMode） */
  roleId?: string
  /** 工作区 ID（决定 cwd） */
  workspaceId?: string
  /** 权限模式覆盖（默认 bypassPermissions，与 automation 一致；role.permissionMode 优先） */
  permissionMode?: 'auto' | 'bypassPermissions'
}

/** 看板上下文契约 */
export interface KanbanWorkerBoardContext {
  /** 看板 ID */
  id: string
  /** 发起会话 ID（可选，B4 起看板可脱离会话独立存在） */
  parentSessionId?: string
  /** IM 来源 chatId（可选，未来用于回推进度卡片） */
  originChatId?: string
  /** IM 来源桥（可选，与 originChatId 一起用于 IM 通知） */
  originBridge?: 'wechat' | 'wps' | 'feishu' | 'dingtalk' | 'desktop'
}

/**
 * 任务状态回流接口（依赖注入）
 *
 * 默认由 createKanbanDbUpdater() 创建，调用 kanbanDbService.updateTaskStatus。
 * dispatcher 也可通过 options.updater 注入自定义实现（如测试 mock）。
 */
export interface KanbanTaskUpdater {
  /** 标记任务进入 running，记录执行子会话 ID 与开始时间戳 */
  markTaskRunning(taskId: string, sessionId: string, startedAt: number): void
  /** 标记任务完成，可选携带工人摘要 */
  markTaskDone(taskId: string, summary?: string): void
  /** 标记任务失败，携带错误信息 */
  markTaskFailed(taskId: string, error: string): void
}

/**
 * 创建基于 kanbanDbService 的真实任务状态回流器
 *
 * - markTaskRunning：updateTaskStatus(running, assigneeSessionId)
 * - markTaskDone：updateTaskStatus(done, resultSummary)
 * - markTaskFailed：updateTaskStatus(failed, error)
 *
 * startedAt 由 kanban-db 在 status='running' 时自动写入，此处不显式传。
 */
export function createKanbanDbUpdater(): KanbanTaskUpdater {
  return {
    markTaskRunning: (taskId, sessionId) => {
      kanbanDbService.updateTaskStatus(taskId, {
        status: 'running',
        assigneeSessionId: sessionId,
      })
    },
    markTaskDone: (taskId, summary) => {
      kanbanDbService.updateTaskStatus(taskId, {
        status: 'done',
        resultSummary: summary,
      })
    },
    markTaskFailed: (taskId, error) => {
      kanbanDbService.updateTaskStatus(taskId, {
        status: 'failed',
        error,
      })
    },
  }
}

export interface RunKanbanTaskHeadlessOptions {
  /** 任务状态回流器；默认 createKanbanDbUpdater()（调用 kanbanDbService） */
  updater?: KanbanTaskUpdater
  /** 任务开始回调（dispatcher 用于并发计数 / IM 通知） */
  onTaskStarted?: (taskId: string, sessionId: string) => void
  /** 任务结束回调（dispatcher 用于推进 ready / IM 通知；status 区分 done / failed） */
  onTaskCompleted?: (
    taskId: string,
    status: 'done' | 'failed',
    summary?: string,
    error?: string
  ) => void
  /** 触发来源标识，传给 HeadlessAgentRunCallbacks.source（默认 'bridge'，与 automation 一致） */
  source?: AgentExternalRunSource
}

/**
 * 防递归 prompt 前缀：告诉工人这是看板任务执行，不要再创建看板 / automation。
 * 对标 automation-scheduler 的 automationContext 思路。
 *
 * 如果 task.roleId 存在，查角色库追加 role.systemPrompt（定义工人专业能力边界）。
 * role.systemPrompt 放在防递归前缀之前，让工人先理解自己的角色，再接收执行约束。
 */
function buildKanbanWorkerContext(task: KanbanWorkerTask, board: KanbanWorkerBoardContext): string {
  const lines: string[] = []

  // 角色库 prompt（如果 task 绑定了 roleId）
  if (task.roleId) {
    const role = getRoleById(task.roleId)
    if (role) {
      lines.push(`【角色：${role.displayName}】`)
      lines.push(role.systemPrompt)
      lines.push('') // 空行分隔角色 prompt 和执行约束
    } else {
      console.warn(`[看板] 角色 ${task.roleId} 不存在，跳过角色 prompt 注入`)
    }
  }

  lines.push(
    `这是看板「${board.id}」任务「${task.title}」(${task.id}) 的自动执行。`,
    '本任务由看板调度器派工，请直接执行任务内容，不要建议用户再创建看板或定时任务。',
    '完成后请在回复中给出完整的结论摘要（无长度限制，系统会自动提取最后一条 assistant 回复作为任务结果存储）。',
    '不要尝试调用 kanban_comment / kanban_complete 等工具，工人子会话不注入看板工具集（防递归）。'
  )

  return lines.join('\n')
}

/**
 * 解析 worker 的权限模式
 *
 * 优先级：
 * 1. task.permissionMode（显式指定，最高）
 * 2. role.permissionMode（task 绑定 roleId 时，角色库定义）
 * 3. 默认 bypassPermissions（与 automation 一致，无人值守写操作必备）
 */
function resolvePermissionMode(task: KanbanWorkerTask): 'auto' | 'bypassPermissions' {
  if (task.permissionMode) return task.permissionMode
  if (task.roleId) {
    const role = getRoleById(task.roleId)
    if (role?.permissionMode) return role.permissionMode
  }
  return 'bypassPermissions'
}

/**
 * 从工人子会话消息中提取最后一条 assistant 文本作为任务摘要
 *
 * 扫描顺序：从后往前找最后一条 SDKAssistantMessage，取其 content 里的 text 块拼接。
 * 跳过纯工具调用 / thinking 的 assistant 消息（没有 text 块时继续往前找）。
 * 找不到返回 undefined（markTaskDone 不写 resultSummary）。
 *
 * 不截断：完整存储工人最后一条回复，便于主会话回流汇总。
 * SQLite TEXT 字段无长度限制，几 KB 摘要完全可存。
 */
function extractLastAssistantSummary(sessionId: string): string | undefined {
  const messages = getAgentSessionSDKMessages(sessionId)
  if (messages.length === 0) return undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.type !== 'assistant') continue
    // 显式断言为 SDKAssistantMessage，TS 对联合类型 + optional 字段的收窄不够
    const assistantMsg = msg as { message?: { content?: Array<{ type: string; text?: string }> } }
    const content = assistantMsg.message?.content
    if (!Array.isArray(content)) continue
    const textBlocks = content.filter(
      (b): b is { type: 'text'; text: string } => b.type === 'text' && typeof b.text === 'string'
    )
    if (textBlocks.length === 0) continue
    const text = textBlocks.map((b) => b.text).join('').trim()
    if (!text) continue
    return text
  }
  return undefined
}

/**
 * 为看板任务创建子会话并 headless 执行
 *
 * 流程：
 * 1. createAgentSession（mode='general'）→ updateAgentSessionMeta 写入 parentBoardId / sourceKanbanTaskId
 * 2. updater.markTaskRunning → onTaskStarted
 * 3. runRegisteredHeadlessAgent（triggeredBy='kanban'、permissionModeOverride 默认 bypassPermissions）
 * 4. onComplete → updater.markTaskDone（summary 留空，由后续工具回调补写）→ onTaskCompleted
 *    onError → updater.markTaskFailed → onTaskCompleted
 *
 * 不抛错：所有异常都被捕获并回流到 updater.markTaskFailed / onTaskCompleted('failed')，
 * 调用方（dispatcher）无需 try/catch 即可推进状态机。
 *
 * @param task 看板任务（最小契约）
 * @param boardContext 所属看板上下文
 * @param options 状态回流 / 完成回调
 */
export async function runKanbanTaskHeadless(
  task: KanbanWorkerTask,
  boardContext: KanbanWorkerBoardContext,
  options: RunKanbanTaskHeadlessOptions = {}
): Promise<void> {
  const updater = options.updater ?? createKanbanDbUpdater()
  const startedAt = Date.now()

  // 1. 创建子会话（标题用任务标题，便于侧栏识别）；mode 强制 general，TA 模式禁止创建看板
  const session = createAgentSession(task.title, task.channelId, task.workspaceId, 'general')
  updateAgentSessionMeta(session.id, {
    parentBoardId: boardContext.id,
    sourceKanbanTaskId: task.id,
  })

  // 2. 标记任务进入 running（防 dispatcher 同任务重入；记录 sessionId 便于侧栏关联）
  //    startedAt 由 kanban-db 在 status='running' 时自动写入，这里只作为回调信息透传
  updater.markTaskRunning(task.id, session.id, startedAt)
  options.onTaskStarted?.(task.id, session.id)

  // 3. 防休眠（与 automation-scheduler 一致，避免长任务期间系统休眠）
  const blockerId = powerSaveBlocker.start('prevent-app-suspension')

  try {
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = (status: 'done' | 'failed', error?: string): void => {
        if (settled) return
        settled = true
        if (status === 'done') {
          // done + summary 由 dispatcher 根据 runner 返回值写
          // （createKanbanHeadlessRunner 的 runner 会从工人会话提取 summary 返回）
          // 此处 markTaskDone 在 createRunningOnlyUpdater 是 no-op
          updater.markTaskDone(task.id)
        } else {
          updater.markTaskFailed(task.id, error ?? '未知错误')
        }
        options.onTaskCompleted?.(task.id, status, undefined, error)
        resolve()
      }

      runRegisteredHeadlessAgent(
        {
          sessionId: session.id,
          userMessage: task.body + '\n<!--TAGENT_KANBAN_WORKER-->',
          automationContext: buildKanbanWorkerContext(task, boardContext),
          channelId: task.channelId,
          modelId: task.modelId,
          workspaceId: task.workspaceId,
          // 权限模式优先级：task.permissionMode > role.permissionMode > 默认 bypassPermissions
          permissionModeOverride: resolvePermissionMode(task),
          triggeredBy: 'kanban',
          startedAt,
        },
        {
          source: options.source ?? 'bridge',
          onError: (error) => finish('failed', error),
          onComplete: () => finish('done'),
          onTitleUpdated: () => {
            /* 子会话标题不需要特殊处理 */
          },
        }
      ).catch((err) => {
        finish('failed', err instanceof Error ? err.message : '未知错误')
      })
    })
  } finally {
    if (powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId)
  }
}

/**
 * 创建「仅写 running」的 updater（dispatcher 注入真实 runner 场景用）
 *
 * 为什么 done/failed 不写：dispatcher 会根据 runner 返回值统一写 status=done + resultSummary
 * （summary 由 runner 通过 extractLastAssistantSummary 提取返回），本处只负责 running + assigneeSessionId。
 */
function createRunningOnlyUpdater(): KanbanTaskUpdater {
  return {
    markTaskRunning: (taskId, sessionId) => {
      kanbanDbService.updateTaskStatus(taskId, {
        status: 'running',
        assigneeSessionId: sessionId,
      })
    },
    markTaskDone: () => {
      // no-op：done + summary 由 dispatcher 根据 runner 返回值写
    },
    markTaskFailed: () => {
      // no-op：failed + error 由 dispatcher 根据 runner 返回值写
    },
  }
}

/**
 * 把 runKanbanTaskHeadless 包装为 KanbanWorkerRunner（dispatcher 注入用）
 *
 * 替代 kanban-bootstrap 的 mockWorkerRunner，让看板任务通过真实 headless Agent 子会话执行。
 *
 * - 从 DB 读 board 构造 boardContext（parentSessionId / originChatId / originBridge）
 * - 用 createRunningOnlyUpdater()：只写 running + assigneeSessionId
 *   （done/failed 状态由 dispatcher 根据 runner 返回值写，但 summary 由 runner 提取返回）
 * - 通过 onTaskCompleted 捕获 error 返回给 dispatcher，dispatcher 据此写 failed + error
 * - summary 通过 extractLastAssistantSummary 提取，作为 runner 返回值传给 dispatcher
 */
export function createKanbanHeadlessRunner(): KanbanWorkerRunner {
  return async (task) => {
    const board = kanbanDbService.getBoard(task.boardId)
    if (!board) {
      return { error: `看板不存在: ${task.boardId}` }
    }
    const boardContext: KanbanWorkerBoardContext = {
      id: board.id,
      parentSessionId: board.parentSessionId,
      originChatId: board.originChatId,
      originBridge: board.originBridge,
    }
    let capturedError: string | undefined
    let workerSessionId: string | undefined
    await runKanbanTaskHeadless(task, boardContext, {
      updater: createRunningOnlyUpdater(),
      onTaskStarted: (_taskId, sessionId) => {
        workerSessionId = sessionId
      },
      onTaskCompleted: (_taskId, status, _summary, error) => {
        if (status === 'failed') {
          capturedError = error ?? '未知错误'
        }
      },
    })
    // 成功时从工人会话提取最后一条 assistant 文本作为 summary 返回给 dispatcher
    if (!capturedError && workerSessionId) {
      const summary = extractLastAssistantSummary(workerSessionId)
      return { summary }
    }
    return { error: capturedError }
  }
}
