/**
 * CapabilityToolbar - 插件区主区工具栏
 *
 * 集中承载插件管理入口：商店、目录、AI 配置。
 * 按钮样式参考 Kun PluginMarketplace 胶囊按钮。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { FolderOpen, MessageSquare, Sparkles } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { PluginToolbarButton } from './plugin-toolbar-button'

import type { McpServerEntry, WorkspaceCapabilities } from '@tagent/shared'

import {
  agentChannelIdAtom,
  currentAgentWorkspaceIdAtom,
  agentSessionsAtom,
  currentAgentSessionIdAtom,
  agentPendingPromptAtom,
  workspaceCapabilitiesVersionAtom,
} from '@/atoms/agent-atoms'
import { appModeAtom } from '@/atoms/app-mode'
import { PluginStorePanel, mcpCatalogEntryToServerEntry } from '@/components/settings/PluginStorePanel'
import type { BuiltinMcpCatalogEntry } from '@tagent/shared'
import { McpServerForm } from '@/components/settings/McpServerForm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  const setAppMode = useSetAtom(appModeAtom)
  const agentChannelId = useAtomValue(agentChannelIdAtom)
  const setAgentSessions = useSetAtom(agentSessionsAtom)
  const setCurrentSessionId = useSetAtom(currentAgentSessionIdAtom)
  const setPendingPrompt = useSetAtom(agentPendingPromptAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const bumpCapabilitiesVersion = useSetAtom(workspaceCapabilitiesVersionAtom)

  const [mcpFormOpen, setMcpFormOpen] = React.useState(false)
  const [editingServer, setEditingServer] = React.useState<{
    name: string
    entry: McpServerEntry
  } | null>(null)
  const [storeOpen, setStoreOpen] = React.useState(false)

  const [skillsDir, setSkillsDir] = React.useState('')
  React.useEffect(() => {
    if (!workspaceSlug) return
    window.electronAPI
      .getWorkspaceSkillsDir(workspaceSlug)
      .then(setSkillsDir)
      .catch(() => setSkillsDir(''))
  }, [workspaceSlug])

  const handleConfigPluginsViaChat = async (): Promise<void> => {
    if (!agentChannelId) {
      toast.error('请先在 AI 渠道设置中选择 Agent 供应商')
      return
    }
    const dataRoot = import.meta.env.DEV ? '.tagent-dev' : '.tagent'
    const skillsDirPath = `~/${dataRoot}/agent-workspaces/${workspaceSlug}/skills/`
    const mcpConfigPath = `~/${dataRoot}/agent-workspaces/${workspaceSlug}/mcp.json`
    const pluginList =
      capabilities && (capabilities.skills.length > 0 || capabilities.mcpServers.length > 0)
        ? [
            ...capabilities.mcpServers.map((s) => `- [连接] ${s.name} (${s.type})`),
            ...capabilities.skills.map((s) => `- [指令] ${s.name}: ${s.description ?? '无描述'}`),
          ].join('\n')
        : '暂无插件'
    const prompt = `请帮我配置当前工作区的插件（MCP 连接与 Skill 指令），你要主动来帮我实现，你可以采用联网搜索深度研究来尝试，当前环境已经有 Claude Agent SDK 了，除非不确定的时候才来问我，否则默认将帮我完成安装，而不是指导我。

## 工作区信息
- 工作区: ${workspaceName}
- MCP 配置: ${mcpConfigPath}
- Skills 目录: ${skillsDirPath}

## 当前插件
${pluginList}

请读取 mcp.json 与 skills/ 目录，根据我的需求添加或修改插件配置。`

    try {
      const session = await window.electronAPI.createAgentSession(
        undefined,
        agentChannelId,
        currentWorkspaceId ?? undefined
      )
      const sessions = await window.electronAPI.listAgentSessions()
      setAgentSessions(sessions)
      setCurrentSessionId(session.id)
      setPendingPrompt({ sessionId: session.id, message: prompt })
      setAppMode('agent')
    } catch (error) {
      console.error('[CapabilityToolbar] 创建配置会话失败:', error)
      toast.error('创建配置会话失败')
    }
  }

  const handleAddCustomMcp = (): void => {
    setEditingServer(null)
    setMcpFormOpen(true)
    setStoreOpen(false)
  }

  const handleInstallStoreMcp = (mcp: BuiltinMcpCatalogEntry): void => {
    const entry = mcpCatalogEntryToServerEntry(mcp)
    setEditingServer({ name: mcp.name, entry })
    setMcpFormOpen(true)
    setStoreOpen(false)
  }

  const handleStoreSkillInstalled = (): void => {
    bumpCapabilitiesVersion((v) => v + 1)
    toast.success('Skill 已安装')
  }

  const handleMcpFormSaved = async (): Promise<void> => {
    setMcpFormOpen(false)
    setEditingServer(null)
    bumpCapabilitiesVersion((v) => v + 1)
    toast.success('插件已保存')
  }

  const handleOpenSkillsDir = (): void => {
    if (skillsDir) {
      window.electronAPI.openFile(skillsDir)
    }
  }

  const installedMcpNames = capabilities?.mcpServers.map((s) => s.name) ?? []
  const installedSkillSlugs = capabilities?.skills.map((s) => s.slug) ?? []
  const isWindows = React.useMemo(() => detectIsWindows(), [])

  return (
    <>
      <div
        className={cn(
          'relative flex flex-wrap items-center gap-2 border-b border-border/40 bg-muted/15 px-5 py-2.5',
          isWindows && 'pr-[134px]'
        )}
      >
        {/* 与 TabBar 一致：背景拖拽层铺满空白区；交互按钮各自 titlebar-no-drag 穿透 OS hitmask */}
        <div
          className={cn('absolute inset-0 z-[10] titlebar-drag-region', isWindows && 'right-[126px]')}
          aria-hidden
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <PluginToolbarButton
                variant="primary"
                icon={<Sparkles size={15} strokeWidth={1.75} />}
                onClick={() => setStoreOpen(true)}
              >
                插件商店
              </PluginToolbarButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>浏览并安装 Skill 与 MCP</TooltipContent>
        </Tooltip>

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

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" aria-hidden />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <PluginToolbarButton
                variant="subtle"
                icon={<MessageSquare size={15} strokeWidth={1.75} />}
                onClick={() => void handleConfigPluginsViaChat()}
              >
                AI 配置
              </PluginToolbarButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            让 TAgent Agent 联网查找并配置插件到当前工作区
          </TooltipContent>
        </Tooltip>
      </div>

      <Dialog open={mcpFormOpen} onOpenChange={setMcpFormOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle>
              {editingServer ? `编辑 MCP：${editingServer.name}` : '自定义 MCP'}
            </DialogTitle>
            <DialogDescription>MCP 连接插件，支持 stdio、HTTP、SSE 三种传输方式</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-6 pb-6">
            <McpServerForm
              server={editingServer}
              workspaceSlug={workspaceSlug}
              onSaved={handleMcpFormSaved}
              onCancel={() => setMcpFormOpen(false)}
              hideTitleBar
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={storeOpen} onOpenChange={setStoreOpen}>
        <DialogContent className="flex h-[min(85vh,700px)] w-[min(780px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-5 pb-3 pt-5">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles size={16} className="text-muted-foreground" />
              插件商店
            </DialogTitle>
            <DialogDescription className="text-xs">
              按需安装 Skill 与 MCP，不再默认批量预装
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5">
            <PluginStorePanel
              workspaceSlug={workspaceSlug}
              installedSkillSlugs={installedSkillSlugs}
              installedMcpNames={installedMcpNames}
              onInstallMcp={handleInstallStoreMcp}
              onSkillInstalled={handleStoreSkillInstalled}
              onAddCustomMcp={handleAddCustomMcp}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
