import { describe, expect, it } from 'vitest'

import type { KanbanTask, KanbanTaskStatus, ProgressLogEntry } from '@tagent/shared'

import {
  MAX_OFFICE_WORKERS,
  projectKanbanWorkers,
  resolveOfficeWorkerState,
} from './officeWorkerProjection'
import { DESKS, getWorkerStatePosition } from './scene/layout/officeLayout'
import {
  OFFICE_CHARACTER_SCALE,
  OFFICE_CHARACTER_TARGET_HEIGHT,
  resolveWorkerAnimation,
} from './scene/characters/workerSpineAppearance'
import type { AgentEntity } from './scene/entities/AgentEntity'
import { advanceCompletedAmbient } from './scene/simulation/completedAmbient'
import {
  assignStableWorkerDesks,
  transitionWorkerRoster,
} from './scene/simulation/workerStateTransition'
import { MovementSystem } from './scene/systems/MovementSystem'

function task(
  id: string,
  status: KanbanTaskStatus,
  overrides: Partial<KanbanTask> = {}
): KanbanTask {
  return {
    id,
    boardId: 'board-1',
    title: `任务 ${id}`,
    body: '',
    status,
    roleId: 'coder',
    channelId: 'channel-1',
    priority: 0,
    createdAt: Number(id.replace(/\D/g, '')) || 1,
    updatedAt: 100,
    ...overrides,
  }
}

describe('resolveOfficeWorkerState', () => {
  it.each([
    ['pending', 'waiting'],
    ['ready', 'waiting'],
    ['blocked', 'blocked'],
    ['review', 'reviewing'],
    ['done', 'completed'],
    ['failed', 'failed'],
    ['cancelled', 'cancelled'],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(resolveOfficeWorkerState({ status })).toBe(expected)
  })

  it('uses worker progress to refine a running task', () => {
    expect(resolveOfficeWorkerState({ status: 'running' }, { text: '正在分析代码' })).toBe(
      'thinking'
    )
    expect(resolveOfficeWorkerState({ status: 'running' }, { lastToolName: 'Bash test' })).toBe(
      'reviewing'
    )
    expect(resolveOfficeWorkerState({ status: 'running' }, { text: '正在写入文件' })).toBe(
      'working'
    )
  })
})

describe('projectKanbanWorkers', () => {
  it('binds role, task and real worker session without phantom agents', () => {
    const source = task('t-1', 'running', {
      roleId: 'coder',
      assigneeSessionId: 'session-worker-1',
    })
    const labels = new Map([[source.id, '务实工程师 01']])
    const projected = projectKanbanWorkers([source], labels)

    expect(projected.agents).toHaveLength(1)
    expect(projected.hiddenCount).toBe(0)
    expect(projected.agents[0]).toMatchObject({
      id: 't-1',
      taskId: 't-1',
      roleId: 'coder',
      workerSessionId: 'session-worker-1',
      appearanceKey: 'session-worker-1',
      name: '务实工程师 01',
      state: 'working',
    })
  })

  it('places non-working states outside their desk instead of pinning every worker', () => {
    const [agent] = projectKanbanWorkers([task('t-3', 'pending')], new Map()).agents
    const desk = DESKS[0]!

    expect(getWorkerStatePosition(agent!)).not.toEqual({ x: desk.seatX, y: desk.seatY })
    expect(getWorkerStatePosition({ ...agent!, state: 'blocked' })).not.toEqual({
      x: desk.seatX,
      y: desk.seatY,
    })
    expect(getWorkerStatePosition({ ...agent!, state: 'working' })).toEqual({
      x: desk.seatX,
      y: desk.seatY,
    })
  })

  it('prefers live progress over persisted task metadata', () => {
    const persisted: ProgressLogEntry = { text: '正在写代码', ts: 1 }
    const live: ProgressLogEntry = { text: '正在审核结果', status: 'reviewing', ts: 2 }
    const source = task('t-2', 'running', { metadata: { progressLogs: [persisted] } })

    const projected = projectKanbanWorkers(
      [source],
      new Map([[source.id, '代码审查员']]),
      new Map([[source.id, live]])
    )

    expect(projected.agents[0]?.state).toBe('reviewing')
    expect(projected.agents[0]?.progressText).toBe(live.text)
  })

  it('keeps active workers visible when a board has more tasks than desks', () => {
    const terminal = Array.from({ length: MAX_OFFICE_WORKERS }, (_, index) =>
      task(`t-${index + 1}`, 'done', { finishedAt: index + 1 })
    )
    const active = task('t-99', 'running', { createdAt: 99 })
    const projected = projectKanbanWorkers([...terminal, active], new Map())

    expect(projected.agents).toHaveLength(MAX_OFFICE_WORKERS)
    expect(projected.agents.some((agent) => agent.taskId === active.id)).toBe(true)
    expect(projected.hiddenCount).toBe(1)
  })
})

describe('worker scene transitions', () => {
  it('walks from the desk to the delivery zone before becoming completed', () => {
    const labels = new Map([['t-4', '交付工程师']])
    const [working] = projectKanbanWorkers([task('t-4', 'running')], labels).agents
    const [completed] = projectKanbanWorkers([task('t-4', 'done')], labels).agents
    const [moving] = transitionWorkerRoster([completed!], [working!], false)
    const destination = getWorkerStatePosition(completed!)

    expect(moving).toMatchObject({
      state: 'walking',
      x: working!.x,
      y: working!.y,
      transition: { targetState: 'completed' },
    })
    expect(moving?.walkPath?.at(-1)).toEqual(destination)
  })

  it('preserves an in-flight transition when another progress render arrives', () => {
    const labels = new Map([['t-5', '交付工程师']])
    const [working] = projectKanbanWorkers([task('t-5', 'running')], labels).agents
    const [completed] = projectKanbanWorkers([task('t-5', 'done')], labels).agents
    const [moving] = transitionWorkerRoster([completed!], [working!], false)
    const [continued] = transitionWorkerRoster([completed!], [moving!], false)

    expect(continued?.state).toBe('walking')
    expect(continued?.walkPath).toEqual(moving?.walkPath)
    expect(continued?.transition?.targetState).toBe('completed')
  })

  it('enters the target state only after movement reaches the destination', () => {
    const labels = new Map([['t-9', '交付工程师']])
    const [working] = projectKanbanWorkers([task('t-9', 'running')], labels).agents
    const [completed] = projectKanbanWorkers([task('t-9', 'done')], labels).agents
    const [moving] = transitionWorkerRoster([completed!], [working!], false)
    const destination = getWorkerStatePosition(completed!)
    let entityData = {
      ...moving!,
      ...destination,
      targetX: destination.x,
      targetY: destination.y,
      walkPath: [destination],
      walkPathIndex: 0,
    }
    const entity = {
      get data() {
        return entityData
      },
      apply(patch: Partial<typeof entityData>) {
        entityData = { ...entityData, ...patch }
      },
      setPosition() {},
    } as unknown as AgentEntity

    new MovementSystem().update(new Map([[moving!.id, entity]]), 0.016)

    expect(entityData.state).toBe('completed')
    expect(entityData.transition).toBeUndefined()
  })

  it('keeps desks stable when task priority changes reorder the projection', () => {
    const labels = new Map<string, string>()
    const previous = projectKanbanWorkers(
      [task('t-6', 'running'), task('t-7', 'pending')],
      labels
    ).agents
    const reordered = projectKanbanWorkers(
      [task('t-6', 'pending'), task('t-7', 'running')],
      labels
    ).agents
    const stable = assignStableWorkerDesks(reordered, previous)

    expect(stable.find((agent) => agent.id === 't-6')?.assignedDeskId).toBe(
      previous.find((agent) => agent.id === 't-6')?.assignedDeskId
    )
    expect(stable.find((agent) => agent.id === 't-7')?.assignedDeskId).toBe(
      previous.find((agent) => agent.id === 't-7')?.assignedDeskId
    )
  })

  it('uses instant transitions when reduced motion is requested', () => {
    const labels = new Map([['t-8', '交付工程师']])
    const [working] = projectKanbanWorkers([task('t-8', 'running')], labels).agents
    const [completed] = projectKanbanWorkers([task('t-8', 'done')], labels).agents
    const [settled] = transitionWorkerRoster([completed!], [working!], true)

    expect(settled).toMatchObject({
      state: 'completed',
      ...getWorkerStatePosition(completed!),
      transition: undefined,
    })
  })
})

describe('completed worker ambient life', () => {
  it('keeps the business state completed while staggering the first break', () => {
    const [completed] = projectKanbanWorkers([task('t-10', 'done')], new Map()).agents
    const [waiting] = advanceCompletedAmbient(0, [completed!], false)

    expect(waiting).toMatchObject({
      state: 'completed',
      taskStatus: 'done',
      ambientActivity: { phase: 'delay', cycle: 0 },
    })
    expect(waiting?.ambientActivity?.remaining).toBeGreaterThanOrEqual(2.4)
  })

  it('walks to a real office activity point after the staggered delay', () => {
    const [completed] = projectKanbanWorkers([task('t-11', 'done')], new Map()).agents
    const [waiting] = advanceCompletedAmbient(0, [completed!], false)
    const [walking] = advanceCompletedAmbient(10, [waiting!], false)

    expect(walking).toMatchObject({
      state: 'walking',
      taskStatus: 'done',
      transition: { kind: 'ambient', targetState: 'completed' },
      ambientActivity: { phase: 'walking', cycle: 0 },
    })
    expect(walking?.walkPath?.length).toBeGreaterThan(0)
    expect(walking?.ambientActivity?.label).toBeTruthy()
  })

  it('preserves ambient movement across Kanban refreshes', () => {
    const labels = new Map([['t-14', '摸鱼工程师']])
    const [completed] = projectKanbanWorkers([task('t-14', 'done')], labels).agents
    const [waiting] = advanceCompletedAmbient(0, [completed!], false)
    const [walking] = advanceCompletedAmbient(10, [waiting!], false)
    const [refreshed] = transitionWorkerRoster([completed!], [walking!], false)

    expect(refreshed).toMatchObject({
      state: 'walking',
      taskStatus: 'done',
      transition: { kind: 'ambient', targetState: 'completed' },
      ambientActivity: { phase: 'walking', cycle: 0 },
    })
    expect(refreshed?.walkPath).toEqual(walking?.walkPath)
  })

  it('starts the activity animation on arrival and schedules another break afterward', () => {
    const [completed] = projectKanbanWorkers([task('t-12', 'done')], new Map()).agents
    const [waiting] = advanceCompletedAmbient(0, [completed!], false)
    const [walking] = advanceCompletedAmbient(10, [waiting!], false)
    const destination = walking!.walkPath!.at(-1)!
    let entityData = {
      ...walking!,
      ...destination,
      targetX: destination.x,
      targetY: destination.y,
      walkPath: [destination],
      walkPathIndex: 0,
    }
    const entity = {
      get data() {
        return entityData
      },
      apply(patch: Partial<typeof entityData>) {
        entityData = { ...entityData, ...patch }
      },
      setPosition() {},
    } as unknown as AgentEntity

    new MovementSystem().update(new Map([[walking!.id, entity]]), 0.016)

    expect(entityData).toMatchObject({
      state: 'completed',
      taskStatus: 'done',
      customAnimation: walking?.ambientActivity?.animation,
      ambientActivity: { phase: 'acting', cycle: 0 },
    })

    const [nextBreak] = advanceCompletedAmbient(20, [entityData], false)
    expect(nextBreak).toMatchObject({
      state: 'completed',
      taskStatus: 'done',
      customAnimation: 'movement/idle-front',
      ambientActivity: { phase: 'delay', cycle: 1 },
    })
  })

  it('does not start ambient wandering when reduced motion is enabled', () => {
    const [completed] = projectKanbanWorkers([task('t-13', 'done')], new Map()).agents
    const [settled] = advanceCompletedAmbient(30, [completed!], true)

    expect(settled?.state).toBe('completed')
    expect(settled?.ambientActivity).toBeUndefined()
  })
})

describe('Spine worker animation policy', () => {
  it('scales workers to the office furniture instead of the original oversized preset', () => {
    expect(OFFICE_CHARACTER_SCALE).toBeCloseTo(0.15, 2)
    expect(OFFICE_CHARACTER_TARGET_HEIGHT).toBe(102)
  })

  it('plays delivery once and then settles instead of looping celebration forever', () => {
    expect(resolveWorkerAnimation('completed', 'front')).toEqual({
      name: 'emotes/just-right',
      loop: false,
      settleTo: 'movement/idle-front',
    })
  })
})
