import type { OfficeAgent } from '../../types/office-agent'
import { DESKS, getWorkerStatePosition, isDeskWorkerState } from '../layout/officeLayout'
import { createNavContext, planWalkFrom, planWalkToDeskSeat } from '../navigation/officeNavigation'
import { MovementSystem } from '../systems/MovementSystem'

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

  if (!previous || reduceMotion) {
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
  reduceMotion: boolean
): OfficeAgent[] {
  const previousById = new Map(previousAgents.map((agent) => [agent.id, agent]))
  const stableAgents = assignStableWorkerDesks(nextAgents, previousAgents)
  return stableAgents.map((agent) =>
    transitionWorkerAgent(agent, previousById.get(agent.id), stableAgents, reduceMotion)
  )
}
