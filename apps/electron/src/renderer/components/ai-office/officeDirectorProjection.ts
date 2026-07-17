import { DESKS } from './scene/layout/officeLayout'
import type { OfficeAgent, OfficeAgentState } from './types/office-agent'
import type { OfficeActor, OfficeSemanticState } from './types/office-actor'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'

export interface OfficeDirectorSignal {
  status?: SessionIndicatorStatus
  running?: boolean
  thinkingText?: string
  responseText?: string
  activeToolName?: string
  unfinishedTaskCount?: number
  activeWorkerCount?: number
}

export interface OfficeDirectorActivity {
  state: OfficeAgentState
  semanticState: OfficeSemanticState
  label: string
  viewFacing: OfficeAgent['viewFacing']
}

const REVIEW_SIGNALS = ['test', 'review', 'verify', 'check', '测试', '验收', '审核', '验证', '检查']
const SUMMON_SIGNALS = ['kanban', 'board', 'worker', '看板', '派工', '任务分配']

function isReviewTool(toolName: string | undefined): boolean {
  if (!toolName) return false
  const normalized = toolName.toLowerCase()
  return REVIEW_SIGNALS.some((signal) => normalized.includes(signal))
}

function isSummonTool(toolName: string | undefined): boolean {
  if (!toolName) return false
  const normalized = toolName.toLowerCase()
  return SUMMON_SIGNALS.some((signal) => normalized.includes(signal))
}

/** Maps the real main-session runtime into a restrained director activity. */
export function resolveOfficeDirectorActivity(
  signal: OfficeDirectorSignal
): OfficeDirectorActivity {
  if (signal.status === 'blocked') {
    return {
      state: 'blocked',
      semanticState: 'blocked',
      label: '等待你的确认',
      viewFacing: 'front',
    }
  }

  if (signal.running || signal.status === 'running') {
    if (isSummonTool(signal.activeToolName)) {
      return {
        state: 'talking',
        semanticState: 'summoning',
        label: '正在召集并分配团队',
        viewFacing: 'front',
      }
    }
    if (isReviewTool(signal.activeToolName)) {
      return {
        state: 'reviewing',
        semanticState: 'supervising',
        label: '正在验收结果',
        viewFacing: 'back',
      }
    }
    if (signal.responseText?.trim()) {
      return {
        state: 'talking',
        semanticState: 'reporting',
        label: '正在向你汇报',
        viewFacing: 'front',
      }
    }
    if (signal.thinkingText?.trim()) {
      return {
        state: 'thinking',
        semanticState: 'thinking',
        label: '正在分析和拆解',
        viewFacing: 'back',
      }
    }
    if (signal.activeToolName) {
      return {
        state: 'working',
        semanticState: 'planning',
        label: `正在处理 · ${signal.activeToolName}`,
        viewFacing: 'back',
      }
    }
    return {
      state: 'thinking',
      semanticState: 'listening',
      label: '正在理解你的需求',
      viewFacing: 'back',
    }
  }

  if ((signal.activeWorkerCount ?? 0) > 0) {
    return {
      state: 'waiting',
      semanticState: 'supervising',
      label: `正在巡视 ${signal.activeWorkerCount} 名员工的进度`,
      viewFacing: 'front',
    }
  }

  if ((signal.unfinishedTaskCount ?? 0) > 0) {
    return {
      state: 'waiting',
      semanticState: 'summoning',
      label: '任务已拆分，等待员工到岗',
      viewFacing: 'front',
    }
  }

  if (signal.status === 'completed') {
    return {
      state: 'waiting',
      semanticState: 'ambient',
      label: '结果已整理，等待下一步',
      viewFacing: 'front',
    }
  }

  return {
    state: 'waiting',
    semanticState: 'ambient',
    label: '等待你的指示',
    viewFacing: 'front',
  }
}

export function projectOfficeDirector(
  sessionId: string,
  signal: OfficeDirectorSignal
): OfficeAgent {
  const desk = DESKS[0]!
  const activity = resolveOfficeDirectorActivity(signal)
  const actor: OfficeActor = {
    actorId: `director:${sessionId}`,
    kind: 'director',
    sessionId,
    roleId: 'director',
    appearanceKey: `director:${sessionId}`,
    displayName: '主 Agent · 总监',
  }

  return {
    kind: 'director',
    actor,
    semanticState: activity.semanticState,
    id: actor.actorId,
    roleId: 'director',
    appearanceKey: actor.appearanceKey,
    name: actor.displayName,
    color: 0x0d9488,
    x: desk.seatX,
    y: desk.seatY,
    state: activity.state,
    currentTask: activity.label,
    assignedDeskId: desk.id,
    facing: 1,
    viewFacing: activity.viewFacing,
  }
}
