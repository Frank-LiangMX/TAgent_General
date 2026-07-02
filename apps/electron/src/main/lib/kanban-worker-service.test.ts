/**
 * 看板工人服务单元测试
 *
 * 覆盖 §5.3 / §6 桥接关键契约：
 * - 默认强制 bypassPermissions（无人值守写操作）
 * - triggeredBy='kanban'
 * - 防递归 prompt 前缀（userMessage 尾部标记 + automationContext 非空）
 * - 创建子会话并写入 parentBoardId / sourceKanbanTaskId 到 AgentSessionMeta
 * - 完成回调：自定义 updater.markTaskDone + onTaskCompleted('done')
 * - 失败回调：自定义 updater.markTaskFailed + onTaskCompleted('failed', err)
 * - task.permissionMode 透传
 * - runRegisteredHeadlessAgent 抛错时回流到 markTaskFailed
 *
 * Mock 策略：vi.mock 工厂内创建 vi.fn，通过 await import + vi.mocked 拿引用。
 * kanban-db / agent-role-service 均 mock，默认 updater 调用 mock 后的 kanbanDbService。
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock electron 的 powerSaveBlocker
vi.mock('electron', () => ({
  powerSaveBlocker: {
    start: vi.fn(() => 1),
    stop: vi.fn(),
    isStarted: vi.fn(() => false),
  },
}))

// Mock agent-session-manager
vi.mock('./agent-session-manager', () => ({
  createAgentSession: vi.fn(
    (title?: string, channelId?: string, workspaceId?: string, mode?: 'general' | 'ta') => ({
      id: `s_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title ?? '测试会话',
      channelId,
      workspaceId,
      mode: mode ?? 'general',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  ),
  updateAgentSessionMeta: vi.fn(),
  getAgentSessionSDKMessages: vi.fn(() => []),
}))

// Mock agent-headless-runner-registry：捕获 input + callbacks
vi.mock('./agent-headless-runner-registry', () => ({
  runRegisteredHeadlessAgent: vi.fn(
    (
      input: Record<string, unknown>,
      callbacks: {
        onError: (error: string) => void
        onComplete: () => void
        onTitleUpdated: (title: string) => void
        source?: string
      }
    ) => {
      return new Promise<void>((resolve) => {
        capturedRuns.push({ input, callbacks, resolve })
      })
    }
  ),
}))

// Mock kanban-db：默认 updater 调用 kanbanDbService.updateTaskStatus
vi.mock('./kanban-db', () => ({
  kanbanDbService: {
    updateTaskStatus: vi.fn(),
    isInitialized: vi.fn(() => true),
  },
}))

// Mock agent-role-service：getRoleById 返回 undefined（测试不测角色注入）
vi.mock('./agent-role-service', () => ({
  getRoleById: vi.fn(() => undefined),
}))

// Mock kanban-ipc：broadcastKanbanChanged 不做任何事
vi.mock('./kanban-ipc', () => ({
  broadcastKanbanChanged: vi.fn(),
}))

// Mock settings-service：getSettings 返回最小配置
vi.mock('./settings-service', () => ({
  getSettings: vi.fn(() => ({
    kanbanDefaultMaxConcurrent: 2,
    kanbanDefaultMaxConcurrentPerModel: 1,
  })),
}))

interface CapturedRun {
  input: Record<string, unknown>
  callbacks: {
    onError: (error: string) => void
    onComplete: () => void
    onTitleUpdated: (title: string) => void
    source?: string
  }
  resolve: () => void
}
let capturedRuns: CapturedRun[] = []

const { runKanbanTaskHeadless } = await import('./kanban-worker-service')
const { buildKanbanAgentTools } = await import('./kanban-agent-tools')
const agentSessionManager = await import('./agent-session-manager')
const headlessRegistry = await import('./agent-headless-runner-registry')
const electron = await import('electron')

const mockCreateSession = vi.mocked(agentSessionManager.createAgentSession)
const mockUpdateMeta = vi.mocked(agentSessionManager.updateAgentSessionMeta)
const mockRunHeadless = vi.mocked(headlessRegistry.runRegisteredHeadlessAgent)
const mockPowerStart = vi.mocked(electron.powerSaveBlocker.start)

beforeEach(() => {
  mockCreateSession.mockClear()
  mockUpdateMeta.mockClear()
  mockRunHeadless.mockClear()
  mockPowerStart.mockClear()
  capturedRuns = []
})

const baseTask = {
  id: 't_test1',
  boardId: 'b_test1',
  title: '测试任务',
  body: '请完成 X 功能',
  channelId: 'ch_test',
}

const baseBoard = {
  id: 'b_test1',
  parentSessionId: 's_parent',
}

/** 触发最近一次 runRegisteredHeadlessAgent 的 onComplete 并 resolve 挂起的 Promise */
function completeLatestRun(): void {
  const run = capturedRuns[capturedRuns.length - 1]
  if (!run) throw new Error('没有捕获到 runRegisteredHeadlessAgent 调用')
  run.callbacks.onComplete()
  run.resolve()
}

/** 触发最近一次 runRegisteredHeadlessAgent 的 onError 并 resolve 挂起的 Promise */
function failLatestRun(error: string): void {
  const run = capturedRuns[capturedRuns.length - 1]
  if (!run) throw new Error('没有捕获到 runRegisteredHeadlessAgent 调用')
  run.callbacks.onError(error)
  run.resolve()
}

describe('runKanbanTaskHeadless', () => {
  test('默认强制 bypassPermissions 并 triggeredBy=kanban', async () => {
    const promise = runKanbanTaskHeadless(baseTask, baseBoard)
    expect(capturedRuns).toHaveLength(1)
    const input = capturedRuns[0]!.input
    expect(input.permissionModeOverride).toBe('bypassPermissions')
    expect(input.triggeredBy).toBe('kanban')
    expect(input.channelId).toBe('ch_test')
    expect(input.sessionId).toEqual(expect.any(String))
    completeLatestRun()
    await promise
  })

  test('userMessage 加防递归标记 + automationContext 非空', async () => {
    const promise = runKanbanTaskHeadless(baseTask, baseBoard)
    const input = capturedRuns[0]!.input
    expect(input.userMessage).toBe('请完成 X 功能\n<!--TAGENT_KANBAN_WORKER-->')
    expect(typeof input.automationContext).toBe('string')
    expect((input.automationContext as string).length).toBeGreaterThan(0)
    completeLatestRun()
    await promise
  })

  test('task.permissionMode=auto 时透传', async () => {
    const promise = runKanbanTaskHeadless({ ...baseTask, permissionMode: 'auto' }, baseBoard)
    expect(capturedRuns[0]!.input.permissionModeOverride).toBe('auto')
    completeLatestRun()
    await promise
  })

  test('创建子会话（mode=general）并写入 parentBoardId / sourceKanbanTaskId', async () => {
    const promise = runKanbanTaskHeadless(baseTask, baseBoard)
    expect(mockCreateSession).toHaveBeenCalledWith('测试任务', 'ch_test', undefined, 'general')
    expect(mockUpdateMeta).toHaveBeenCalledWith(expect.any(String), {
      parentBoardId: 'b_test1',
      sourceKanbanTaskId: 't_test1',
    })
    completeLatestRun()
    await promise
  })

  test('完成时调用 updater.markTaskDone + onTaskCompleted(done)', async () => {
    const updater = {
      markTaskRunning: vi.fn(),
      markTaskDone: vi.fn(),
      markTaskFailed: vi.fn(),
    }
    const onTaskStarted = vi.fn()
    const onTaskCompleted = vi.fn()

    const promise = runKanbanTaskHeadless(baseTask, baseBoard, {
      updater,
      onTaskStarted,
      onTaskCompleted,
    })

    expect(updater.markTaskRunning).toHaveBeenCalledWith(
      't_test1',
      expect.any(String),
      expect.any(Number)
    )
    expect(onTaskStarted).toHaveBeenCalledWith('t_test1', expect.any(String))

    completeLatestRun()
    await promise

    expect(updater.markTaskDone).toHaveBeenCalledWith('t_test1')
    expect(updater.markTaskFailed).not.toHaveBeenCalled()
    expect(onTaskCompleted).toHaveBeenCalledWith('t_test1', 'done', undefined, undefined)
  })

  test('失败时调用 updater.markTaskFailed + onTaskCompleted(failed, err)', async () => {
    const updater = {
      markTaskRunning: vi.fn(),
      markTaskDone: vi.fn(),
      markTaskFailed: vi.fn(),
    }
    const onTaskCompleted = vi.fn()

    const promise = runKanbanTaskHeadless(baseTask, baseBoard, {
      updater,
      onTaskCompleted,
    })

    failLatestRun('boom')
    await promise

    expect(updater.markTaskFailed).toHaveBeenCalledWith('t_test1', 'boom')
    expect(updater.markTaskDone).not.toHaveBeenCalled()
    expect(onTaskCompleted).toHaveBeenCalledWith('t_test1', 'failed', undefined, 'boom')
  })

  test('未传 updater 时使用默认 db updater，不抛错', async () => {
    const promise = runKanbanTaskHeadless(baseTask, baseBoard)
    completeLatestRun()
    await expect(promise).resolves.toBeUndefined()
  })

  test('runRegisteredHeadlessAgent 抛错时回流到 markTaskFailed', async () => {
    mockRunHeadless.mockImplementationOnce(() => Promise.reject(new Error('runner 崩溃')))

    const updater = {
      markTaskRunning: vi.fn(),
      markTaskDone: vi.fn(),
      markTaskFailed: vi.fn(),
    }
    const onTaskCompleted = vi.fn()

    await runKanbanTaskHeadless(baseTask, baseBoard, {
      updater,
      onTaskCompleted,
    })

    expect(updater.markTaskFailed).toHaveBeenCalledWith('t_test1', 'runner 崩溃')
    expect(onTaskCompleted).toHaveBeenCalledWith('t_test1', 'failed', undefined, 'runner 崩溃')
  })

  test('启动 powerSaveBlocker 防休眠', async () => {
    const promise = runKanbanTaskHeadless(baseTask, baseBoard)
    expect(mockPowerStart).toHaveBeenCalledWith('prevent-app-suspension')
    completeLatestRun()
    await promise
  })
})

describe('buildKanbanAgentTools', () => {
  test('返回 6 个 kanban_* 工具', () => {
    const tools = buildKanbanAgentTools()
    const names = Object.keys(tools).sort()
    expect(names).toEqual([
      'kanban_add_task',
      'kanban_block',
      'kanban_comment',
      'kanban_create_board',
      'kanban_list_boards',
      'kanban_list_tasks',
    ])
    for (const name of names) {
      const tool = tools[name]!
      expect(tool.name).toBe(name)
      expect(typeof tool.description).toBe('string')
      expect(tool.description.length).toBeGreaterThan(0)
      expect(tool.inputSchema).toEqual(expect.objectContaining({ type: 'object' }))
      expect(typeof tool.handler).toBe('function')
    }
  })

  test('kanban_block handler 校验必填字段', async () => {
    const tools = buildKanbanAgentTools()
    await expect(tools.kanban_block!.handler({ taskId: 't_1' })).rejects.toThrow(/reason/)
  })

  test('kanban_comment handler 抛「未实现」错误（待 Phase D）', async () => {
    const tools = buildKanbanAgentTools()
    await expect(tools.kanban_comment!.handler({ taskId: 't_1', comment: 'hi' })).rejects.toThrow(
      /尚未实现/
    )
  })
})
