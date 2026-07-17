import type {
  OfficeAgent,
  OfficeAmbientActivity,
  OfficeAmbientActivityKind,
} from '../../types/office-agent'
import { DESKS } from '../layout/officeLayout'
import { createNavContext, planWalkFrom } from '../navigation/officeNavigation'
import { MovementSystem } from '../systems/MovementSystem'

interface AmbientSpot {
  kind: OfficeAmbientActivityKind
  label: string
  x: number
  y: number
  animation: string
  duration: number
}

/** Activity points matched to the rendered office background. */
export const COMPLETED_AMBIENT_SPOTS: readonly AmbientSpot[] = [
  {
    kind: 'coffee_break',
    label: '去茶水间歇会儿',
    x: 730,
    y: 235,
    animation: 'emotes/fawning',
    duration: 6.5,
  },
  {
    kind: 'window_gazing',
    label: '在窗边放空',
    x: 835,
    y: 390,
    animation: 'movement/idle-right',
    duration: 7.5,
  },
  {
    kind: 'printer_wander',
    label: '顺路看看打印机',
    x: 315,
    y: 235,
    animation: 'emotes/dramatic-stare',
    duration: 5.5,
  },
  {
    kind: 'plant_break',
    label: '去植物角摸鱼',
    x: 170,
    y: 455,
    animation: 'emotes/love',
    duration: 6.5,
  },
  {
    kind: 'stretching',
    label: '找块空地伸懒腰',
    x: 315,
    y: 565,
    animation: 'emotes/determined',
    duration: 5,
  },
]

function stableHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function delayFor(agent: OfficeAgent, cycle: number): number {
  return 2.4 + (stableHash(`${agent.appearanceKey}:${cycle}:delay`) % 35) / 10
}

function activityFor(agent: OfficeAgent, cycle: number): AmbientSpot {
  const index =
    stableHash(`${agent.appearanceKey}:${cycle}:activity`) % COMPLETED_AMBIENT_SPOTS.length
  return COMPLETED_AMBIENT_SPOTS[index]!
}

function activityPosition(agent: OfficeAgent, spot: AmbientSpot): { x: number; y: number } {
  const deskSlot = Math.max(
    0,
    DESKS.findIndex((desk) => desk.id === agent.assignedDeskId)
  )
  const offsetX = ((deskSlot % 3) - 1) * 16
  const offsetY = (Math.floor(deskSlot / 3) - 0.5) * 14
  return { x: spot.x + offsetX, y: spot.y + offsetY }
}

function waitingActivity(agent: OfficeAgent, cycle: number): OfficeAmbientActivity {
  return {
    phase: 'delay',
    remaining: delayFor(agent, cycle),
    cycle,
  }
}

function beginAmbientWalk(agent: OfficeAgent, agents: OfficeAgent[]): OfficeAgent {
  const cycle = agent.ambientActivity?.cycle ?? 0
  const spot = activityFor(agent, cycle)
  const target = activityPosition(agent, spot)
  const ambientActivity: OfficeAmbientActivity = {
    kind: spot.kind,
    label: spot.label,
    animation: spot.animation,
    phase: 'walking',
    remaining: spot.duration,
    cycle,
    targetX: target.x,
    targetY: target.y,
  }
  const path = planWalkFrom(
    agent.x,
    agent.y,
    target.x,
    target.y,
    createNavContext(agents, agent.id)
  )

  return MovementSystem.assignWalkPath(
    {
      ...agent,
      ambientActivity,
      customAnimation: undefined,
      transition: {
        kind: 'ambient',
        targetState: 'completed',
        targetTask: agent.currentTask,
      },
    },
    path
  )
}

export function advanceCompletedAmbient(
  dt: number,
  agents: OfficeAgent[],
  reduceMotion: boolean
): OfficeAgent[] {
  if (reduceMotion) return agents

  return agents.map((agent) => {
    const targetState = agent.transition?.targetState ?? agent.state
    if (targetState !== 'completed' || agent.mission) return agent
    if (agent.state === 'walking') return agent

    const ambient = agent.ambientActivity
    if (!ambient) {
      return { ...agent, ambientActivity: waitingActivity(agent, 0) }
    }

    const remaining = ambient.remaining - dt
    if (ambient.phase === 'delay') {
      if (remaining > 0) {
        return { ...agent, ambientActivity: { ...ambient, remaining } }
      }
      return beginAmbientWalk(agent, agents)
    }

    if (ambient.phase === 'acting') {
      if (remaining > 0) {
        return { ...agent, ambientActivity: { ...ambient, remaining } }
      }
      const nextCycle = ambient.cycle + 1
      return {
        ...agent,
        customAnimation: 'movement/idle-front',
        ambientActivity: waitingActivity(agent, nextCycle),
      }
    }

    return agent
  })
}
