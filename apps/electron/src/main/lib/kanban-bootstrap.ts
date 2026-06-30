/**
 * Kanban 看板子系统启动器
 *
 * 由 main/index.ts 在 bootstrap 阶段调用 initKanbanSubsystem()。
 * 职责：
 * 1. 初始化 kanban-db（SQLite，~/.tagent[-dev]/kanban.db）
 * 2. 配置 dispatcher（注入 WorkerRunner + db + maxConcurrent）
 * 3. 启动 dispatcher tick（30s 轮询 ready 任务）
 *
 * WorkerRunner demo 模式：mock runner 立即返回 done，不派真 agent。
 * seedDemoKanban 创建的演示任务已通过 kanbanDbService.updateTaskStatus 直接置位，
 * 不依赖 dispatcher 派工，因此 demo 验证无需真实 runner。
 *
 * 真实 runner（kanban-worker-service.runKanbanTaskHeadless）在 Phase B 接线，
 * 届时替换 mockRunner 即可。
 */

import type { KanbanTask } from '@tagent/shared'

import { kanbanDbService } from './kanban-db'
import {
  configureKanbanDispatcher,
  startKanbanDispatcher,
  type KanbanWorkerRunner,
} from './kanban-dispatcher'
import { broadcastKanbanChanged } from './kanban-ipc'

/** Demo 模式 WorkerRunner：立即标记任务为 done，不派真 agent */
const mockWorkerRunner: KanbanWorkerRunner = async (task: KanbanTask) => {
  console.log(`[看板] (demo) 模拟执行任务: ${task.id} (${task.title})`)
  // 立即返回成功摘要，dispatcher 会据此 updateTaskStatus(done)
  return { summary: `(demo) 任务「${task.title}」模拟执行完成` }
}

/**
 * 初始化 Kanban 子系统
 *
 * 幂等：重复调用不会重复初始化（kanbanDbService.initialize 内部会判断，
 * dispatcher 的 startKanbanDispatcher 也是幂等的）。
 */
export function initKanbanSubsystem(): void {
  // 1. 初始化数据库
  const result = kanbanDbService.initialize()
  if (!result.success) {
    console.error('[看板] 子系统初始化失败：数据库未就绪，看板功能不可用')
    return
  }

  // 2. 配置 dispatcher（注入 mock runner，Phase B 替换为真实 runner）
  configureKanbanDispatcher({
    runner: mockWorkerRunner,
    db: kanbanDbService,
    maxConcurrent: 3,
  })

  // 3. 启动调度器 tick（30s）
  startKanbanDispatcher()

  console.log('[看板] 子系统已初始化（demo 模式 runner）')
}

/** 手动触发看板变更广播（测试 / 外部调用用） */
export function notifyKanbanChanged(): void {
  broadcastKanbanChanged()
}
