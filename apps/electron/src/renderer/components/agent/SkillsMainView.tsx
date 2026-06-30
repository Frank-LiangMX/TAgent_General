/**
 * SkillsMainView - 插件功能区主区（市场 + 已安装）
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'
import { toast } from 'sonner'

import type { BuiltinMcpCatalogEntry, McpServerEntry, WorkspaceCapabilities } from '@tagent/shared'

import {
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  workspaceCapabilitiesVersionAtom,
} from '@/atoms/agent-atoms'
import { pluginSidebarSectionAtom } from '@/atoms/app-mode'
import { CapabilityToolbar } from '@/components/agent/CapabilityToolbar'
import { InstalledPluginsView } from '@/components/agent/InstalledPluginsView'
import { PluginMarketplaceView } from '@/components/agent/PluginMarketplaceView'
import { Panel } from '@/components/app-shell/Panel'
import { McpServerForm } from '@/components/settings/McpServerForm'
import { mcpCatalogEntryToServerEntry } from '@tagent/shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function SkillsMainView(): React.ReactElement {
  const section = useAtomValue(pluginSidebarSectionAtom)
  const bumpCapabilitiesVersion = useSetAtom(workspaceCapabilitiesVersionAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? null
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities | null>(null)

  const [mcpFormOpen, setMcpFormOpen] = React.useState(false)
  const [editingServer, setEditingServer] = React.useState<{
    name: string
    entry: McpServerEntry
  } | null>(null)

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

  const handleAddCustomMcp = (): void => {
    setEditingServer(null)
    setMcpFormOpen(true)
  }

  const handleInstallStoreMcp = (mcp: BuiltinMcpCatalogEntry): void => {
    const entry = mcpCatalogEntryToServerEntry(mcp)
    setEditingServer({ name: mcp.name, entry })
    setMcpFormOpen(true)
  }

  const handleStoreSkillInstalled = (): void => {
    bumpCapabilitiesVersion((v) => v + 1)
    toast.success('Skill 已安装')
  }

  const handleStoreBundleInstalled = (): void => {
    bumpCapabilitiesVersion((v) => v + 1)
  }

  const handleMcpFormSaved = async (): Promise<void> => {
    setMcpFormOpen(false)
    setEditingServer(null)
    bumpCapabilitiesVersion((v) => v + 1)
    toast.success('插件已保存')
  }

  const installedMcpNames = capabilities?.mcpServers.map((s) => s.name) ?? []
  const installedSkillSlugs = capabilities?.skills.map((s) => s.slug) ?? []
  const showMarketplace = section !== 'installed'
  const detailKey = section

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
          <div
            key={detailKey}
            className="plugins-inspector-body plugins-inspector-body--empty min-h-0 flex-1 overflow-hidden"
          >
            {showMarketplace && workspace ? (
              <PluginMarketplaceView
                workspaceSlug={workspace.slug}
                installedSkillSlugs={installedSkillSlugs}
                installedMcpNames={installedMcpNames}
                onInstallMcp={handleInstallStoreMcp}
                onSkillInstalled={handleStoreSkillInstalled}
                onBundleInstalled={handleStoreBundleInstalled}
                onAddCustomMcp={handleAddCustomMcp}
              />
            ) : workspace ? (
              <InstalledPluginsView capabilities={capabilities} workspaceSlug={workspace.slug} />
            ) : null}
          </div>
        </div>
      </div>

      {workspace ? (
        <Dialog open={mcpFormOpen} onOpenChange={setMcpFormOpen}>
          <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
            <DialogHeader className="px-6 pb-4 pt-6">
              <DialogTitle>
                {editingServer ? `编辑 MCP：${editingServer.name}` : '自定义 MCP'}
              </DialogTitle>
              <DialogDescription>
                MCP 连接插件，支持 stdio、HTTP、SSE 三种传输方式
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-6 pb-6">
              <McpServerForm
                server={editingServer}
                workspaceSlug={workspace.slug}
                onSaved={handleMcpFormSaved}
                onCancel={() => setMcpFormOpen(false)}
                hideTitleBar
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </Panel>
  )
}
