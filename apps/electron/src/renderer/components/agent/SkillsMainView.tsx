/**
 * SkillsMainView - Skills 功能区主区（Inspector）
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import type { WorkspaceCapabilities } from '@tagent/shared'

import { selectedCapabilityAtom } from '@/atoms/app-mode'
import { agentWorkspacesAtom, currentAgentWorkspaceIdAtom, workspaceCapabilitiesVersionAtom } from '@/atoms/agent-atoms'
import { CapabilityDetailView } from '@/components/agent/CapabilityDetailView'
import { CapabilityToolbar } from '@/components/agent/CapabilityToolbar'
import { RailInspectorHeader } from '@/components/app-shell/RailInspectorHeader'
import { Panel } from '@/components/app-shell/Panel'

export function SkillsMainView(): React.ReactElement {
  const selectedCapability = useAtomValue(selectedCapabilityAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities | null>(null)

  React.useEffect(() => {
    if (!workspace?.slug) {
      setCapabilities(null)
      return
    }
    window.electronAPI.getWorkspaceCapabilities(workspace.slug).then(setCapabilities).catch(console.error)
  }, [workspace?.slug, capabilitiesVersion])

  const header = React.useMemo(() => {
    if (!selectedCapability) return null
    if (selectedCapability.type === 'mcp') {
      const server = capabilities?.mcpServers.find((s) => s.name === selectedCapability.key)
      return {
        crumbs: workspace ? [{ label: workspace.name }, { label: 'MCP' }] : [{ label: 'MCP' }],
        title: server?.name ?? selectedCapability.key,
        description: server ? `${server.type} · ${server.enabled ? '已启用' : '已禁用'}` : 'MCP Server 配置与连接状态',
      }
    }
    const skill = capabilities?.skills.find((s) => s.slug === selectedCapability.key)
    return {
      crumbs: workspace ? [{ label: workspace.name }, { label: 'Skills' }] : [{ label: 'Skills' }],
      title: skill?.name ?? selectedCapability.key,
      description: skill?.description ?? 'Skill 说明、文件与编辑',
    }
  }, [selectedCapability, workspace, capabilities])

  return (
    <Panel variant="grow" className="content-glass">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {workspace ? (
          <CapabilityToolbar
            capabilities={capabilities}
            workspaceSlug={workspace.slug}
            workspaceName={workspace.name}
          />
        ) : null}
        {header ? (
          <RailInspectorHeader
            crumbs={header.crumbs}
            title={header.title}
            description={header.description}
          />
        ) : null}
        <CapabilityDetailView variant="inspector" />
      </div>
    </Panel>
  )
}
