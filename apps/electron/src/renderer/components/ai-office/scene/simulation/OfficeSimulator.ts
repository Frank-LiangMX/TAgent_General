// @ts-nocheck
import type { OfficeAgent } from '../../types/office-agent'
import type { AgentEntity } from '../entities/AgentEntity'
import { getWorkerStatePosition, HANDOFF_STATUS, isDeskWorkerState } from '../layout/officeLayout'
import { talkFacingToward } from '../systems/movementFacing'
import { advanceCompletedAmbient } from './completedAmbient'
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
    return this.pinAmbientAgents(advanceCompletedAmbient(dt, next, this.reduceMotion))
  }

  private pinAmbientAgents(agents: OfficeAgent[]): OfficeAgent[] {
    const visitorByHost = new Map<string, OfficeAgent>()
    for (const a of agents) {
      const m = a.mission
      if (m?.kind === 'desk_visit' && m.phase === 'talk') {
        visitorByHost.set(m.hostAgentId, a)
      }
    }

    return agents.map((agent) => {
      if (agentHasActiveMission(agent)) return agent
      if (agent.state === 'walking' && agent.transition) return agent
      if (agent.state === 'completed' && agent.ambientActivity) return agent

      const visitor = visitorByHost.get(agent.id)
      const toward = visitor
        ? talkFacingToward(agent.x, agent.y, visitor.x, visitor.y)
        : agent.customAnimation
          ? { viewFacing: 'front' as const, facing: 1 as const }
          : {
              viewFacing: isDeskWorkerState(agent.state) ? ('back' as const) : ('front' as const),
              facing: agent.facing,
            }

      const state =
        visitor || (agent.customAnimation && !agent.ambientActivity)
          ? ('talking' as const)
          : agent.state
      const position = getWorkerStatePosition({ ...agent, state })

      return {
        ...agent,
        x: position.x,
        y: position.y,
        state,
        viewFacing: toward.viewFacing,
        facing: toward.facing,
        currentTask: visitor ? HANDOFF_STATUS.receiving : agent.currentTask,
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
    return processDeskVisitMissions(dt, agents, entities)
  }
}
