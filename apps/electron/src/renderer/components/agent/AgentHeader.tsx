/**
 * AgentHeader — Agent 会话头部（状态条）
 *
 * 历史：曾显示模型 / 权限 / 运行态 / 班组进度。
 * 2026-07：classic 主路径已停用——模型、权限落在 Composer / Underlay，
 * 班组进度落在 RightPanelRail。组件保留供紧急回滚或特殊 surface 复用。
 */

import { TAGENT_PERMISSION_MODE_CONFIG } from '@tagent/shared'
import { useAtomValue } from 'jotai'
import { Cpu, ShieldCheck } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { getToolDisplayName } from './tool-utils'

import type { SessionIndicatorStatus, ToolActivity } from '@/atoms/agent-atoms'

import {
  agentDefaultPermissionModeAtom,
  agentPermissionModeMapAtom,
  agentSessionIndicatorMapAtom,
  agentSessionsAtom,
  agentSessionStreamingStateAtomFamily,
  sessionPersistedPermissionModeAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import { useAgentSessionChannelModel } from '@/hooks/useAgentSessionChannelModel'
import { resolveModelDisplayName } from '@/lib/model-logo'
import { useWorkspaceHeaderSlot } from '@/components/tabs/workspace-header-slot'

/** AgentHeader 属性接口 */
interface AgentHeaderProps {
  sessionId: string
  /** 右侧插槽（渲染在状态 chip 行最右，避让 WindowControls） */
  rightSlot?: React.ReactNode
}

function SessionStatusItem({
  label,
  kind,
  icon,
  tone,
}: {
  label: string
  kind: 'model' | 'permission' | 'activity'
  icon?: React.ReactNode
  tone?: 'neutral' | 'running' | 'blocked' | 'completed'
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`agent-session-status__segment agent-session-status__${kind}`}
          data-tone={tone}
          aria-label={label}
          aria-live={kind === 'activity' ? 'polite' : undefined}
        >
          {kind === 'activity' && <span className="agent-session-status__dot" aria-hidden />}
          {icon}
          <span className="agent-session-status__label">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function getLatestRunningTool(toolActivities: ToolActivity[] | undefined): ToolActivity | null {
  if (!toolActivities) return null
  for (let index = toolActivities.length - 1; index >= 0; index -= 1) {
    const activity = toolActivities[index]
    if (activity && !activity.done) return activity
  }
  return null
}

function getStatusLabel(status: SessionIndicatorStatus, runningTool: ToolActivity | null): string {
  if (status === 'blocked') return '等待处理'
  if (status === 'completed') return '已完成'
  if (status === 'running') {
    return runningTool
      ? `运行中 · ${runningTool.displayName || getToolDisplayName(runningTool.toolName)}`
      : '运行中'
  }
  return '空闲'
}

function getStatusTone(
  status: SessionIndicatorStatus
): 'neutral' | 'running' | 'blocked' | 'completed' {
  if (status === 'blocked') return 'blocked'
  if (status === 'completed') return 'completed'
  if (status === 'running') return 'running'
  return 'neutral'
}

export const AgentHeader = React.memo(function AgentHeader({
  sessionId,
  rightSlot,
}: AgentHeaderProps): React.ReactElement | null {
  const sessions = useAtomValue(agentSessionsAtom)
  const session = sessions.find((s) => s.id === sessionId) ?? null
  const streamState = useAtomValue(agentSessionStreamingStateAtomFamily(sessionId))
  const sessionIndicatorMap = useAtomValue(agentSessionIndicatorMapAtom)
  const { modelId } = useAgentSessionChannelModel(sessionId)
  const channels = useAtomValue(channelsAtom)
  const permissionModeMap = useAtomValue(agentPermissionModeMapAtom)
  const persistedPermissionMode = useAtomValue(sessionPersistedPermissionModeAtom(sessionId))
  const defaultPermissionMode = useAtomValue(agentDefaultPermissionModeAtom)
  const workspaceHeaderSlot = useWorkspaceHeaderSlot()

  if (!session) return null

  const modelLabel = modelId ? resolveModelDisplayName(modelId, channels) : '未选择模型'
  const permissionMode =
    permissionModeMap.get(sessionId) ?? persistedPermissionMode ?? defaultPermissionMode
  const permissionLabel = TAGENT_PERMISSION_MODE_CONFIG[permissionMode].label
  const status = sessionIndicatorMap.get(sessionId) ?? 'idle'
  const runningTool = getLatestRunningTool(streamState?.toolActivities)
  const statusLabel = getStatusLabel(status, runningTool)
  const statusTone = getStatusTone(status)

  const header = (
    <div className="agent-session-header">
      <div className="agent-session-status" role="group" aria-label="当前会话状态">
        <SessionStatusItem
          kind="model"
          label={modelLabel}
          icon={<Cpu className="agent-session-status__icon" aria-hidden />}
        />
        <SessionStatusItem
          kind="permission"
          label={permissionLabel}
          icon={<ShieldCheck className="agent-session-status__icon" aria-hidden />}
        />
        <SessionStatusItem kind="activity" label={statusLabel} tone={statusTone} />
        {rightSlot && <div className="agent-session-status__actions">{rightSlot}</div>}
      </div>
    </div>
  )

  return workspaceHeaderSlot ? createPortal(header, workspaceHeaderSlot) : header
})
