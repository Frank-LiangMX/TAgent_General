/**
 * CapabilityToolbar - 插件区主区工具栏
 *
 * 集中承载插件管理入口：添加、推荐、导入、目录、AI 配置。
 * 按钮样式参考 Kun PluginMarketplace 胶囊按钮。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { Download, FolderOpen, MessageSquare, Plus, Settings, Sparkles } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ImportSkillDialog } from './ImportSkillDialog'
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
import {
  BuiltinMcpRecommendations,
  type BuiltinMcpInfo,
} from '@/components/settings/BuiltinMcpRecommendations'
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
  const [recommendationsOpen, setRecommendationsOpen] = React.useState(false)
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)

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

  const handleAddPlugin = (): void => {
    setEditingServer(null)
    setMcpFormOpen(true)
  }

  const handleInstallBuiltinMcp = (mcp: BuiltinMcpInfo): void => {
    const entry: McpServerEntry = {
      type: 'stdio',
      command: mcp.installCommand,
      args: mcp.installArgs,
      enabled: false,
    }
    setEditingServer({ name: mcp.name, entry })
    setMcpFormOpen(true)
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

  const handleImportPlugin = async (sourceSlug: string, skillSlug: string): Promise<void> => {
    try {
      await window.electronAPI.importSkillFromWorkspace(workspaceSlug, sourceSlug, skillSlug)
      bumpCapabilitiesVersion((v) => v + 1)
      setImportDialogOpen(false)
      toast.success('已导入插件')
    } catch (error) {
      console.error('[CapabilityToolbar] 导入插件失败:', error)
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('导入插件失败', { description: message })
    }
  }

  const installedMcpNames = capabilities?.mcpServers.map((s) => s.name) ?? []
  const isWindows = React.useMemo(() => detectIsWindows(), [])

  return (
    <>
      <div
        className={cn(
          'relative flex flex-wrap items-center gap-2 border-b border-border/40 bg-muted/15 px-5 py-2.5 titlebar-no-drag',
          isWindows && 'pr-[134px]'
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-0 titlebar-drag-region',
            isWindows && 'right-[126px]'
          )}
          aria-hidden
        />
        <div className="relative z-[1] flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <PluginToolbarButton variant="primary" icon={<Plus size={15} strokeWidth={2} />} onClick={handleAddPlugin}>
              添加插件
            </PluginToolbarButton>
          </TooltipTrigger>
          <TooltipContent>添加 MCP 连接插件</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <PluginToolbarButton
              variant="subtle"
              icon={<Sparkles size={15} strokeWidth={1.75} />}
              onClick={() => setRecommendationsOpen(true)}
            >
              推荐插件
            </PluginToolbarButton>
          </TooltipTrigger>
          <TooltipContent>查看推荐的一键安装插件</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <PluginToolbarButton
              variant="outline"
              icon={<Download size={15} strokeWidth={1.9} />}
              onClick={() => setImportDialogOpen(true)}
            >
              导入插件
            </PluginToolbarButton>
          </TooltipTrigger>
          <TooltipContent>从其他工作区导入 Skill 指令插件</TooltipContent>
        </Tooltip>

        {skillsDir ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <PluginToolbarButton
                variant="outline"
                icon={<FolderOpen size={15} strokeWidth={1.75} />}
                onClick={handleOpenSkillsDir}
              >
                打开目录
              </PluginToolbarButton>
            </TooltipTrigger>
            <TooltipContent>在文件管理器中打开插件目录</TooltipContent>
          </Tooltip>
        ) : null}

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" aria-hidden />

        <Tooltip>
          <TooltipTrigger asChild>
            <PluginToolbarButton
              variant="subtle"
              icon={<MessageSquare size={15} strokeWidth={1.75} />}
              onClick={() => void handleConfigPluginsViaChat()}
            >
              AI 配置
            </PluginToolbarButton>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            让 TAgent Agent 联网查找并配置插件到当前工作区
          </TooltipContent>
        </Tooltip>
        </div>
      </div>

      <Dialog open={mcpFormOpen} onOpenChange={setMcpFormOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle>
              {editingServer ? `编辑插件：${editingServer.name}` : '添加插件'}
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

      <Dialog open={recommendationsOpen} onOpenChange={setRecommendationsOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <Settings size={16} className="text-muted-foreground" />
              推荐插件
            </DialogTitle>
            <DialogDescription>常用 MCP 连接插件，点击安装后会预填配置表单</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-6 pb-6">
            <BuiltinMcpRecommendations
              installedMcps={installedMcpNames}
              workspaceSlug={workspaceSlug}
              onInstall={(mcp) => {
                setRecommendationsOpen(false)
                handleInstallBuiltinMcp(mcp)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ImportSkillDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        workspaceSlug={workspaceSlug}
        currentSkills={capabilities?.skills ?? []}
        importingSkill={null}
        onImport={handleImportPlugin}
      />
    </>
  )
}
