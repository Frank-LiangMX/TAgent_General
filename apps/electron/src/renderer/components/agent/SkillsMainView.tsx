/**
 * SkillsMainView — 插件主区（spatial）
 *
 * 透明 content-glass 场；工具钮嵌进子视图标题行，不再叠一层 muted 工具条。
 * 侧栏仍负责市场分类 / 已安装导航。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import * as React from 'react'
import { toast } from 'sonner'

import type { BuiltinMcpCatalogEntry, McpServerEntry, WorkspaceCapabilities } from '@tagent/shared'

import { mcpCatalogEntryToServerEntry } from '@tagent/shared'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@tagent/ui'
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
import { detectIsMac, detectIsWindows } from '@/lib/platform'
import { cn } from '@/lib/utils'

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

  const isMac = React.useMemo(() => detectIsMac(), [])
  const isWindows = React.useMemo(() => detectIsWindows(), [])

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

  const toolbar =
    workspace != null ? (
      <CapabilityToolbar
        capabilities={capabilities}
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
      />
    ) : null

  return (
    <Panel variant="grow" className="content-glass relative flex min-h-0 flex-col overflow-hidden">
      <div
        className={cn('relative shrink-0', isMac ? 'h-3' : 'h-8', isWindows && 'pr-[134px]')}
      >
        <div
          className="absolute inset-0 titlebar-drag-region"
          style={isWindows ? { right: 126 } : undefined}
          aria-hidden
        />
      </div>

      <div key={section} className="min-h-0 flex-1 overflow-hidden">
        {showMarketplace && workspace ? (
          <PluginMarketplaceView
            workspaceSlug={workspace.slug}
            installedSkillSlugs={installedSkillSlugs}
            installedMcpNames={installedMcpNames}
            onInstallMcp={handleInstallStoreMcp}
            onSkillInstalled={handleStoreSkillInstalled}
            onBundleInstalled={handleStoreBundleInstalled}
            onAddCustomMcp={handleAddCustomMcp}
            toolbar={toolbar}
          />
        ) : workspace ? (
          <InstalledPluginsView
            capabilities={capabilities}
            workspaceSlug={workspace.slug}
            toolbar={toolbar}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6">
            <p className="md-text-faint text-[12px]">请先选择工作区</p>
          </div>
        )}
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
