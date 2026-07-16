// @ts-nocheck
import type { OfficeDesk } from '../../types/office-agent'
import { SEAT_OFFSET_Y } from '../layout/officeLayout'

export const DESK_DEPTH_SPLIT_OFFSET = SEAT_OFFSET_Y - 14
export const CHAIR_DEPTH_SPLIT_OFFSET = SEAT_OFFSET_Y + 4

const NEAR_X = 78
const NEAR_Y = 130

export function getDeskDepthSplitY(desk: OfficeDesk): number {
  return desk.y + DESK_DEPTH_SPLIT_OFFSET
}

export function getChairDepthSplitY(desk: OfficeDesk): number {
  return desk.y + CHAIR_DEPTH_SPLIT_OFFSET
}

export function isAgentNearDesk(
  desk: OfficeDesk,
  ax: number,
  ay: number,
): boolean {
  return (
    Math.abs(ax - desk.x) < NEAR_X && Math.abs(ay - desk.y) < NEAR_Y
  )
}

type AgentPos = { x: number; y: number }

function applySplitDepthZ(
  baseZ: number,
  split: number,
  agents: AgentPos[],
  desk: OfficeDesk,
  agentAhead: number,
  agentBehind: number,
): number {
  let z = baseZ

  for (const a of agents) {
    if (!isAgentNearDesk(desk, a.x, a.y)) continue
    if (a.y < split) {
      z = Math.max(z, a.y + agentBehind)
    } else {
      z = Math.min(z, a.y - agentAhead)
    }
  }

  return z
}

export function computeDeskLayerZ(desk: OfficeDesk, agents: AgentPos[]): number {
  return applySplitDepthZ(
    desk.y,
    getDeskDepthSplitY(desk),
    agents,
    desk,
    0.5,
    0.5,
  )
}

export function computeChairLayerZ(
  desk: OfficeDesk,
  agents: AgentPos[],
  chairAhead = 2,
): number {
  return applySplitDepthZ(
    desk.seatY + chairAhead,
    getChairDepthSplitY(desk),
    agents,
    desk,
    0.5,
    1.5,
  )
}
