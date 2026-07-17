import type { KanbanTaskStatus } from '@tagent/shared'

/** Stable employee identity. Assignments may change without replacing the actor. */
export interface OfficeActor {
  actorId: string
  kind: 'director' | 'worker'
  sessionId: string
  roleId?: string
  appearanceKey: string
  displayName: string
}

/** A Kanban task currently carried by an actor. */
export interface OfficeAssignment {
  taskId: string
  title: string
  status: KanbanTaskStatus
  detail: string
  progressText?: string
  lastToolName?: string
}

/** Business-derived role meaning. It never contains coordinates or animation names. */
export type OfficeSemanticState =
  | 'listening'
  | 'thinking'
  | 'planning'
  | 'summoning'
  | 'briefing'
  | 'working'
  | 'supervising'
  | 'blocked'
  | 'awaiting_review'
  | 'delivering'
  | 'reworking'
  | 'reporting'
  | 'ambient'
  | 'failed'
  | 'off_duty'
