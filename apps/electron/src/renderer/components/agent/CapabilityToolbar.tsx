/**
 * CapabilityToolbar — 插件主区操作簇
 *
 * 只输出圆形工具钮，不自带底板/分割线；由主区标题行嵌入。
 */

import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { ArrowLeft, FolderOpen, MessageSquare } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { resolveAgentSessionModelId, type WorkspaceCapabilities } from '@tagent/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { PluginConfigDialog } from './plugin-config-dialog'

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
import { useCreateSession } from '@/hooks/useCreateSession'
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
      const session = await createAgent({ channelId: agentChannelId, modelId: agentModelId })
      if (!session) {
        toast.error('创建配置会话失败')
        return
      }

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

  return (
    <>
      <div className="flex shrink-0 items-center gap-0.5 titlebar-no-drag">
        {skillsDir ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleOpenSkillsDir}
                className="inline-flex size-9 items-center justify-center rounded-full text-foreground/60 hover:text-foreground"
                aria-label="打开目录"
              >
                <FolderOpen className="size-4" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>在文件管理器中打开插件目录</TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleOpenConfigDialog}
              className="inline-flex size-9 items-center justify-center rounded-full text-foreground/60 hover:text-foreground"
              aria-label="AI 配置"
            >
              <MessageSquare className="size-4" strokeWidth={1.75} />
            </button>
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

/** 详情页「返回」——与记忆页一致的轻按钮 */
export function PluginBackButton({
  onClick,
  label = '返回',
}: {
  onClick: () => void
  label?: string
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1 inline-flex h-6 items-center gap-1 rounded-glass-popover px-2 text-[10px] font-medium tracking-[0.02em]',
        'bg-foreground/[0.045] text-foreground/55 transition-colors hover:bg-foreground/[0.07] hover:text-foreground/80'
      )}
    >
      <ArrowLeft className="size-3" strokeWidth={1.75} />
      {label}
    </button>
  )
}
