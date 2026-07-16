// @ts-nocheck
import type { OfficeDesk } from '../../types/office-agent'
import { SEAT_OFFSET_Y } from '../layout/officeLayout'

export const DESK_DISPLAY_WIDTH = (152 * 2) / 3
export const DESK_SPRITE_OFFSET_Y = SEAT_OFFSET_Y - 14
export const DESK_SPRITE_ANCHOR_Y = 0.62
export const DESK_DISPLAY_HEIGHT = DESK_DISPLAY_WIDTH * 0.72

export const NAV_AGENT_CLEARANCE = 16

export const SIDE_OFFSET =
  Math.ceil(DESK_DISPLAY_WIDTH / 2) + NAV_AGENT_CLEARANCE

export const COL_AISLE_MARGIN = SIDE_OFFSET + 6

export function getDeskBounds(desk: OfficeDesk) {
  const anchorY = desk.y + DESK_SPRITE_OFFSET_Y
  const halfW = DESK_DISPLAY_WIDTH / 2
  const h = DESK_DISPLAY_HEIGHT
  return {
    top: anchorY - h * DESK_SPRITE_ANCHOR_Y,
    bottom: anchorY + h * (1 - DESK_SPRITE_ANCHOR_Y),
    left: desk.x - halfW,
    right: desk.x + halfW,
  }
}

export function getRowCorridorY(desk: OfficeDesk): number {
  return desk.seatY
}

export function isFrontRowDesk(
  desk: OfficeDesk,
  corridorY: number,
): boolean {
  return Math.abs(corridorY - desk.seatY) < 8
}
