// @ts-nocheck
import type { OfficeScene } from './OfficeScene'
import type { OfficeAgent, OfficeAgentState } from '../types/office-agent'

let scene: OfficeScene | null = null

type PendingDeskVisit = {
  kind: 'desk_visit'
  visitorRosterNo: number
  hostRosterNo: number
  message: string
}

type PendingSetState = {
  kind: 'set_state'
  agentId: string
  state: OfficeAgentState
  task?: string
}

type PendingAction = PendingDeskVisit | PendingSetState

const pendingActions: PendingAction[] = []

function flushPendingActions() {
  if (!scene || pendingActions.length === 0) return

  const queue = pendingActions.splice(0)
  console.info('[OfficeHTTP] scene ready, flushing', queue.length, 'pending action(s)')
  for (const action of queue) {
    if (action.kind === 'desk_visit') {
      scene.requestDeskVisit(action.visitorRosterNo, action.hostRosterNo, action.message)
    } else {
      scene.setAgentState(action.agentId, action.state, action.task)
    }
  }
}

export function bindOfficeScene(instance: OfficeScene | null) {
  scene = instance
  if (instance) flushPendingActions()
}

export function requestDeskVisit(visitorRosterNo: number, hostRosterNo: number, message: string) {
  if (!scene) {
    pendingActions.push({
      kind: 'desk_visit',
      visitorRosterNo,
      hostRosterNo,
      message,
    })
    return
  }
  scene.requestDeskVisit(visitorRosterNo, hostRosterNo, message)
}

export function requestDeskVisitTour(
  visitorRosterNo: number,
  hostRosterNos: number[],
  messageFn?: (hostRosterNo: number, hostName: string) => string
) {
  if (!scene) {
    return
  }
  scene.requestDeskVisitTour(visitorRosterNo, hostRosterNos, messageFn)
}

export function isOfficeSceneReady() {
  return scene != null
}

export function setAgentState(agentId: string, state: OfficeAgentState, task?: string) {
  if (!scene) {
    pendingActions.push({
      kind: 'set_state',
      agentId,
      state,
      task,
    })
    return
  }
  scene.setAgentState(agentId, state, task)
}

export function getSceneAgents(): OfficeAgent[] {
  return scene?.getAgents() ?? []
}
