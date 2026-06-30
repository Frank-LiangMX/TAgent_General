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

import type { AgentExternalRunSource } from '@tagent/shared'

import { createAgentSession, updateAgentSessionMeta } from './agent-session-manager'
import { runRegisteredHeadlessAgent } from './agent-headless-runner-registry'
import { kanbanDbService } from './kanban-db'

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
  /** 工作区 ID（决定 cwd） */
  workspaceId?: string
  /** 权限模式覆盖（默认 bypassPermissions，与 automation 一致） */
  permissionMode?: 'auto' | 'bypassPermissions'
}

/** 看板上下文契约 */
export interface KanbanWorkerBoardContext {
  /** 看板 ID */
  id: string
  /** 发起会话 ID（用于侧栏父子会话关联展示） */
  parentSessionId: string
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
 */
function buildKanbanWorkerContext(task: KanbanWorkerTask, board: KanbanWorkerBoardContext): string {
  return [
    `这是看板「${board.id}」任务「${task.title}」(${task.id}) 的自动执行。`,
    '本任务由看板调度器派工，请直接执行任务内容，不要建议用户再创建看板或定时任务。',
    '完成后请在回复中给出结论摘要；若已注入 kanban_complete 工具则调用它回写摘要。',
  ].join('\n')
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
          permissionModeOverride: task.permissionMode ?? 'bypassPermissions',
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
