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
  getAgentSessionMeta: vi.fn(() => undefined),
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
  stopRegisteredAgent: vi.fn(),
}))

// Mock kanban-db：默认 updater 调用 kanbanDbService.updateTaskStatus
vi.mock('./kanban-db', () => ({
  kanbanDbService: {
    updateTaskStatus: vi.fn(),
    appendBlockedApproval: vi.fn(),
    listTasksByBoard: vi.fn(() => []),
    addTaskComment: vi.fn(() => ({ id: 't_1' })),
    isInitialized: vi.fn(() => true),
    getTask: vi.fn(() => undefined),
    mergeTaskMetadata: vi.fn(() => ({})),
    getBoard: vi.fn(() => undefined),
  },
}))

// Mock judge：默认 continue（goal loop 测试可覆盖）
vi.mock('./kanban-judge-service', () => ({
  DEFAULT_GOAL_MAX_TURNS: 20,
  buildAcceptanceText: (task: {
    title: string
    body?: string
    acceptanceCriteria?: string
  }) => task.acceptanceCriteria?.trim() || `${task.title}\n\n${task.body ?? ''}`.trim(),
  taskNeedsJudge: (task: { goalMode?: boolean }) => task.goalMode === true,
  judgeGoal: vi.fn(async () => ({
    verdict: 'continue' as const,
    reason: 'mock continue',
    judgedAt: Date.now(),
  })),
  parseJudgeVerdict: vi.fn(),
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

const {
  runKanbanTaskHeadless,
  resolveWorkerWorkspaceId,
  buildGoalContinuePrompt,
} = await import('./kanban-worker-service')
const { buildKanbanAgentTools } = await import('./kanban-agent-tools')
const agentSessionManager = await import('./agent-session-manager')
const headlessRegistry = await import('./agent-headless-runner-registry')
const roleService = await import('./agent-role-service')
const kanbanDb = await import('./kanban-db')
const judgeService = await import('./kanban-judge-service')
const electron = await import('electron')

const mockCreateSession = vi.mocked(agentSessionManager.createAgentSession)
const mockUpdateMeta = vi.mocked(agentSessionManager.updateAgentSessionMeta)
const mockGetSessionMeta = vi.mocked(agentSessionManager.getAgentSessionMeta)
const mockRunHeadless = vi.mocked(headlessRegistry.runRegisteredHeadlessAgent)
const mockGetRoleById = vi.mocked(roleService.getRoleById)
const mockUpdateTaskStatus = vi.mocked(kanbanDb.kanbanDbService.updateTaskStatus)
const mockGetTask = vi.mocked(kanbanDb.kanbanDbService.getTask)
const mockMergeMeta = vi.mocked(kanbanDb.kanbanDbService.mergeTaskMetadata)
const mockJudgeGoal = vi.mocked(judgeService.judgeGoal)
const mockPowerStart = vi.mocked(electron.powerSaveBlocker.start)

beforeEach(() => {
  mockCreateSession.mockClear()
  mockUpdateMeta.mockClear()
  mockGetSessionMeta.mockReset()
  mockGetSessionMeta.mockReturnValue(undefined)
  mockRunHeadless.mockClear()
  mockPowerStart.mockClear()
  mockGetRoleById.mockReset()
  mockUpdateTaskStatus.mockClear()
  mockGetTask.mockReset()
  mockGetTask.mockReturnValue(null)
  mockMergeMeta.mockClear()
  mockJudgeGoal.mockClear()
  mockJudgeGoal.mockResolvedValue({
    verdict: 'continue',
    reason: 'mock continue',
    judgedAt: Date.now(),
  })
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
    expect(mockUpdateMeta).toHaveBeenCalledWith(
      expect.any(String),
      {
        parentBoardId: 'b_test1',
        sourceKanbanTaskId: 't_test1',
      },
      true
    )
    completeLatestRun()
    await promise
  })

  test('board.workspaceId 传给 createAgentSession 与 headless runner（挂载 skills）', async () => {
    const promise = runKanbanTaskHeadless(baseTask, {
      ...baseBoard,
      workspaceId: 'ws_skills',
    })
    expect(mockCreateSession).toHaveBeenCalledWith('测试任务', 'ch_test', 'ws_skills', 'general')
    expect(capturedRuns[0]!.input.workspaceId).toBe('ws_skills')
    expect(capturedRuns[0]!.input.automationContext as string).toContain('【工作区 Skills】')
    completeLatestRun()
    await promise
  })

  test('无 board.workspaceId 时从 parentSession 兜底', async () => {
    mockGetSessionMeta.mockReturnValue({
      id: 's_parent',
      workspaceId: 'ws_from_parent',
    } as ReturnType<typeof agentSessionManager.getAgentSessionMeta>)
    const promise = runKanbanTaskHeadless(baseTask, {
      ...baseBoard,
      parentSessionId: 's_parent',
    })
    expect(mockCreateSession).toHaveBeenCalledWith(
      '测试任务',
      'ch_test',
      'ws_from_parent',
      'general'
    )
    completeLatestRun()
    await promise
  })

  test('resolveWorkerWorkspaceId 优先级：task > board > parent > metadata', () => {
    expect(
      resolveWorkerWorkspaceId(
        { ...baseTask, workspaceId: 'ws_task' },
        { ...baseBoard, workspaceId: 'ws_board' }
      )
    ).toBe('ws_task')
    expect(resolveWorkerWorkspaceId(baseTask, { ...baseBoard, workspaceId: 'ws_board' })).toBe(
      'ws_board'
    )
    mockGetSessionMeta.mockReturnValue({
      workspaceId: 'ws_parent',
    } as ReturnType<typeof agentSessionManager.getAgentSessionMeta>)
    expect(resolveWorkerWorkspaceId(baseTask, { ...baseBoard, parentSessionId: 's1' })).toBe(
      'ws_parent'
    )
    mockGetSessionMeta.mockReturnValue(undefined)
    expect(
      resolveWorkerWorkspaceId({ ...baseTask, metadata: { workspaceId: 'ws_meta' } }, baseBoard)
    ).toBe('ws_meta')
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

    expect(updater.markTaskFailed).toHaveBeenCalledWith('t_test1', 'boom', expect.any(String))
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

    expect(updater.markTaskFailed).toHaveBeenCalledWith(
      't_test1',
      'runner 崩溃',
      expect.any(String)
    )
    expect(onTaskCompleted).toHaveBeenCalledWith('t_test1', 'failed', undefined, 'runner 崩溃')
  })

  test('启动 powerSaveBlocker 防休眠', async () => {
    const promise = runKanbanTaskHeadless(baseTask, baseBoard)
    expect(mockPowerStart).toHaveBeenCalledWith('prevent-app-suspension')
    completeLatestRun()
    await promise
  })

  test('reviewer 角色（permissionMode=auto）自动降级为 bypassPermissions', async () => {
    mockGetRoleById.mockReturnValue({
      id: 'reviewer',
      displayName: '审核工人',
      description: '审查代码',
      systemPrompt: '你是审核工人',
      permissionMode: 'auto',
      modelPool: ['kimi-k2.6'],
      maxConcurrentPerModel: 2,
      fallbackToChannelDefault: true,
    })

    const promise = runKanbanTaskHeadless({ ...baseTask, roleId: 'reviewer' }, baseBoard)
    expect(capturedRuns[0]!.input.permissionModeOverride).toBe('bypassPermissions')
    completeLatestRun()
    await promise
  })

  test('非 reviewer 角色（permissionMode=bypassPermissions）保持原值', async () => {
    mockGetRoleById.mockReturnValue({
      id: 'coder',
      displayName: '编码工人',
      description: '实现功能',
      systemPrompt: '你是编码工人',
      permissionMode: 'bypassPermissions',
      modelPool: ['glm-5.2'],
      maxConcurrentPerModel: 2,
      fallbackToChannelDefault: true,
    })

    const promise = runKanbanTaskHeadless({ ...baseTask, roleId: 'coder' }, baseBoard)
    expect(capturedRuns[0]!.input.permissionModeOverride).toBe('bypassPermissions')
    completeLatestRun()
    await promise
  })

  test('task.permissionMode=auto 显式指定时不降级（透传 auto）', async () => {
    // 即使是 reviewer 角色，用户显式要 auto 时透传，让 canUseTool 根据 workerApprovalMode 处理
    mockGetRoleById.mockReturnValue({
      id: 'reviewer',
      displayName: '审核工人',
      description: '审查代码',
      systemPrompt: '你是审核工人',
      permissionMode: 'auto',
      modelPool: ['kimi-k2.6'],
      maxConcurrentPerModel: 2,
      fallbackToChannelDefault: true,
    })

    const promise = runKanbanTaskHeadless(
      { ...baseTask, roleId: 'reviewer', permissionMode: 'auto' },
      baseBoard
    )
    expect(capturedRuns[0]!.input.permissionModeOverride).toBe('auto')
    completeLatestRun()
    await promise
  })

  test('goalMode：会话结束且 DB 已 done 时不再续跑', async () => {
    mockGetTask.mockReturnValue({
      id: 't_test1',
      status: 'done',
      resultSummary: 'via complete',
    } as never)

    const onTaskCompleted = vi.fn()
    const promise = runKanbanTaskHeadless(
      { ...baseTask, goalMode: true, goalMaxTurns: 5 },
      baseBoard,
      { onTaskCompleted }
    )
    completeLatestRun()
    await promise

    expect(capturedRuns).toHaveLength(1)
    expect(onTaskCompleted).toHaveBeenCalledWith('t_test1', 'done', undefined, undefined)
    expect(mockJudgeGoal).not.toHaveBeenCalled()
  })

  test('goalMode：mid-turn judge continue 时同 session 续跑', async () => {
    mockGetTask.mockReturnValue({ id: 't_test1', status: 'running' } as never)
    mockJudgeGoal.mockResolvedValue({
      verdict: 'continue',
      reason: '缺证据',
      judgedAt: Date.now(),
    })

    const onTaskCompleted = vi.fn()
    const promise = runKanbanTaskHeadless(
      { ...baseTask, goalMode: true, goalMaxTurns: 5 },
      baseBoard,
      {
        updater: {
          markTaskRunning: vi.fn(),
          markTaskDone: vi.fn(),
          markTaskFailed: vi.fn(),
          markTaskBlocked: vi.fn(),
        },
        onTaskCompleted,
      }
    )

    // 第 1 轮结束 → continue → 第 2 轮
    completeLatestRun()
    await vi.waitFor(() => expect(capturedRuns.length).toBe(2))
    expect(String(capturedRuns[1]!.input.userMessage)).toContain('Goal 续跑')
    expect(String(capturedRuns[1]!.input.userMessage)).toContain('缺证据')
    // 同 session
    expect(capturedRuns[1]!.input.sessionId).toBe(capturedRuns[0]!.input.sessionId)

    // 第 2 轮 complete 成功
    mockGetTask.mockReturnValue({ id: 't_test1', status: 'done' } as never)
    completeLatestRun()
    await promise

    expect(onTaskCompleted).toHaveBeenCalledWith('t_test1', 'done', undefined, undefined)
    expect(mockJudgeGoal).toHaveBeenCalledTimes(1)
  })

  test('goalMode：goalMaxTurns 耗尽 → blocked', async () => {
    mockGetTask.mockReturnValue({ id: 't_test1', status: 'running' } as never)
    mockJudgeGoal.mockResolvedValue({
      verdict: 'continue',
      reason: '仍不达标',
      judgedAt: Date.now(),
    })

    const markTaskBlocked = vi.fn()
    const onTaskCompleted = vi.fn()
    const promise = runKanbanTaskHeadless(
      { ...baseTask, goalMode: true, goalMaxTurns: 2 },
      baseBoard,
      {
        updater: {
          markTaskRunning: vi.fn(),
          markTaskDone: vi.fn(),
          markTaskFailed: vi.fn(),
          markTaskBlocked,
        },
        onTaskCompleted,
      }
    )

    completeLatestRun()
    await vi.waitFor(() => expect(capturedRuns.length).toBe(2))
    completeLatestRun()
    await promise

    expect(onTaskCompleted).toHaveBeenCalledWith(
      't_test1',
      'blocked',
      undefined,
      expect.stringContaining('轮次已耗尽')
    )
    expect(markTaskBlocked).toHaveBeenCalledWith('t_test1', expect.stringContaining('轮次已耗尽'))
    expect(mockUpdateTaskStatus).toHaveBeenCalledWith(
      't_test1',
      expect.objectContaining({ status: 'blocked' })
    )
  })

  test('buildGoalContinuePrompt 含 taskId 与 judge 原因', () => {
    const text = buildGoalContinuePrompt({
      taskId: 't_abc',
      turn: 2,
      maxTurns: 10,
      judge: { verdict: 'continue', reason: '缺少测试' },
    })
    expect(text).toContain('t_abc')
    expect(text).toContain('缺少测试')
    expect(text).toContain('2/10')
  })

  test('执行超时 30 分钟后标记任务为 failed 并中止 worker', async () => {
    // 用 fake timer 模拟超时：runRegisteredHeadlessAgent 不回调，setTimeout 触发
    vi.useFakeTimers()
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

    // 推进 30 分钟 + 1ms 触发超时
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 1)

    await promise

    // 验证标 failed（超时真 abort，不再标 blocked）
    expect(mockUpdateTaskStatus).toHaveBeenCalledWith('t_test1', {
      status: 'failed',
      error: expect.stringContaining('执行超时'),
      errorSource: 'kanban',
    })
    // 验证回流 failed + 超时错误
    expect(updater.markTaskFailed).toHaveBeenCalledWith(
      't_test1',
      expect.stringContaining('执行超时'),
      expect.any(String)
    )
    expect(onTaskCompleted).toHaveBeenCalledWith(
      't_test1',
      'failed',
      undefined,
      expect.stringContaining('执行超时')
    )

    vi.useRealTimers()
    // 清理挂起的 run（避免影响后续测试）
    capturedRuns = []
  })
})

describe('buildKanbanAgentTools', () => {
  test('返回 7 个 kanban_* 工具（含 complete）', () => {
    const tools = buildKanbanAgentTools()
    const names = Object.keys(tools).sort()
    expect(names).toEqual([
      'kanban_add_task',
      'kanban_block',
      'kanban_comment',
      'kanban_complete',
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

  test('kanban_comment handler 写入 blackboard 评论', async () => {
    const tools = buildKanbanAgentTools()
    const result = await tools.kanban_comment!.handler({ taskId: 't_1', comment: 'hi' })
    expect(kanbanDb.kanbanDbService.addTaskComment).toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})
