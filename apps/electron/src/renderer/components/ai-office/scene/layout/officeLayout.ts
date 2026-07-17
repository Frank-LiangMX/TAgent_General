// @ts-nocheck
import type { OfficeAgent, OfficeAgentState, OfficeDesk } from '../../types/office-agent'

export const SCENE_WIDTH = 960
export const SCENE_HEIGHT = 640

/** Character-centre bounds for the visible floor; the right-side wall starts beyond this area. */
export const OFFICE_WALKABLE_BOUNDS = {
  minX: 120,
  maxX: 800,
  minY: 220,
  maxY: 585,
} as const

export function clampOfficeWalkablePoint(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(OFFICE_WALKABLE_BOUNDS.minX, Math.min(OFFICE_WALKABLE_BOUNDS.maxX, x)),
    y: Math.max(OFFICE_WALKABLE_BOUNDS.minY, Math.min(OFFICE_WALKABLE_BOUNDS.maxY, y)),
  }
}

export const COLORS = {
  floor: 0xffffff,
  wall: 0xe8e6e1,
  desk: 0xffffff,
  deskShadow: 0x00000014,
  monitor: 0x2a2a2a,
  chair: 0xd4d2cc,
  agentBody: 0x1a1a1a,
} as const

const DESK_COLS = 2
const DESK_ROWS = 3
const DESK_COL_GAP = 150
const DESK_ROW_GAP = 140
const DESK_BLOCK_WIDTH = (DESK_COLS - 1) * DESK_COL_GAP
const DESK_BLOCK_HEIGHT = (DESK_ROWS - 1) * DESK_ROW_GAP
const DESK_ORIGIN_X = (SCENE_WIDTH - DESK_BLOCK_WIDTH) / 2
const DESK_ORIGIN_Y = (SCENE_HEIGHT - DESK_BLOCK_HEIGHT) / 2
export const SEAT_OFFSET_Y = 45

function buildDesks(): OfficeDesk[] {
  const desks: OfficeDesk[] = []
  let n = 0
  for (let row = 0; row < DESK_ROWS; row++) {
    for (let col = 0; col < DESK_COLS; col++) {
      const x = DESK_ORIGIN_X + col * DESK_COL_GAP
      const y = DESK_ORIGIN_Y + row * DESK_ROW_GAP
      desks.push({ id: `desk-${n}`, x, y, seatX: x, seatY: y + SEAT_OFFSET_Y })
      n++
    }
  }
  return desks
}

export const DESKS: OfficeDesk[] = buildDesks()

export type AgentRosterEntry = { id: string; name: string; color: number; task: string }

export const AGENT_ROSTER: AgentRosterEntry[] = [
  { id: 'marvis', name: '王明', color: 0xe85d4a, task: '主管：等待交付物' },
  { id: 'code-agent', name: '李研', color: 0x4a90d9, task: '检索：扫描信息源' },
  { id: 'file-agent', name: '周理', color: 0x9b6dd7, task: '整理：归类情报' },
  { id: 'app-agent', name: '陈书', color: 0xf5c542, task: '撰写：起草标书' },
  { id: 'review-agent', name: '刘市', color: 0xf97316, task: '市场：打包情报简报' },
  { id: 'data-agent', name: '赵审', color: 0x4ecdc4, task: '审核：合规待审队列' },
]

/** 场景启动时不创建假员工，worker 只由 KanbanTask 投影产生。 */
export const INITIAL_AGENTS: OfficeAgent[] = []

export function isDeskWorkerState(state: OfficeAgentState): boolean {
  return state === 'working' || state === 'thinking' || state === 'reviewing'
}

/**
 * 非工作态有自己的活动区域，避免所有 worker 永远钉在办公桌前。
 * 位置按 desk slot 稳定错开，最多覆盖当前场景的 6 个 worker。
 */
export function getWorkerStatePosition(agent: OfficeAgent): { x: number; y: number } {
  const slot = Math.max(
    0,
    DESKS.findIndex((desk) => desk.id === agent.assignedDeskId)
  )
  const col = slot % 3
  const row = Math.floor(slot / 3)
  const desk = DESKS[slot] ?? DESKS[0]!

  if (agent.kind === 'director') {
    switch (agent.state) {
      case 'working':
      case 'thinking':
      case 'reviewing':
        return { x: desk.seatX, y: desk.seatY }
      case 'blocked':
        return { x: 190, y: 315 }
      case 'talking':
        return { x: 480, y: 545 }
      case 'walking':
        return { x: agent.x, y: agent.y }
      default:
        return { x: 480, y: 520 }
    }
  }

  if (agent.semanticState === 'awaiting_review' || agent.semanticState === 'delivering') {
    return { x: 430, y: 520 }
  }

  if (isDeskWorkerState(agent.state) || agent.state === 'talking') {
    return { x: desk.seatX, y: desk.seatY }
  }

  switch (agent.state) {
    case 'waiting':
      return { x: 300 + col * 130, y: 570 - row * 54 }
    case 'blocked':
      return { x: 145 + col * 48, y: 290 + row * 72 }
    case 'completed':
      return { x: 680 + col * 42, y: 520 - row * 64 }
    case 'failed':
      return { x: 690 + col * 42, y: 275 + row * 70 }
    case 'cancelled':
      return { x: 760 + col * 16, y: 575 - row * 48 }
    case 'walking':
      return { x: agent.x, y: agent.y }
  }
}

export const HANDOFF_STATUS = {
  delivering: '交接递送中…',
  handingOff: '正在交接…',
  receiving: '接收交接中…',
  wrappingUp: '交接收尾中…',
  planning: '规划交接中…',
} as const

export const HANDOFF_VISIT_MESSAGES: ((hostName: string) => string)[] = [
  (n) => `${n}，这件事交给你了。`,
  (n) => `${n}，轮到你了，说明在工单里。`,
  (n) => `${n}，接力给你，上下文在线程里。`,
  (n) => `${n}，你队列里有最新的交接包。`,
  (n) => `${n}，工单已转给你，我这边解除了阻塞。`,
  (n) => `${n}，能从这里接手吗？`,
  (n) => `${n}，我这边交接完成，交给你了。`,
  (n) => `${n}，收到后请确认一下。`,
]

export function pickHandoffVisitMessage(hostName: string, hostRosterNo: number): string {
  const i = Math.abs(hostRosterNo - 1) % HANDOFF_VISIT_MESSAGES.length
  return HANDOFF_VISIT_MESSAGES[i]!(hostName)
}
