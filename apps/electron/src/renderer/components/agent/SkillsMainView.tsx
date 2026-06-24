/**
 * SkillsMainView - 插件功能区主区（Inspector）
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import type { WorkspaceCapabilities } from '@tagent/shared'

import {
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  workspaceCapabilitiesVersionAtom,
} from '@/atoms/agent-atoms'
import { selectedCapabilityAtom } from '@/atoms/app-mode'
import { CapabilityDetailView } from '@/components/agent/CapabilityDetailView'
import { CapabilityToolbar } from '@/components/agent/CapabilityToolbar'
import { Panel } from '@/components/app-shell/Panel'
import { RailInspectorHeader } from '@/components/app-shell/RailInspectorHeader'
import { cn } from '@/lib/utils'

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
    window.electronAPI
      .getWorkspaceCapabilities(workspace.slug)
      .then(setCapabilities)
      .catch(console.error)
  }, [workspace?.slug, capabilitiesVersion])

  const header = React.useMemo(() => {
    if (!selectedCapability) return null
    if (selectedCapability.type === 'mcp') {
      const server = capabilities?.mcpServers.find((s) => s.name === selectedCapability.key)
      return {
        crumbs: workspace ? [{ label: workspace.name }, { label: '插件' }] : [{ label: '插件' }],
        title: server?.name ?? selectedCapability.key,
        description: server
          ? `MCP · ${server.type} · ${server.enabled ? '已启用' : '已禁用'}`
          : '连接插件配置与状态',
      }
    }
    const skill = capabilities?.skills.find((s) => s.slug === selectedCapability.key)
    return {
      crumbs: workspace ? [{ label: workspace.name }, { label: '插件' }] : [{ label: '插件' }],
      title: skill?.name ?? selectedCapability.key,
      description: skill?.description ?? 'Skill 指令说明、文件与编辑',
    }
  }, [selectedCapability, workspace, capabilities])

  const detailKey = selectedCapability
    ? `${selectedCapability.type}:${selectedCapability.key}`
    : 'empty'

  return (
    <Panel variant="grow" className="content-glass plugins-inspector">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {workspace ? (
          <CapabilityToolbar
            capabilities={capabilities}
            workspaceSlug={workspace.slug}
            workspaceName={workspace.name}
          />
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {header ? (
            <RailInspectorHeader
              className="plugins-inspector-header border-border/35 bg-muted/10"
              crumbs={header.crumbs}
              title={header.title}
              description={header.description}
            />
          ) : null}

          <div
            key={detailKey}
            className={cn(
              'plugins-inspector-body min-h-0 flex-1 overflow-hidden',
              header ? 'plugins-inspector-body--with-header' : 'plugins-inspector-body--empty'
            )}
          >
            <CapabilityDetailView variant="inspector" />
          </div>
        </div>
      </div>
    </Panel>
  )
}
