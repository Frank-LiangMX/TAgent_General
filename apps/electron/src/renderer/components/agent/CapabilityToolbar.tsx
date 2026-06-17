/**
 * CapabilityToolbar - 主页 Skills 区域工具栏
 *
 * 集中承载从 AgentSettings 迁移来的功能入口：
 * - 添加 MCP 服务器
 * - 推荐 MCP 一键安装
 * - 从其他工作区导入 Skill
 * - 打开 Skills 目录
 * - AI 配置（创建 Agent 会话引导配置）
 *
 * 此组件保持 SkillsPanel 侧栏界面不变，仅在主区顶部提供这些操作。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { Plus, Sparkles, FolderOpen, MessageSquare, Download } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ImportSkillDialog } from './ImportSkillDialog'

import type { McpServerEntry, SkillMeta, WorkspaceCapabilities } from '@tagent/shared'

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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface CapabilityToolbarProps {
  /** 当前工作区的 capabilities */
  capabilities: WorkspaceCapabilities | null
  /** 工作区 slug */
  workspaceSlug: string
  /** 工作区名称 */
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

  // MCP 表单状态
  const [mcpFormOpen, setMcpFormOpen] = React.useState(false)
  const [editingServer, setEditingServer] = React.useState<{
    name: string
    entry: McpServerEntry
  } | null>(null)

  // 推荐 MCP 面板状态
  const [recommendationsOpen, setRecommendationsOpen] = React.useState(false)

  // 导入 Skill 状态
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)

  // Skills 目录（通过 IPC 单独获取）
  const [skillsDir, setSkillsDir] = React.useState('')
  React.useEffect(() => {
    if (!workspaceSlug) return
    window.electronAPI
      .getWorkspaceSkillsDir(workspaceSlug)
      .then(setSkillsDir)
      .catch(() => setSkillsDir(''))
  }, [workspaceSlug])

  /** 通过 AI 配置 Skills（创建 Agent 会话引导） */
  const handleConfigSkillsViaChat = async (): Promise<void> => {
    if (!agentChannelId) {
      toast.error('请先在 AI 渠道设置中选择 Agent 供应商')
      return
    }
    const skillsDirPath = `~/${import.meta.env.DEV ? '.tagent-dev' : '.tagent'}/agent-workspaces/${workspaceSlug}/skills/`
    const skillList =
      capabilities && capabilities.skills.length > 0
        ? capabilities.skills.map((s) => `- ${s.name}: ${s.description ?? '无描述'}`).join('\n')
        : '暂无 Skill'
    const prompt = `请帮我配置当前工作区的 Skills，你要主动来帮我实现，你可以采用联网搜索深度研究来尝试，当前环境已经有 Claude Agent SDK 了，除非不确定的时候才来问我，否则默认将帮我完成安装，而不是指导我。

## 工作区信息
- 工作区: ${workspaceName}
- Skills 目录: ${skillsDirPath}

## Skill 格式
每个 Skill 是 skills/ 目录下的一个子目录，目录名即 slug。
目录内包含 SKILL.md 文件，格式：

\`\`\`markdown
---
name: Skill 显示名称
description: 简要描述
---

Skill 的详细指令内容...
\`\`\`

## 当前 Skills
${skillList}

请查看 skills/ 目录了解现有配置，根据我的需求创建或编辑 Skill。`

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

  /** 通过 AI 配置 MCP（创建 Agent 会话引导） */
  const handleConfigMcpViaChat = async (): Promise<void> => {
    if (!agentChannelId) {
      toast.error('请先在 AI 渠道设置中选择 Agent 供应商')
      return
    }
    const configPath = `~/${import.meta.env.DEV ? '.tagent-dev' : '.tagent'}/agent-workspaces/${workspaceSlug}/mcp.json`
    const config = await window.electronAPI.getWorkspaceMcpConfig(workspaceSlug)
    const currentConfig = JSON.stringify(config, null, 2)
    const prompt = `请帮我配置当前工作区的 MCP 服务器，你要主动来帮我实现，你可以采用联网搜索深度研究来尝试，当前环境已经有 Claude Agent SDK 了，除非不确定的时候才来问我，否则默认将帮我完成安装，而不是指导我。

## 工作区信息
- 工作区: ${workspaceName}
- MCP 配置文件: ${configPath}

## 当前配置
\`\`\`json
${currentConfig}
\`\`\`

## 配置格式
mcp.json 格式如下：
\`\`\`json
{
  "servers": {
    "服务器名称": {
      "type": "stdio | http | sse",
      "command": "可执行命令",
      "args": ["参数1", "参数2"],
      "env": { "KEY": "VALUE" },
      "url": "http://...",
      "headers": { "Key": "Value" },
      "enabled": true
    }
  }
}
\`\`\`
其中 stdio 类型使用 command/args/env，http/sse 类型使用 url/headers。

请读取当前配置文件，根据我的需求添加或修改 MCP 服务器，然后写回文件。`

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

  /** 添加 MCP 服务器 */
  const handleAddMcp = (): void => {
    setEditingServer(null)
    setMcpFormOpen(true)
  }

  /** 推荐 MCP 一键安装 */
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

  /** MCP 表单保存完成 */
  const handleMcpFormSaved = async (): Promise<void> => {
    setMcpFormOpen(false)
    setEditingServer(null)
    bumpCapabilitiesVersion((v) => v + 1)
    toast.success('MCP 服务器已保存')
  }

  /** 打开 Skills 目录 */
  const handleOpenSkillsDir = (): void => {
    if (skillsDir) {
      window.electronAPI.openFile(skillsDir)
    }
  }

  /** 导入 Skill */
  const handleImportSkill = async (sourceSlug: string, skillSlug: string): Promise<void> => {
    try {
      await window.electronAPI.importSkillFromWorkspace(workspaceSlug, sourceSlug, skillSlug)
      bumpCapabilitiesVersion((v) => v + 1)
      setImportDialogOpen(false)
      toast.success('已导入 Skill')
    } catch (error) {
      console.error('[CapabilityToolbar] 导入 Skill 失败:', error)
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('导入 Skill 失败', { description: message })
    }
  }

  // 当前已安装的 MCP 名称列表
  const installedMcpNames = capabilities?.mcpServers.map((s) => s.name) ?? []

  return (
    <>
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border/40 bg-muted/20 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleAddMcp}>
              <Plus size={14} />
              添加 MCP
            </Button>
          </TooltipTrigger>
          <TooltipContent>添加新的 MCP 服务器</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5"
              onClick={() => setRecommendationsOpen(true)}
            >
              <Sparkles size={14} />
              推荐 MCP
            </Button>
          </TooltipTrigger>
          <TooltipContent>查看推荐的一键安装 MCP</TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5"
              onClick={() => setImportDialogOpen(true)}
            >
              <Download size={14} />
              导入 Skill
            </Button>
          </TooltipTrigger>
          <TooltipContent>从其他工作区导入 Skill</TooltipContent>
        </Tooltip>

        {skillsDir && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5"
                onClick={handleOpenSkillsDir}
              >
                <FolderOpen size={14} />
                目录
              </Button>
            </TooltipTrigger>
            <TooltipContent>在文件管理器中打开 Skills 目录</TooltipContent>
          </Tooltip>
        )}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5"
              onClick={handleConfigSkillsViaChat}
            >
              <MessageSquare size={14} />
              AI 配置 Skills
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            TAgent Agent 可以联网查找 Skills 或一起创建新的 Skills 到当前工作区
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5"
              onClick={handleConfigMcpViaChat}
            >
              <MessageSquare size={14} />
              AI 配置 MCP
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            TAgent Agent 可以联网查找公开 MCP 并配置到当前工作区
          </TooltipContent>
        </Tooltip>
      </div>

      {/* MCP 表单 Dialog */}
      <Dialog open={mcpFormOpen} onOpenChange={setMcpFormOpen}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 max-h-[85vh]">
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle>
              {editingServer ? `编辑 MCP：${editingServer.name}` : '添加 MCP 服务器'}
            </DialogTitle>
            <DialogDescription>支持 stdio（命令行）、HTTP、sse 三种传输方式</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 pb-6 max-h-[calc(85vh-120px)]">
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

      {/* 推荐 MCP Dialog */}
      <Dialog open={recommendationsOpen} onOpenChange={setRecommendationsOpen}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 max-h-[85vh]">
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle>推荐 MCP</DialogTitle>
            <DialogDescription>常用 MCP 服务器，点击安装按钮后会预填表单</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 pb-6 max-h-[calc(85vh-120px)]">
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

      {/* 导入 Skill Dialog */}
      <ImportSkillDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        workspaceSlug={workspaceSlug}
        currentSkills={capabilities?.skills ?? []}
        importingSkill={null}
        onImport={handleImportSkill}
      />
    </>
  )
}
