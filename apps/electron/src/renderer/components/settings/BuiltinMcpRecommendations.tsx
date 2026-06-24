/**
 * BuiltinMcpRecommendations - 内置 MCP 推荐（兼容层）
 *
 * @deprecated 请使用 PluginStorePanel。本组件保留给设置页等旧入口。
 */

import { ExternalLink, CheckCircle2, Loader2, Download, Plug } from 'lucide-react'
import * as React from 'react'

import { BUILTIN_MCP_CATALOG, type BuiltinMcpCatalogEntry } from '@tagent/shared'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type BuiltinMcpInfo = BuiltinMcpCatalogEntry & {
  installed?: boolean
  canInstall?: boolean
  installing?: boolean
}

interface BuiltinMcpRecommendationsProps {
  installedMcps: string[]
  workspaceSlug: string
  onInstall?: (mcp: BuiltinMcpInfo) => void
}

export function BuiltinMcpRecommendations({
  installedMcps,
  onInstall,
}: BuiltinMcpRecommendationsProps): React.ReactElement {
  const [installingMcp, setInstallingMcp] = React.useState<string | null>(null)

  const generalMcps = BUILTIN_MCP_CATALOG.filter((m) => m.category === 'general')
  const taMcps = BUILTIN_MCP_CATALOG.filter((m) => m.category === 'ta')

  const mcpWithStatus = (mcp: BuiltinMcpCatalogEntry): BuiltinMcpInfo => ({
    ...mcp,
    installed: installedMcps.includes(mcp.name),
    canInstall: true,
    installing: installingMcp === mcp.name,
  })

  const handleInstall = async (mcp: BuiltinMcpInfo): Promise<void> => {
    if (mcp.installed || mcp.installing) return
    setInstallingMcp(mcp.name)
    try {
      onInstall?.(mcp)
    } finally {
      setInstallingMcp(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground/80">
          <Plug size={16} className="text-blue-500" />
          通用 MCP
        </h4>
        <div className="grid gap-3">
          {generalMcps.map((mcp) => (
            <McpRecommendationCard
              key={mcp.name}
              mcp={mcpWithStatus(mcp)}
              onInstall={handleInstall}
            />
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground/80">
          <Plug size={16} className="text-amber-500" />
          TA 专用 MCP
        </h4>
        <div className="grid gap-3">
          {taMcps.map((mcp) => (
            <McpRecommendationCard
              key={mcp.name}
              mcp={mcpWithStatus(mcp)}
              onInstall={handleInstall}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface McpRecommendationCardProps {
  mcp: BuiltinMcpInfo
  onInstall: (mcp: BuiltinMcpInfo) => Promise<void>
}

function McpRecommendationCard({ mcp, onInstall }: McpRecommendationCardProps): React.ReactElement {
  const statusColor = mcp.installed
    ? 'text-green-500'
    : mcp.installing
      ? 'text-blue-500'
      : 'text-muted-foreground'

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/30">
      <div className={cn('mt-0.5', statusColor)}>
        {mcp.installed ? (
          <CheckCircle2 size={18} />
        ) : mcp.installing ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Download size={18} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{mcp.displayName}</span>
          {mcp.category === 'ta' ? (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              TA
            </span>
          ) : null}
          {mcp.installed ? (
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
              已安装
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{mcp.description}</p>

        {mcp.envHints && mcp.envHints.length > 0 && !mcp.installed ? (
          <div className="mt-2 space-y-1">
            {mcp.envHints.map((hint) => (
              <div key={hint.key} className="text-[11px] text-muted-foreground">
                <code className="rounded bg-muted px-1 font-mono">{hint.key}</code>
                {hint.required ? <span className="ml-1 text-red-500">*</span> : null}
                <span className="ml-1">— {hint.description}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {mcp.docsUrl ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(mcp.docsUrl, '_blank')}
            title="查看文档"
          >
            <ExternalLink size={14} />
          </Button>
        ) : null}
        {!mcp.installed ? (
          <Button
            variant="outline"
            size="sm"
            disabled={mcp.installing}
            onClick={() => onInstall(mcp)}
          >
            {mcp.installing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>安装中</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>安装</span>
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
