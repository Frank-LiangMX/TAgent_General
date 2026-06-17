/**
 * AgentHeader — Agent 会话头部
 *
 * 显示当前会话的轻量状态栏。
 */

import { TAGENT_PERMISSION_MODE_CONFIG } from '@tagent/shared'
import { useAtom, useAtomValue } from 'jotai'
import { PanelRight } from 'lucide-react'
import * as React from 'react'

import { getToolDisplayName } from './tool-utils'

import type { SessionIndicatorStatus, ToolActivity } from '@/atoms/agent-atoms'

import {
  agentDefaultPermissionModeAtom,
  agentModelIdAtom,
  agentPermissionModeMapAtom,
  agentSessionIndicatorMapAtom,
  agentSessionModelMapAtom,
  agentSessionsAtom,
  agentSessionStreamingStateAtomFamily,
  agentSidePanelOpenAtom,
  sessionPersistedPermissionModeAtom,
  workspaceFilesVersionAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { resolveModelDisplayName } from '@/lib/model-logo'
import { registerShortcut } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

/** AgentHeader 属性接口 */
interface AgentHeaderProps {
  sessionId: string
}

function HeaderStatusChip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'running' | 'blocked' | 'completed'
}): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex h-5 max-w-[240px] items-center rounded-md border px-1.5 text-[11px] leading-none truncate',
        tone === 'neutral' && 'border-border/60 bg-muted/30 text-foreground/50',
        tone === 'running' &&
          'border-blue-500/20 bg-blue-500/[0.08] text-blue-600 dark:text-blue-300',
        tone === 'blocked' &&
          'border-orange-500/25 bg-orange-500/[0.09] text-orange-600 dark:text-orange-300',
        tone === 'completed' &&
          'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300'
      )}
      title={typeof children === 'string' ? children : undefined}
    >
      {children}
    </span>
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

export function AgentHeader({ sessionId }: AgentHeaderProps): React.ReactElement | null {
  const sessions = useAtomValue(agentSessionsAtom)
  const session = sessions.find((s) => s.id === sessionId) ?? null
  const streamState = useAtomValue(agentSessionStreamingStateAtomFamily(sessionId))
  const sessionIndicatorMap = useAtomValue(agentSessionIndicatorMapAtom)
  const sessionModelMap = useAtomValue(agentSessionModelMapAtom)
  const defaultModelId = useAtomValue(agentModelIdAtom)
  const channels = useAtomValue(channelsAtom)
  const permissionModeMap = useAtomValue(agentPermissionModeMapAtom)
  const persistedPermissionMode = useAtomValue(sessionPersistedPermissionModeAtom(sessionId))
  const defaultPermissionMode = useAtomValue(agentDefaultPermissionModeAtom)

  // 文件面板切换状态（全局共享）
  const [isPanelOpen, setSidePanelOpen] = useAtom(agentSidePanelOpenAtom)
  const filesVersion = useAtomValue(workspaceFilesVersionAtom)
  const hasFileChanges = filesVersion > 0

  const togglePanel = React.useCallback(() => {
    setSidePanelOpen((v) => !v)
  }, [setSidePanelOpen])

  React.useEffect(() => {
    return registerShortcut('toggle-right-panel', togglePanel)
  }, [togglePanel])

  if (!session) return null

  const modelId = sessionModelMap.get(sessionId) ?? defaultModelId
  const modelLabel = modelId ? resolveModelDisplayName(modelId, channels) : '未选择模型'
  const permissionMode =
    permissionModeMap.get(sessionId) ?? persistedPermissionMode ?? defaultPermissionMode
  const permissionLabel = TAGENT_PERMISSION_MODE_CONFIG[permissionMode].label
  const status = sessionIndicatorMap.get(sessionId) ?? 'idle'
  const runningTool = getLatestRunningTool(streamState?.toolActivities)
  const statusLabel = getStatusLabel(status, runningTool)
  const statusTone = getStatusTone(status)

  return (
    <div className="relative z-[51] flex h-[36px] items-center gap-2 px-4">
      {/* 拖拽层仅覆盖左侧区域，避开右上角 WindowControls（Windows 上 ~126px）。
          否则 header 的 drag-region 会与按钮重叠，导致 OS hitmask 把单击当成标题栏点击。 */}
      <div className="absolute inset-0 right-[126px] titlebar-drag-region pointer-events-none" />
      <div className="flex flex-1 min-w-0 items-center">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <HeaderStatusChip>{modelLabel}</HeaderStatusChip>
          <HeaderStatusChip>{permissionLabel}</HeaderStatusChip>
          <HeaderStatusChip tone={statusTone}>{statusLabel}</HeaderStatusChip>
        </div>
      </div>

      {/* 文件面板打开按钮（面板关闭时显示） */}
      {!isPanelOpen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative titlebar-no-drag h-7 w-7 flex-shrink-0"
              onClick={togglePanel}
            >
              <PanelRight className="size-3.5" />
              {hasFileChanges && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary animate-pulse" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>打开文件面板 ({navigator.platform.includes('Mac') ? '⌘⇧B' : 'Ctrl+Shift+B'})</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
