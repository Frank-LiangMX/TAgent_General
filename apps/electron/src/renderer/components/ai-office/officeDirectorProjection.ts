import { DESKS } from './scene/layout/officeLayout'
import type { OfficeAgent, OfficeAgentState } from './types/office-agent'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'

export interface OfficeDirectorSignal {
  status?: SessionIndicatorStatus
  running?: boolean
  thinkingText?: string
  responseText?: string
  activeToolName?: string
}

export interface OfficeDirectorActivity {
  state: OfficeAgentState
  label: string
  viewFacing: OfficeAgent['viewFacing']
}

const REVIEW_SIGNALS = ['test', 'review', 'verify', 'check', '测试', '验收', '审核', '验证', '检查']

function isReviewTool(toolName: string | undefined): boolean {
  if (!toolName) return false
  const normalized = toolName.toLowerCase()
  return REVIEW_SIGNALS.some((signal) => normalized.includes(signal))
}

/** Maps the real main-session runtime into a restrained director activity. */
export function resolveOfficeDirectorActivity(
  signal: OfficeDirectorSignal
): OfficeDirectorActivity {
  if (signal.status === 'blocked') {
    return { state: 'blocked', label: '等待你的确认', viewFacing: 'front' }
  }

  if (signal.running || signal.status === 'running') {
    if (isReviewTool(signal.activeToolName)) {
      return { state: 'reviewing', label: '正在验收结果', viewFacing: 'back' }
    }
    if (signal.responseText?.trim()) {
      return { state: 'talking', label: '正在向你汇报', viewFacing: 'front' }
    }
    if (signal.thinkingText?.trim()) {
      return { state: 'thinking', label: '正在分析和拆解', viewFacing: 'back' }
    }
    if (signal.activeToolName) {
      return {
        state: 'working',
        label: `正在处理 · ${signal.activeToolName}`,
        viewFacing: 'back',
      }
    }
    return { state: 'thinking', label: '正在理解你的需求', viewFacing: 'back' }
  }

  if (signal.status === 'completed') {
    return { state: 'waiting', label: '结果已整理，等待下一步', viewFacing: 'front' }
  }

  return { state: 'waiting', label: '等待你的指示', viewFacing: 'front' }
}

export function projectOfficeDirector(
  sessionId: string,
  signal: OfficeDirectorSignal
): OfficeAgent {
  const desk = DESKS[0]!
  const activity = resolveOfficeDirectorActivity(signal)

  return {
    kind: 'director',
    id: `director:${sessionId}`,
    roleId: 'director',
    appearanceKey: `director:${sessionId}`,
    name: '主 Agent · 总监',
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
