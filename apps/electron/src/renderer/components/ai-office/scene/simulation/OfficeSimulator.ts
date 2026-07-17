// @ts-nocheck
import type { OfficeAgent } from '../../types/office-agent'
import type { AgentEntity } from '../entities/AgentEntity'
import { getWorkerStatePosition, HANDOFF_STATUS, isDeskWorkerState } from '../layout/officeLayout'
import { talkFacingToward } from '../systems/movementFacing'
import { advanceCompletedAmbient } from './completedAmbient'
import { advanceDirectorAmbient } from './directorAmbient'
import { collaborationPartnerByDirector, processCollaborationMissions } from './collaboration'
import {
  agentHasActiveMission,
  processDeskVisitMissions,
  startDeskVisit,
  startDeskVisitTour,
  type DeskVisitMessageFn,
} from './deskVisit'

export class OfficeSimulator {
  private reduceMotion = false

  setReduceMotion(value: boolean): void {
    this.reduceMotion = value
  }

  tick(dt: number, agents: OfficeAgent[]): OfficeAgent[] {
    const next = agents.map((a) => ({ ...a }))
    return this.pinAmbientAgents(
      advanceDirectorAmbient(
        dt,
        advanceCompletedAmbient(dt, next, this.reduceMotion),
        this.reduceMotion
      )
    )
  }

  private pinAmbientAgents(agents: OfficeAgent[]): OfficeAgent[] {
    const visitorByHost = collaborationPartnerByDirector(agents)
    for (const a of agents) {
      const m = a.mission
      if (m?.kind === 'desk_visit' && m.phase === 'talk') {
        visitorByHost.set(m.hostAgentId, a)
      }
    }

    return agents.map((agent) => {
      if (agentHasActiveMission(agent)) return agent
      const visitor = visitorByHost.get(agent.id)
      if (visitor) {
        const toward = talkFacingToward(agent.x, agent.y, visitor.x, visitor.y)
        const position = getWorkerStatePosition({ ...agent, state: 'talking' })
        return {
          ...agent,
          ...position,
          ...toward,
          state: 'talking' as const,
          currentTask: HANDOFF_STATUS.receiving,
          targetX: undefined,
          targetY: undefined,
          walkPath: undefined,
          walkPathIndex: undefined,
          transition: undefined,
          ambientActivity: undefined,
          customAnimation: undefined,
          bubbleText: undefined,
        }
      }
      if (agent.state === 'walking' && agent.transition) return agent
      if (agent.ambientActivity) return agent

      const toward = agent.customAnimation
        ? { viewFacing: 'front' as const, facing: 1 as const }
        : {
            viewFacing:
              isDeskWorkerState(agent.state) && agent.semanticState !== 'awaiting_review'
                ? ('back' as const)
                : ('front' as const),
            facing: agent.facing,
          }

      const resumedDirectorState =
        agent.kind === 'director' &&
        (agent.semanticState === 'ambient' || agent.semanticState === 'supervising') &&
        agent.state === 'talking'
          ? ('waiting' as const)
          : agent.state
      const state = agent.customAnimation ? ('talking' as const) : resumedDirectorState
      const position = getWorkerStatePosition({ ...agent, state })

      return {
        ...agent,
        x: position.x,
        y: position.y,
        state,
        viewFacing: toward.viewFacing,
        facing: toward.facing,
        currentTask:
          agent.kind === 'director' && state === 'waiting'
            ? agent.semanticState === 'supervising'
              ? '正在巡视团队进度'
              : '等待你的指示'
            : agent.currentTask,
        targetX: undefined,
        targetY: undefined,
        walkPath: undefined,
        walkPathIndex: undefined,
        bubbleText: undefined,
      }
    })
  }

  startDeskVisit(
    agents: OfficeAgent[],
    visitorRosterNo: number,
    hostRosterNo: number,
    message: string
  ): OfficeAgent[] {
    return startDeskVisit(agents, visitorRosterNo, hostRosterNo, message)
  }

  startDeskVisitTour(
    agents: OfficeAgent[],
    visitorRosterNo: number,
    hostRosterNos: number[],
    messageFn?: DeskVisitMessageFn
  ): OfficeAgent[] {
    return startDeskVisitTour(agents, visitorRosterNo, hostRosterNos, messageFn)
  }

  afterMovement(
    dt: number,
    agents: OfficeAgent[],
    entities: Map<string, AgentEntity>
  ): OfficeAgent[] {
    return processCollaborationMissions(
      dt,
      processDeskVisitMissions(dt, agents, entities),
      entities
    )
  }
}
