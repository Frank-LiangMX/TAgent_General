import type { OfficeAgent } from '../types/office-agent'
import { INITIAL_AGENTS } from '../scene/layout/officeLayout'

let agents: OfficeAgent[] = INITIAL_AGENTS.map((a) => ({ ...a }))

export function getOfficeAgents(): OfficeAgent[] {
  return agents
}

export function setOfficeAgents(nextAgents: OfficeAgent[]) {
  agents = nextAgents
}
