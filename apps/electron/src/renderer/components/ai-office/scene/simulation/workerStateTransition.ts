import type { OfficeAgent } from '../../types/office-agent'
import { DESKS, getWorkerStatePosition, isDeskWorkerState } from '../layout/officeLayout'
import { createNavContext, planWalkFrom, planWalkToDeskSeat } from '../navigation/officeNavigation'
import { MovementSystem } from '../systems/MovementSystem'
import { startArrivalBriefing, startWorkerHandoff } from './collaboration'

const POSITION_EPSILON = 6

function desiredState(agent: OfficeAgent): OfficeAgent['state'] {
  return agent.transition?.targetState ?? agent.state
}

/**
 * 保留已有 worker 的工位，避免任务优先级重排时全办公室一起换座。
 * 新 worker 只从当前未占用的工位中选择。
 */
export function assignStableWorkerDesks(
  nextAgents: OfficeAgent[],
  previousAgents: OfficeAgent[]
): OfficeAgent[] {
  const previousById = new Map(previousAgents.map((agent) => [agent.id, agent]))
  const claimed = new Set<string>()

  return nextAgents.map((agent) => {
    const previousDeskId = previousById.get(agent.id)?.assignedDeskId
    const preferredDeskId = previousDeskId ?? agent.assignedDeskId
    const assignedDeskId =
      (preferredDeskId && !claimed.has(preferredDeskId) ? preferredDeskId : undefined) ??
      DESKS.find((desk) => !claimed.has(desk.id))?.id ??
      agent.assignedDeskId

    if (assignedDeskId) claimed.add(assignedDeskId)
    return { ...agent, assignedDeskId }
  })
}

/**
 * 将 Kanban 的瞬时状态更新转成办公室里的可见过程。
 * 角色先沿导航路径走到对应区域，抵达后才进入目标姿势。
 */
export function transitionWorkerAgent(
  next: OfficeAgent,
  previous: OfficeAgent | undefined,
  sceneAgents: OfficeAgent[],
  reduceMotion: boolean
): OfficeAgent {
  const targetPosition = getWorkerStatePosition(next)

  if (!previous) {
    return {
      ...next,
      ...targetPosition,
      transition: undefined,
      targetX: undefined,
      targetY: undefined,
      walkPath: undefined,
      walkPathIndex: undefined,
    }
  }

  if (previous.mission?.kind === 'collaboration') {
    const assignmentChanged = previous.taskId !== next.taskId
    const mustInterrupt =
      assignmentChanged ||
      next.state !== previous.mission.targetState ||
      next.state === 'blocked' ||
      next.state === 'failed' ||
      next.state === 'cancelled'
    if (!mustInterrupt) {
      return {
        ...next,
        x: previous.x,
        y: previous.y,
        state: previous.state,
        targetX: previous.targetX,
        targetY: previous.targetY,
        walkPath: previous.walkPath,
        walkPathIndex: previous.walkPathIndex,
        viewFacing: previous.viewFacing,
        facing: previous.facing,
        transition: previous.transition,
        mission: previous.mission,
        bubbleText: previous.bubbleText,
      }
    }
  }

  if (
    next.kind === 'director' &&
    (next.semanticState === 'ambient' || next.semanticState === 'supervising') &&
    next.semanticState === previous.semanticState &&
    previous.ambientActivity
  ) {
    return {
      ...next,
      x: previous.x,
      y: previous.y,
      state: previous.state,
      targetX: previous.targetX,
      targetY: previous.targetY,
      walkPath: previous.walkPath,
      walkPathIndex: previous.walkPathIndex,
      viewFacing: previous.viewFacing,
      facing: previous.facing,
      transition: previous.transition,
      ambientActivity: previous.ambientActivity,
      customAnimation: previous.customAnimation,
    }
  }

  if (next.kind === 'worker' && previous.taskId !== next.taskId) {
    return startArrivalBriefing(
      { ...next, x: previous.x, y: previous.y, facing: previous.facing },
      sceneAgents,
      { delay: reduceMotion ? 0 : 0.35, fromEntrance: false }
    )
  }

  if (next.kind === 'worker' && previous.taskStatus === 'review' && next.taskStatus === 'running') {
    const desk = DESKS.find((item) => item.id === next.assignedDeskId) ?? DESKS[0]!
    const path = planWalkToDeskSeat(
      previous.x,
      previous.y,
      desk,
      createNavContext(sceneAgents, next.id)
    )
    const walking = MovementSystem.assignWalkPath(
      {
        ...next,
        x: previous.x,
        y: previous.y,
        semanticState: 'reworking',
        currentTask: `返工中 · ${next.assignment?.detail ?? next.currentTask ?? ''}`,
        transition: {
          kind: 'collaboration',
          targetState: next.state,
          targetTask: next.currentTask,
        },
      },
      path
    )
    return { ...walking, currentTask: '收到反馈，返回工位返工' }
  }

  const previousTargetState = desiredState(previous)
  if (next.kind === 'worker' && next.state === 'reviewing' && previousTargetState !== 'reviewing') {
    return startWorkerHandoff(
      { ...next, x: previous.x, y: previous.y, facing: previous.facing },
      sceneAgents,
      'review'
    )
  }

  if (next.kind === 'worker' && next.state === 'completed' && previousTargetState !== 'completed') {
    return startWorkerHandoff(
      {
        ...next,
        x: previous.x,
        y: previous.y,
        facing: previous.facing,
      },
      sceneAgents,
      'delivery'
    )
  }

  const previousDesiredState = desiredState(previous)
  if (
    next.state === 'completed' &&
    previousDesiredState === 'completed' &&
    previous.ambientActivity
  ) {
    return {
      ...next,
      x: previous.x,
      y: previous.y,
      state: previous.state,
      targetX: previous.targetX,
      targetY: previous.targetY,
      walkPath: previous.walkPath,
      walkPathIndex: previous.walkPathIndex,
      viewFacing: previous.viewFacing,
      facing: previous.facing,
      transition: previous.transition,
      ambientActivity: previous.ambientActivity,
      customAnimation: previous.customAnimation,
    }
  }

  if (previous.state === 'walking' && previousDesiredState === next.state) {
    return {
      ...next,
      x: previous.x,
      y: previous.y,
      state: 'walking',
      targetX: previous.targetX,
      targetY: previous.targetY,
      walkPath: previous.walkPath,
      walkPathIndex: previous.walkPathIndex,
      viewFacing: previous.viewFacing,
      facing: previous.facing,
      transition: {
        kind: 'worker_state',
        targetState: next.state,
        targetTask: next.currentTask,
      },
    }
  }

  const distance = Math.hypot(previous.x - targetPosition.x, previous.y - targetPosition.y)
  if (distance <= POSITION_EPSILON) {
    return {
      ...next,
      ...targetPosition,
      transition: undefined,
      targetX: undefined,
      targetY: undefined,
      walkPath: undefined,
      walkPathIndex: undefined,
    }
  }

  const context = createNavContext(sceneAgents, next.id)
  const desk = DESKS.find((item) => item.id === next.assignedDeskId)
  const path =
    isDeskWorkerState(next.state) && desk
      ? planWalkToDeskSeat(previous.x, previous.y, desk, context)
      : planWalkFrom(previous.x, previous.y, targetPosition.x, targetPosition.y, context)

  return MovementSystem.assignWalkPath(
    {
      ...next,
      x: previous.x,
      y: previous.y,
      facing: previous.facing,
      viewFacing: previous.viewFacing,
      transition: {
        kind: 'worker_state',
        targetState: next.state,
        targetTask: next.currentTask,
      },
    },
    path
  )
}

export function transitionWorkerRoster(
  nextAgents: OfficeAgent[],
  previousAgents: OfficeAgent[],
  reduceMotion: boolean,
  options: { hydrate?: boolean } = {}
): OfficeAgent[] {
  const previousById = new Map(previousAgents.map((agent) => [agent.id, agent]))
  const stableAgents = assignStableWorkerDesks(nextAgents, previousAgents)
  const transitioned: OfficeAgent[] = []

  stableAgents.forEach((agent, index) => {
    const previous = previousById.get(agent.id)
    const sceneAgents = stableAgents.map(
      (candidate) => transitioned.find((item) => item.id === candidate.id) ?? candidate
    )
    if (!previous && !options.hydrate && agent.kind === 'worker') {
      transitioned.push(
        startArrivalBriefing(agent, sceneAgents, {
          delay: reduceMotion ? 0 : 0.25 + index * 0.38,
          fromEntrance: true,
        })
      )
      return
    }
    transitioned.push(transitionWorkerAgent(agent, previous, sceneAgents, reduceMotion))
  })

  return transitioned
}
