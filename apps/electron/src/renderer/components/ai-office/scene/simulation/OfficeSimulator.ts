// @ts-nocheck
import type { OfficeAgent } from '../../types/office-agent'
import {
  AGENT_ROSTER,
  DESKS,
  HANDOFF_STATUS,
} from '../layout/officeLayout'
import {
  agentHasActiveMission,
  processDeskVisitMissions,
  startDeskVisit,
  startDeskVisitTour,
  type DeskVisitMessageFn,
} from './deskVisit'
import type { AgentEntity } from '../entities/AgentEntity'
import { talkFacingToward } from '../systems/movementFacing'

export class OfficeSimulator {
  tick(_dt: number, agents: OfficeAgent[]): OfficeAgent[] {
    const next = agents.map((a) => ({ ...a }))
    return this.pinAmbientAgents(next)
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

      const desk = this.deskFor(agent)
      const roster = AGENT_ROSTER.find((r) => r.id === agent.id)
      const visitor = visitorByHost.get(agent.id)
      const toward = visitor
        ? talkFacingToward(agent.x, agent.y, visitor.x, visitor.y)
        : agent.customAnimation
          ? { viewFacing: 'front' as const, facing: 1 as const }
        : { viewFacing: 'back' as const, facing: 1 as const }

      const state =
        visitor
          ? ('talking' as const)
          : agent.customAnimation
            ? ('talking' as const)
          : agent.state === 'thinking' || agent.state === 'idle'
            ? agent.state
            : ('working' as const)

      return {
        ...agent,
        x: desk.seatX,
        y: desk.seatY,
        state,
        viewFacing: toward.viewFacing,
        facing: toward.facing,
        currentTask: visitor
          ? HANDOFF_STATUS.receiving
          : state === 'idle'
            ? undefined
            : (agent.currentTask ?? roster?.task),
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
    message: string,
  ): OfficeAgent[] {
    return startDeskVisit(agents, visitorRosterNo, hostRosterNo, message)
  }

  startDeskVisitTour(
    agents: OfficeAgent[],
    visitorRosterNo: number,
    hostRosterNos: number[],
    messageFn?: DeskVisitMessageFn,
  ): OfficeAgent[] {
    return startDeskVisitTour(agents, visitorRosterNo, hostRosterNos, messageFn)
  }

  afterMovement(
    dt: number,
    agents: OfficeAgent[],
    entities: Map<string, AgentEntity>,
  ): OfficeAgent[] {
    return processDeskVisitMissions(dt, agents, entities)
  }

  private deskFor(agent: OfficeAgent) {
    const id = agent.assignedDeskId
    return DESKS.find((d) => d.id === id) ?? DESKS[0]
  }
}
