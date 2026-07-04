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
import { configureKanbanDispatcher, startKanbanDispatcher } from './kanban-dispatcher'
import { broadcastKanbanChanged, broadcastBoardCompleted } from './kanban-ipc'
import { createKanbanHeadlessRunner } from './kanban-worker-service'
import { listChannels, getChannelById } from './channel-manager'
import { getSettings } from './settings-service'
import type { KanbanChannelModelsGetter } from '@tagent/shared'

/**
 * 渠道模型查询器（新版，支持跨渠道轮询 + kscc 合规检查）
 *
 * 核心逻辑：
 * - kscc 看板：只从 kscc 内部分配模型（禁止跳外部 API）
 * - 外部 API 看板：可轮询所有外部渠道模型（充分利用资源）
 * - 角色库 channelId：可指定渠道，但需检查合规性（kscc 看板不能跳外部）
 */
const channelModelsGetter: KanbanChannelModelsGetter = {
  /**
   * 获取指定渠道的所有已启用模型 ID
   */
  getModels: (channelId: string): string[] => {
    const channel = getChannelById(channelId)
    if (!channel) return []
    const enabledModels = channel.models.filter((m: { enabled: boolean; id: string }) => m.enabled).map((m: { id: string }) => m.id)
    if (enabledModels.length === 0) return []

    // 优先免费渠道：kscc 的模型按能力优先级排序
    const settings = getSettings()
    const preferFree = settings.agentBehavior?.preferFreeChannel ?? true
    if (preferFree && channel.provider === 'kscc-internal') {
      const priority = ['glm-5.1', 'glm-5.2', 'kimi-k2.5', 'kimi-k2.6', 'mimo-v2.5', 'mimo-v2.5-pro']
      return [...enabledModels].sort((a, b) => {
        const ai = priority.indexOf(a)
        const bi = priority.indexOf(b)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    }
    return enabledModels
  },

  /**
   * 判断渠道是否为 kscc 内网
   */
  isKsccChannel: (channelId: string): boolean => {
    const channel = getChannelById(channelId)
    return channel?.provider === 'kscc-internal'
  },

  /**
   * 获取所有外部 API 渠道 ID 列表（用于外部看板轮询）
   */
  getExternalChannels: (): string[] => {
    const channels = listChannels()
    return channels
      .filter(ch => ch.enabled && ch.provider !== 'kscc-internal')
      .map(ch => ch.id)
  }
}

/**
 * 根据模型 ID 反查所属渠道
 *
 * 用于检查显式指定 task.modelId 或角色库 modelPool 的合规性。
 */
function findModelChannelById(modelId: string): string | undefined {
  const channels = listChannels()
  for (const ch of channels) {
    if (ch.models?.some(m => m.id === modelId && m.enabled)) {
      return ch.id
    }
  }
  return undefined
}

/**
 * 渠道可用模型查询器（旧版，已废弃）
 *
 * @deprecated 保留兼容性，实际使用 channelModelsGetter
 */
function getAvailableModelsForChannel(channelId: string): string[] {
  return channelModelsGetter.getModels(channelId)
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

  // 2. 配置 dispatcher（注入真实 headless runner + 状态变更广播 + 跨渠道模型分配）
  // B5：并发上限改为 per-board（board.maxConcurrent），dispatcher 不再持有全局 maxConcurrent
  // 模型分配（2026-07-04 改进）：
  // - kscc 看板：只从 kscc 内部分配（禁止跳外部）
  // - 外部看板：轮询所有外部渠道模型
  // - 角色库 channelId：可指定渠道，但需检查合规性
  const agentBehavior = getSettings().agentBehavior
  const initialMaxPerModel = agentBehavior?.maxConcurrentPerModel ?? 2
  configureKanbanDispatcher({
    runner: createKanbanHeadlessRunner(),
    db: kanbanDbService,
    // 新版：支持跨渠道轮询 + kscc 合规检查
    channelModelsGetter,
    findModelChannel: findModelChannelById,
    // 旧版（兼容性保留）
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
