import type {
  OfficeAgent,
  OfficeAgentState,
  OfficeCollaborationKind,
  OfficeCollaborationMission,
} from '../../types/office-agent'
import type { OfficeSemanticState } from '../../types/office-actor'
import type { AgentEntity } from '../entities/AgentEntity'
import { DESKS } from '../layout/officeLayout'
import { createNavContext, planWalkFrom, planWalkToDeskSeat } from '../navigation/officeNavigation'
import { MovementSystem } from '../systems/MovementSystem'
import { talkFacingToward } from '../systems/movementFacing'

export const OFFICE_ENTRANCE = { x: 92, y: 570 } as const
export const DIRECTOR_MEETING_POINT = { x: 430, y: 520 } as const

const TALK_SECONDS: Record<OfficeCollaborationKind, number> = {
  arrival_briefing: 1.8,
  review: 1.6,
  delivery: 1.9,
}

const TALK_MESSAGES: Record<OfficeCollaborationKind, string> = {
  arrival_briefing: '收到任务，先确认一下交接。',
  review: '阶段结果已提交，请验收。',
  delivery: '任务完成，交付结果。',
}

function meetingIsBusy(agents: OfficeAgent[], agentId: string): boolean {
  return agents.some(
    (agent) =>
      agent.id !== agentId &&
      agent.mission?.kind === 'collaboration' &&
      agent.mission.phase !== 'walking_to_desk'
  )
}

function mission(
  intent: OfficeCollaborationKind,
  phase: OfficeCollaborationMission['phase'],
  targetState: OfficeAgentState,
  targetSemanticState: OfficeSemanticState | undefined,
  targetTask: string | undefined,
  remaining = 0
): OfficeCollaborationMission {
  return {
    kind: 'collaboration',
    intent,
    phase,
    targetState,
    targetSemanticState,
    targetTask,
    remaining,
  }
}

function walkToMeeting(agent: OfficeAgent, agents: OfficeAgent[]): OfficeAgent {
  const path = planWalkFrom(
    agent.x,
    agent.y,
    DIRECTOR_MEETING_POINT.x,
    DIRECTOR_MEETING_POINT.y,
    createNavContext(agents, agent.id)
  )
  const walking = MovementSystem.assignWalkPath(agent, path)
  const current = agent.mission as OfficeCollaborationMission
  return {
    ...walking,
    currentTask: current.intent === 'arrival_briefing' ? '前往沟通区接受任务' : '前往总监处交接',
    mission: { ...current, phase: 'walking_to_meet', remaining: 0 },
    transition: {
      kind: 'collaboration',
      targetState: 'talking',
      targetTask: current.targetTask,
    },
  }
}

export function startArrivalBriefing(
  agent: OfficeAgent,
  agents: OfficeAgent[],
  options: { delay: number; fromEntrance: boolean }
): OfficeAgent {
  const targetState = agent.state
  const targetSemanticState = agent.semanticState
  const queued = meetingIsBusy(agents, agent.id)
  const shouldDelay = options.delay > 0 || queued
  const prepared: OfficeAgent = {
    ...agent,
    ...(options.fromEntrance ? OFFICE_ENTRANCE : {}),
    state: 'waiting',
    semanticState: 'briefing',
    currentTask: shouldDelay ? '等待进入沟通区' : '准备接受任务',
    ambientActivity: undefined,
    customAnimation: undefined,
    mission: mission(
      'arrival_briefing',
      shouldDelay ? 'delay' : 'walking_to_meet',
      targetState,
      targetSemanticState,
      agent.currentTask,
      options.delay
    ),
  }
  return shouldDelay ? prepared : walkToMeeting(prepared, agents)
}

export function startWorkerHandoff(
  agent: OfficeAgent,
  agents: OfficeAgent[],
  intent: 'review' | 'delivery'
): OfficeAgent {
  const targetSemanticState = agent.semanticState
  const queued = meetingIsBusy(agents, agent.id)
  const prepared: OfficeAgent = {
    ...agent,
    state: queued ? 'waiting' : agent.state,
    semanticState: 'delivering',
    currentTask: queued ? '等待进入交接区' : agent.currentTask,
    ambientActivity: undefined,
    customAnimation: undefined,
    mission: mission(
      intent,
      queued ? 'delay' : 'walking_to_meet',
      agent.state,
      targetSemanticState,
      agent.currentTask
    ),
  }
  return queued ? prepared : walkToMeeting(prepared, agents)
}

export function collaborationPartnerByDirector(agents: OfficeAgent[]): Map<string, OfficeAgent> {
  const result = new Map<string, OfficeAgent>()
  const director = agents.find((agent) => agent.kind === 'director')
  if (!director) return result
  const partner = agents.find(
    (agent) => agent.mission?.kind === 'collaboration' && agent.mission.phase === 'talking'
  )
  if (partner) result.set(director.id, partner)
  return result
}

export function processCollaborationMissions(
  dt: number,
  agents: OfficeAgent[],
  entities: Map<string, AgentEntity>
): OfficeAgent[] {
  let meetingOwnerId = agents.find(
    (agent) =>
      agent.mission?.kind === 'collaboration' &&
      (agent.mission.phase === 'walking_to_meet' || agent.mission.phase === 'talking')
  )?.id

  return agents.map((agent) => {
    const activeMission = agent.mission
    if (!activeMission || activeMission.kind !== 'collaboration') return agent

    if (activeMission.phase === 'delay') {
      const remaining = activeMission.remaining - dt
      if (remaining > 0) {
        return { ...agent, mission: { ...activeMission, remaining } }
      }
      if (meetingOwnerId && meetingOwnerId !== agent.id) {
        return {
          ...agent,
          state: 'waiting',
          currentTask:
            activeMission.intent === 'arrival_briefing' ? '等待进入沟通区' : '等待进入交接区',
          mission: { ...activeMission, remaining: 0 },
        }
      }
      meetingOwnerId = agent.id
      return walkToMeeting({ ...agent, mission: { ...activeMission, remaining: 0 } }, agents)
    }

    if (activeMission.phase === 'walking_to_meet') {
      if (agent.state === 'walking' || agent.targetX != null) return agent
      const director = agents.find((item) => item.kind === 'director')
      const facing = director
        ? talkFacingToward(agent.x, agent.y, director.x, director.y)
        : { viewFacing: 'front' as const, facing: 1 as const }
      entities
        .get(agent.id)
        ?.showBubble(TALK_MESSAGES[activeMission.intent], TALK_SECONDS[activeMission.intent])
      return {
        ...agent,
        ...facing,
        state: 'talking',
        currentTask:
          activeMission.intent === 'arrival_briefing' ? '正在接受任务说明' : '正在完成工作交接',
        mission: {
          ...activeMission,
          phase: 'talking',
          remaining: TALK_SECONDS[activeMission.intent],
        },
        transition: undefined,
      }
    }

    if (activeMission.phase === 'talking') {
      const remaining = activeMission.remaining - dt
      if (remaining > 0) {
        return { ...agent, mission: { ...activeMission, remaining } }
      }
      entities.get(agent.id)?.hideBubble()
      if (activeMission.intent !== 'arrival_briefing') {
        return {
          ...agent,
          state: activeMission.targetState,
          semanticState: activeMission.targetSemanticState,
          currentTask: activeMission.targetTask,
          bubbleText: undefined,
          mission: undefined,
          transition: undefined,
        }
      }

      const desk = DESKS.find((item) => item.id === agent.assignedDeskId) ?? DESKS[0]!
      const path = planWalkToDeskSeat(agent.x, agent.y, desk, createNavContext(agents, agent.id))
      const walking = MovementSystem.assignWalkPath(agent, path)
      return {
        ...walking,
        currentTask: '前往工位开始执行',
        bubbleText: undefined,
        mission: { ...activeMission, phase: 'walking_to_desk', remaining: 0 },
        transition: {
          kind: 'collaboration',
          targetState: activeMission.targetState,
          targetTask: activeMission.targetTask,
        },
      }
    }

    if (activeMission.phase === 'walking_to_desk') {
      if (agent.state === 'walking' || agent.targetX != null) return agent
      return {
        ...agent,
        state: activeMission.targetState,
        semanticState: activeMission.targetSemanticState,
        currentTask: activeMission.targetTask,
        mission: undefined,
        transition: undefined,
      }
    }

    return agent
  })
}
