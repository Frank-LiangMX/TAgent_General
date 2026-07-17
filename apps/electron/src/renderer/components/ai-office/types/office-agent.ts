/**
 * Office Agent types — bridging TAgent KanbanTask to office visualization
 */

import type { KanbanTaskStatus } from '@tagent/shared'

/**
 * 办公室表现态。
 *
 * walking / talking 是场景过渡态，其余状态直接映射自 Kanban worker 的真实运行态。
 */
export type OfficeAgentState =
  | 'waiting'
  | 'walking'
  | 'working'
  | 'talking'
  | 'thinking'
  | 'reviewing'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'

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

/** worker 状态变化时的场景迁移，抵达目标区域后再切到真实状态。 */
export interface OfficeAgentTransition {
  kind: 'worker_state' | 'ambient'
  targetState: OfficeAgentState
  targetTask?: string
}

export type OfficeAmbientActivityKind =
  | 'coffee_break'
  | 'window_gazing'
  | 'printer_wander'
  | 'plant_break'
  | 'stretching'

export interface OfficeAmbientActivity {
  kind?: OfficeAmbientActivityKind
  label?: string
  animation?: string
  phase: 'delay' | 'walking' | 'acting'
  remaining: number
  cycle: number
  targetX?: number
  targetY?: number
}

export interface OfficeAgent {
  /** 场景角色类型；主 Agent 与 worker 共用渲染实体，但不共用业务身份。 */
  kind?: 'director' | 'worker'
  /** 场景实体 ID；director 使用主会话，worker 使用任务或 worker 会话。 */
  id: string
  /** 对应的看板任务；director 没有任务 ID。 */
  taskId?: string
  /** 对应角色库 ID */
  roleId?: string
  /** 真正执行该任务的 worker 子会话 */
  workerSessionId?: string
  /** Kanban 原始状态，供详情和调试展示 */
  taskStatus?: KanbanTaskStatus
  /** 角色外观的稳定 seed；优先使用真实 workerSessionId */
  appearanceKey: string
  /** 当前实时进度 */
  progressText?: string
  /** 最近使用的工具 */
  lastToolName?: string
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
  transition?: OfficeAgentTransition
  /** 已交卷后的场景生活行为，不改变 Kanban 业务状态。 */
  ambientActivity?: OfficeAmbientActivity
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
