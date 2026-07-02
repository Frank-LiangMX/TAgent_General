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
 * - 默认 noop updater 不抛错（kanban-db 未接线场景）
 * - runRegisteredHeadlessAgent 抛错时回流到 markTaskFailed
 *
 * Mock 策略：vi.hoisted 共享 vi.fn 引用，vi.mock 注入到 kanban-worker-service 的依赖。
 * kanban-db 未接线（Phase A 尚未合并），默认 updater 为 noop，无需 mock。
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

// vi.hoisted：在所有 import 之前创建 mock 函数实例，确保 vi.mock 工厂能闭包引用
const mocks = vi.hoisted(() => {
  return {
    createSession: vi.fn(),
    updateMeta: vi.fn(),
    runHeadless: vi.fn(),
    powerStart: vi.fn(),
    powerStop: vi.fn(),
    powerIsStarted: vi.fn(),
  }
})

// Mock electron 的 powerSaveBlocker（kanban-worker-service 顶部 import { powerSaveBlocker } from 'electron'）
vi.mock('electron', () => ({
  powerSaveBlocker: {
    start: mocks.powerStart,
    stop: mocks.powerStop,
    isStarted: mocks.powerIsStarted,
  },
}))

// Mock agent-session-manager：捕获 createAgentSession / updateAgentSessionMeta 调用
vi.mock('./agent-session-manager', () => ({
  createAgentSession: mocks.createSession,
  updateAgentSessionMeta: mocks.updateMeta,
}))

// Mock agent-headless-runner-registry：捕获 input + callbacks，让测试主动触发完成/失败
vi.mock('./agent-headless-runner-registry', () => ({
  runRegisteredHeadlessAgent: mocks.runHeadless,
}))

// 默认 mock 行为：powerSaveBlocker.start 返回数字 ID，isStarted 返回 false（跳过 stop）
mocks.powerStart.mockReturnValue(1)
mocks.powerIsStarted.mockReturnValue(false)

// 默认 createAgentSession：返回最小可用的 session meta
mocks.createSession.mockImplementation(
  (title?: string, channelId?: string, workspaceId?: string, mode?: 'general' | 'ta') => ({
    id: `s_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: title ?? '测试会话',
    channelId,
    workspaceId,
    mode: mode ?? 'general',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
)

// 默认 runRegisteredHeadlessAgent：捕获调用但不主动 resolve，让测试控制回调时机
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

mocks.runHeadless.mockImplementation(
  (input: Record<string, unknown>, callbacks: CapturedRun['callbacks']) => {
    return new Promise<void>((resolve) => {
      capturedRuns.push({ input, callbacks, resolve })
    })
  }
)

const { runKanbanTaskHeadless } = await import('./kanban-worker-service')
const { buildKanbanAgentTools } = await import('./kanban-agent-tools')

beforeEach(() => {
  mocks.createSession.mockClear()
  mocks.updateMeta.mockClear()
  mocks.runHeadless.mockClear()
  mocks.powerStart.mockClear()
  mocks.powerStop.mockClear()
  mocks.powerIsStarted.mockClear()
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
    expect(mocks.createSession).toHaveBeenCalledWith('测试任务', 'ch_test', undefined, 'general')
    expect(mocks.updateMeta).toHaveBeenCalledWith(expect.any(String), {
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

    // 执行前先标记 running
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

  test('未传 updater 时使用 noop，不抛错（kanban-db 未接线场景）', async () => {
    const promise = runKanbanTaskHeadless(baseTask, baseBoard)
    completeLatestRun()
    await expect(promise).resolves.toBeUndefined()
  })

  test('runRegisteredHeadlessAgent 抛错时回流到 markTaskFailed', async () => {
    // 让 mock 在本次调用中 reject
    mocks.runHeadless.mockImplementationOnce(() => Promise.reject(new Error('runner 崩溃')))

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
    expect(mocks.powerStart).toHaveBeenCalledWith('prevent-app-suspension')
    completeLatestRun()
    await promise
  })
})

describe('buildKanbanAgentTools', () => {
  test('返回 5 个 kanban_* 工具', () => {
    const tools = buildKanbanAgentTools()
    const names = Object.keys(tools).sort()
    expect(names).toEqual([
      'kanban_add_task',
      'kanban_block',
      'kanban_comment',
      'kanban_create_board',
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

  test('kanban_create_board handler 在 kanban-db 未接线时抛错', async () => {
    const tools = buildKanbanAgentTools()
    await expect(
      tools.kanban_create_board!.handler({
        rootGoal: '做 X',
        parentSessionId: 's_1',
      })
    ).rejects.toThrow(/kanban-db 尚未接线/)
  })

  test('kanban_block handler 校验必填字段（在调用 kanban-db 之前）', async () => {
    const tools = buildKanbanAgentTools()
    await expect(tools.kanban_block!.handler({ taskId: 't_1' })).rejects.toThrow(/reason/)
  })

  test('kanban_block handler 字段齐全后调用 kanban-db（未接线时抛错）', async () => {
    const tools = buildKanbanAgentTools()
    await expect(tools.kanban_block!.handler({ taskId: 't_1', reason: '缺信息' })).rejects.toThrow(
      /kanban-db 尚未接线/
    )
  })

  test('kanban_comment handler 抛「未实现」错误（待 Phase D）', async () => {
    const tools = buildKanbanAgentTools()
    await expect(tools.kanban_comment!.handler({ taskId: 't_1', comment: 'hi' })).rejects.toThrow(
      /kanban_comment 尚未实现/
    )
  })
})
