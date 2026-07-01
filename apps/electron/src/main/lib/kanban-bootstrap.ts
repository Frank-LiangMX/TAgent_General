/**
 * Kanban 看板子系统启动器
 *
 * 由 main/index.ts 在 bootstrap 阶段调用 initKanbanSubsystem()。
 * 职责：
 * 1. 初始化 kanban-db（SQLite，~/.tagent[-dev]/kanban.db）
 * 2. 配置 dispatcher（注入真实 headless runner + db，per-board 并发上限由 board.maxConcurrent 控制）
 * 3. 启动 dispatcher tick（30s 轮询 ready 任务）
 *
 * 真实 runner（createKanbanHeadlessRunner）通过 runKanbanTaskHeadless 拉起
 * headless Agent 子会话执行任务，triggeredBy='kanban'、bypassPermissions、
 * 防递归 prompt。headless runner 由 agent-service.ts 在模块加载时注入。
 */

import { kanbanDbService } from './kanban-db'
import {
  configureKanbanDispatcher,
  startKanbanDispatcher,
} from './kanban-dispatcher'
import { broadcastKanbanChanged, broadcastBoardCompleted } from './kanban-ipc'
import { createKanbanHeadlessRunner } from './kanban-worker-service'
import { listChannels } from './channel-manager'
import { getSettings } from './settings-service'

/**
 * 渠道可用模型查询器（注入 dispatcher，用于模型轮询分配避免降智）
 *
 * 返回指定渠道的所有已启用模型 ID 列表。严格用渠道已有模型，不创造。
 * 优先 kscc 渠道（免费），其他渠道按需返回。
 *
 * 优先级：若设置页 preferFreeChannel=true（默认），kscc 渠道的模型排前面；
 * 否则按渠道 models 顺序返回。
 */
function getAvailableModelsForChannel(channelId: string): string[] {
  const channels = listChannels()
  const channel = channels.find((c) => c.id === channelId)
  if (!channel) return []
  const enabledModels = channel.models.filter((m) => m.enabled).map((m) => m.id)
  if (enabledModels.length === 0) return []

  // 优先免费渠道：kscc 的模型排前面（如果当前渠道不是 kscc 但也是免费的，保持原序）
  // 这里只做渠道内排序，不跨渠道混合
  const settings = getSettings()
  const preferFree = settings.agentBehavior?.preferFreeChannel ?? true
  if (preferFree && channel.provider === 'kscc-internal') {
    // kscc 渠道内模型按能力优先级排（glm-5.1 通用、glm-5.2 强、kimi 系列备选）
    const priority = ['glm-5.1', 'glm-5.2', 'kimi-k2.5', 'kimi-k2.6', 'mimo-v2.5', 'mimo-v2.5-pro']
    return [...enabledModels].sort((a, b) => {
      const ai = priority.indexOf(a)
      const bi = priority.indexOf(b)
      // 不在 priority 列表的排最后，保持原序
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }
  return enabledModels
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

  // 1.5 启动恢复：把残留的 running 任务重置为 ready
  // 场景：程序异常退出 / 用户强关时，DB 里可能有 status=running 但无工人在跑的任务
  const recovered = kanbanDbService.resetStaleRunningToReady()
  if (recovered > 0) {
    console.log(`[看板] 启动恢复：${recovered} 个残留 running 任务已重置为 ready，将重新派工`)
  }

  // 2. 配置 dispatcher（注入真实 headless runner + 状态变更广播 + 模型轮询）
  // B5：并发上限改为 per-board（board.maxConcurrent），dispatcher 不再持有全局 maxConcurrent
  // 模型分配：未指定 modelId 的任务按渠道可用模型 round-robin，单模型并发上限避免降智
  // maxConcurrentPerModel 通过 getMaxConcurrentPerModel 动态读设置（支持热更新，无需重启 dispatcher）
  const agentBehavior = getSettings().agentBehavior
  const initialMaxPerModel = agentBehavior?.maxConcurrentPerModel ?? 2
  configureKanbanDispatcher({
    runner: createKanbanHeadlessRunner(),
    db: kanbanDbService,
    getAvailableModels: getAvailableModelsForChannel,
    maxConcurrentPerModel: initialMaxPerModel,
    getMaxConcurrentPerModel: () => getSettings().agentBehavior?.maxConcurrentPerModel ?? 2,
    onTaskStatusChanged: () => {
      // dispatcher 直接调 db.updateTaskStatus 不走 IPC handler，
      // 需要在此触发广播，否则 UI 不知道任务状态变了
      broadcastKanbanChanged()
    },
    onBoardCompleted: (boardId, parentSessionId, requireSummary, summary) => {
      // 看板全部任务完成 → 广播 IPC 事件给渲染层
      // 渲染层根据 requireSummary 决定是否自动注入 user 消息触发主会话汇总
      broadcastBoardCompleted(boardId, parentSessionId, requireSummary, summary)
    },
  })

  // 3. 启动调度器 tick（30s）
  startKanbanDispatcher()

  console.log('[看板] 子系统已初始化（真实 headless runner）')
}

/** 手动触发看板变更广播（测试 / 外部调用用） */
export function notifyKanbanChanged(): void {
  broadcastKanbanChanged()
}
