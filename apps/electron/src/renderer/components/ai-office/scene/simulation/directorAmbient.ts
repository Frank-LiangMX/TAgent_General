import type { OfficeAgent, OfficeAmbientActivity } from '../../types/office-agent'
import { createNavContext, planWalkFrom } from '../navigation/officeNavigation'
import { MovementSystem } from '../systems/MovementSystem'

const DIRECTOR_SPOTS = [
  { label: '在白板前梳理计划', x: 190, y: 315, animation: 'emotes/thinking', duration: 9 },
  { label: '到窗边观察进度', x: 780, y: 390, animation: 'movement/idle-right', duration: 10 },
  { label: '检查公共资料', x: 315, y: 235, animation: 'movement/idle-back', duration: 8 },
  { label: '在沟通区等待消息', x: 480, y: 520, animation: 'movement/idle-front', duration: 10 },
] as const

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function waiting(agent: OfficeAgent, cycle: number): OfficeAmbientActivity {
  return {
    phase: 'delay',
    remaining: 10 + (stableHash(`${agent.appearanceKey}:${cycle}:director-delay`) % 81) / 10,
    cycle,
  }
}

function beginWalk(agent: OfficeAgent, agents: OfficeAgent[]): OfficeAgent {
  const cycle = agent.ambientActivity?.cycle ?? 0
  const spot =
    DIRECTOR_SPOTS[
      stableHash(`${agent.appearanceKey}:${cycle}:director-spot`) % DIRECTOR_SPOTS.length
    ]!
  const activity: OfficeAmbientActivity = {
    label: spot.label,
    animation: spot.animation,
    phase: 'walking',
    remaining: spot.duration,
    cycle,
    targetX: spot.x,
    targetY: spot.y,
  }
  const path = planWalkFrom(agent.x, agent.y, spot.x, spot.y, createNavContext(agents, agent.id))
  return MovementSystem.assignWalkPath(
    {
      ...agent,
      ambientActivity: activity,
      customAnimation: undefined,
      transition: {
        kind: 'ambient',
        targetState: 'waiting',
        targetTask: spot.label,
      },
    },
    path
  )
}

export function advanceDirectorAmbient(
  dt: number,
  agents: OfficeAgent[],
  reducedMotion: boolean
): OfficeAgent[] {
  if (reducedMotion) return agents

  return agents.map((agent) => {
    const desiredState = agent.transition?.targetState ?? agent.state
    if (
      agent.kind !== 'director' ||
      desiredState !== 'waiting' ||
      (agent.semanticState !== 'ambient' && agent.semanticState !== 'supervising') ||
      agent.mission
    ) {
      return agent
    }
    if (agent.state === 'walking') return agent

    const activity = agent.ambientActivity
    if (!activity) return { ...agent, ambientActivity: waiting(agent, 0) }
    const remaining = activity.remaining - dt

    if (activity.phase === 'delay') {
      if (remaining > 0) {
        return { ...agent, ambientActivity: { ...activity, remaining } }
      }
      return beginWalk(agent, agents)
    }

    if (activity.phase === 'acting') {
      if (remaining > 0) {
        return { ...agent, ambientActivity: { ...activity, remaining } }
      }
      return {
        ...agent,
        customAnimation: 'movement/idle-front',
        ambientActivity: waiting(agent, activity.cycle + 1),
      }
    }

    return agent
  })
}
