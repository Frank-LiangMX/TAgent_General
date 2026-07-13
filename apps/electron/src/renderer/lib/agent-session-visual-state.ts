import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'

export type SessionLeftAccent = 'orange' | 'blue' | 'green' | 'primary' | 'amber' | 'idle'

const SESSION_STATUS_LINE_CLASS: Record<SessionLeftAccent, string | null> = {
  orange: 'bg-orange-500',
  blue: 'tab-status-streaming',
  green: 'bg-emerald-500',
  primary: 'tab-indicator-line',
  amber: 'bg-amber-500',
  idle: null,
}

interface AgentSessionVisualStateOptions {
  active: boolean
  indicatorStatus: SessionIndicatorStatus
  isBatchMode: boolean
  isBatchSelected: boolean
  leftAccent?: SessionLeftAccent
}

export interface AgentSessionVisualState {
  selectionClassName: string
  showRunningSweep: boolean
  statusLineClass: string | null
}

/** Resolve Agent session row visuals without coupling the shared active-session surface to run state. */
export function getAgentSessionVisualState({
  active,
  indicatorStatus,
  isBatchMode,
  isBatchSelected,
  leftAccent,
}: AgentSessionVisualStateOptions): AgentSessionVisualState {
  if (isBatchSelected) {
    return {
      selectionClassName: 'rounded-xl bg-primary/10',
      showRunningSweep: false,
      statusLineClass: null,
    }
  }

  const showRunningSweep = !isBatchMode && active && indicatorStatus === 'running'
  let selectionClassName = 'rounded-xl'

  if (active) {
    if (indicatorStatus === 'running') {
      selectionClassName = 'session-list-item-active session-list-item-active--running'
    } else if (indicatorStatus === 'blocked') {
      selectionClassName = 'session-list-item-active session-list-item-active--blocked'
    } else if (indicatorStatus === 'completed') {
      selectionClassName = 'session-list-item-active session-list-item-active--completed'
    } else {
      selectionClassName = 'session-list-item-active'
    }
  }

  return {
    selectionClassName,
    showRunningSweep,
    statusLineClass:
      !isBatchMode && !active && leftAccent ? SESSION_STATUS_LINE_CLASS[leftAccent] : null,
  }
}
