/**
 * CapabilityToolbar - 插件区主区工具栏
 *
 * 集中承载插件管理入口：目录、AI 配置。
 */

import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { FolderOpen, MessageSquare } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { PluginConfigDialog } from './plugin-config-dialog'
import { PluginToolbarButton } from './plugin-toolbar-button'

import { resolveAgentSessionModelId, type WorkspaceCapabilities } from '@tagent/shared'

import {
  agentChannelIdAtom,
  agentModelIdAtom,
  agentPendingPromptAtom,
  agentSessionChannelMapAtom,
  agentSessionModelMapAtom,
  currentAgentWorkspaceIdAtom,
} from '@/atoms/agent-atoms'
import { activeRailItemAtom } from '@/atoms/app-mode'
import { channelsAtom } from '@/atoms/model-atoms'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCreateSession } from '@/hooks/useCreateSession'
import { detectIsWindows } from '@/lib/platform'
import { cn } from '@/lib/utils'

interface CapabilityToolbarProps {
  capabilities: WorkspaceCapabilities | null
  workspaceSlug: string
  workspaceName: string
}

export function CapabilityToolbar({
  capabilities,
  workspaceSlug,
  workspaceName,
}: CapabilityToolbarProps): React.ReactElement {
  const setActiveRailItem = useSetAtom(activeRailItemAtom)
  const setPendingPrompt = useSetAtom(agentPendingPromptAtom)
  const store = useStore()
  const agentChannelId = useAtomValue(agentChannelIdAtom)
  const legacyGlobalModelId = useAtomValue(agentModelIdAtom)
  const channels = useAtomValue(channelsAtom)
  const agentModelId = React.useMemo(() => {
    if (!agentChannelId) return undefined
    const channel = channels.find((c) => c.id === agentChannelId && c.enabled)
    return resolveAgentSessionModelId(channel, undefined, legacyGlobalModelId)
  }, [agentChannelId, channels, legacyGlobalModelId])
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const { createAgent } = useCreateSession()

  const [skillsDir, setSkillsDir] = React.useState('')
  const [configDialogOpen, setConfigDialogOpen] = React.useState(false)
  const [configSubmitting, setConfigSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!workspaceSlug) return
    window.electronAPI
      .getWorkspaceSkillsDir(workspaceSlug)
      .then(setSkillsDir)
      .catch(() => setSkillsDir(''))
  }, [workspaceSlug])

  const handleOpenConfigDialog = (): void => {
    if (!agentChannelId) {
      toast.error('请先在 AI 渠道设置中选择 Agent 供应商')
      return
    }
    setConfigDialogOpen(true)
  }

  const handleConfigSubmit = async (message: string): Promise<void> => {
    if (!agentChannelId) {
      toast.error('请先在 AI 渠道设置中选择 Agent 供应商')
      return
    }
    if (!agentModelId) {
      toast.error('请先在设置中选择 Agent 模型')
      return
    }

    setConfigSubmitting(true)
    try {
      const session = await createAgent({ channelId: agentChannelId })
      if (!session) {
        toast.error('创建配置会话失败')
        return
      }

      // 预先写入 per-session 渠道 / 模型，避免 pendingPrompt 抢跑时上下文不完整
      store.set(agentSessionChannelMapAtom, (prev) => {
        const map = new Map(prev)
        map.set(session.id, agentChannelId)
        return map
      })
      store.set(agentSessionModelMapAtom, (prev) => {
        const map = new Map(prev)
        map.set(session.id, agentModelId)
        return map
      })

      setActiveRailItem('sessions')
      setConfigDialogOpen(false)

      // 等主区切到 AgentView 后再挂 pending，降低挂载竞态
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
      setPendingPrompt({
        sessionId: session.id,
        message,
        channelId: agentChannelId,
        modelId: agentModelId,
        workspaceId: currentWorkspaceId ?? session.workspaceId ?? undefined,
      })
    } catch (error) {
      console.error('[CapabilityToolbar] 创建配置会话失败:', error)
      toast.error('创建配置会话失败')
    } finally {
      setConfigSubmitting(false)
    }
  }

  const handleOpenSkillsDir = (): void => {
    if (skillsDir) {
      window.electronAPI.openFile(skillsDir)
    }
  }

  const isWindows = React.useMemo(() => detectIsWindows(), [])

  return (
    <>
      <div
        className={cn(
          'relative flex flex-wrap items-center gap-2 border-b border-border/40 bg-muted/15 px-5 py-2.5',
          isWindows && 'pr-[134px]'
        )}
      >
        <div
          className={cn(
            'absolute inset-0 z-[10] titlebar-drag-region pointer-events-none',
            isWindows && 'right-[126px]'
          )}
          aria-hidden
        />
        {skillsDir ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <PluginToolbarButton
                  variant="outline"
                  icon={<FolderOpen size={15} strokeWidth={1.75} />}
                  onClick={handleOpenSkillsDir}
                >
                  打开目录
                </PluginToolbarButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>在文件管理器中打开插件目录</TooltipContent>
          </Tooltip>
        ) : null}

        {skillsDir ? <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" aria-hidden /> : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <PluginToolbarButton
                variant="subtle"
                icon={<MessageSquare size={15} strokeWidth={1.75} />}
                onClick={handleOpenConfigDialog}
              >
                AI 配置
              </PluginToolbarButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            填写需求后发送，Agent 会帮你写入当前工作区
          </TooltipContent>
        </Tooltip>
      </div>

      <PluginConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        workspaceName={workspaceName}
        workspaceSlug={workspaceSlug}
        capabilities={capabilities}
        submitting={configSubmitting}
        onSubmit={handleConfigSubmit}
      />
    </>
  )
}
