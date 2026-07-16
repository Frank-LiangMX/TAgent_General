/**
 * Office Agent types — bridging TAgent KanbanTask to office visualization
 */

export type OfficeAgentState = 'idle' | 'walking' | 'working' | 'talking' | 'thinking'

export interface OfficeDeskVisitStop {
  hostRosterNo: number
  hostAgentId: string
  hostDeskId: string
  message: string
}

export interface OfficeDeskVisitMission {
  kind: 'desk_visit'
  phase: 'goto' | 'talk' | 'return'
  hostAgentId: string
  hostDeskId: string
  message: string
  resumeTask: string
  talkDuration: number
  talkRemaining?: number
  queue: OfficeDeskVisitStop[]
}

export interface OfficeAgent {
  id: string
  name: string
  color: number
  x: number
  y: number
  targetX?: number
  targetY?: number
  walkPath?: { x: number; y: number }[]
  walkPathIndex?: number
  state: OfficeAgentState
  currentTask?: string
  assignedDeskId?: string
  bubbleText?: string
  customAnimation?: string
  facing: 1 | -1
  viewFacing?: ChibiFacing
  mission?: OfficeDeskVisitMission
}

export interface OfficeDesk {
  id: string
  x: number
  y: number
  seatX: number
  seatY: number
  occupiedBy?: string
}

/** Re-export chibi facing type for convenience */
export type ChibiFacing = 'front' | 'back' | 'left' | 'right'
