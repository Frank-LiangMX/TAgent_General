/**
 * BuiltinMcpRecommendations - 内置 MCP 推荐
 *
 * 展示推荐的 MCP 服务器，分为：
 * - 通用 MCP：context7、github、sequential-thinking 等
 * - TA 专用 MCP：ta-agent-mcp（需要 Python 环境）
 *
 * 提供一键安装指引。
 */

import { ExternalLink, CheckCircle2, XCircle, Loader2, Download, Plug } from 'lucide-react'
import * as React from 'react'

import type { McpServerEntry } from '@tagent/shared'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ===== Types =====

export interface BuiltinMcpInfo {
  /** MCP 名称 */
  name: string
  /** 显示名称 */
  displayName: string
  /** 描述 */
  description: string
  /** 分类 */
  category: 'general' | 'ta'
  /** 安装命令 */
  installCommand: string
  /** 安装参数 */
  installArgs: string[]
  /** 环境变量说明 */
  envHints?: Array<{ key: string; description: string; required: boolean }>
  /** 文档链接 */
  docsUrl?: string
  /** 是否已安装 */
  installed?: boolean
  /** 是否可安装（依赖检查） */
  canInstall?: boolean
  /** 安装状态 */
  installing?: boolean
}

interface BuiltinMcpRecommendationsProps {
  /** 已安装的 MCP 名称列表 */
  installedMcps: string[]
  /** 工作区 slug */
  workspaceSlug: string
  /** 安装回调 */
  onInstall?: (mcp: BuiltinMcpInfo) => void
}

// ===== 内置 MCP 定义 =====

const BUILTIN_MCPS: Omit<BuiltinMcpInfo, 'installed' | 'canInstall' | 'installing'>[] = [
  // 通用 MCP
  {
    name: 'context7',
    displayName: 'Context7 文档查询',
    description: '实时查询库/框架文档，支持 500+ 库',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@upstash/context7-mcp'],
    docsUrl: 'https://github.com/upstash/context7-mcp',
  },
  {
    name: 'github',
    displayName: 'GitHub API',
    description: '操作 GitHub PR、Issue、代码搜索',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@modelcontextprotocol/server-github'],
    envHints: [
      { key: 'GITHUB_TOKEN', description: 'GitHub PAT (classic or fine-grained)', required: true },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
  },
  {
    name: 'sequential-thinking',
    displayName: 'Sequential Thinking',
    description: '多步骤复杂推理，适合复杂问题分解',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
  },
  {
    name: 'puppeteer',
    displayName: 'Puppeteer 浏览器',
    description: '浏览器自动化，网页抓取和交互',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@modelcontextprotocol/server-puppeteer'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
  },
  {
    name: 'filesystem',
    displayName: 'Filesystem 文件系统',
    description: '安全文件操作，限定允许访问目录',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  },
  // TA 专用 MCP
  {
    name: 'ta-agent-mcp',
    displayName: 'TA Agent MCP',
    description: 'Technical Artist 工具链：资产检查、命名规范、FBX 分析等',
    category: 'ta',
    installCommand: 'python',
    installArgs: ['-m', 'ta_agent_mcp'],
    envHints: [
      { key: 'TA_AGENT_DATA_DIR', description: 'TA 数据目录，默认 ~/.tagent/ta/', required: false },
    ],
    docsUrl:
      'https://github.com/Frank-LiangMX/TAgent_General/tree/main/apps/electron/default-mcp/ta-agent-mcp',
  },
]

// ===== Component =====

export function BuiltinMcpRecommendations({
  installedMcps,
  workspaceSlug,
  onInstall,
}: BuiltinMcpRecommendationsProps): React.ReactElement {
  const [installingMcp, setInstallingMcp] = React.useState<string | null>(null)

  // 分组
  const generalMcps = BUILTIN_MCPS.filter((m) => m.category === 'general')
  const taMcps = BUILTIN_MCPS.filter((m) => m.category === 'ta')

  // 带状态的 MCP
  const mcpWithStatus = (mcp: (typeof BUILTIN_MCPS)[0]): BuiltinMcpInfo => ({
    ...mcp,
    installed: installedMcps.includes(mcp.name),
    canInstall: true, // 简化版：全部可安装
    installing: installingMcp === mcp.name,
  })

  const handleInstall = async (mcp: BuiltinMcpInfo): Promise<void> => {
    if (mcp.installed || mcp.installing) return

    setInstallingMcp(mcp.name)
    try {
      onInstall?.(mcp)
    } finally {
      // 父组件会处理实际安装，这里只管理 UI 状态
      // 安装完成后 installedMcps 更新会触发重渲染
    }
  }

  return (
    <div className="space-y-6">
      {/* 通用 MCP */}
      <div>
        <h4 className="text-sm font-medium text-foreground/80 mb-3 flex items-center gap-2">
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

      {/* TA 专用 MCP */}
      <div>
        <h4 className="text-sm font-medium text-foreground/80 mb-3 flex items-center gap-2">
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

// ===== McpRecommendationCard =====

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
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors">
      {/* 状态图标 */}
      <div className={cn('mt-0.5', statusColor)}>
        {mcp.installed ? (
          <CheckCircle2 size={18} />
        ) : mcp.installing ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Download size={18} />
        )}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{mcp.displayName}</span>
          {mcp.category === 'ta' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
              TA
            </span>
          )}
          {mcp.installed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 font-medium">
              已安装
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{mcp.description}</p>

        {/* 环境变量提示 */}
        {mcp.envHints && mcp.envHints.length > 0 && !mcp.installed && (
          <div className="mt-2 space-y-1">
            {mcp.envHints.map((hint) => (
              <div key={hint.key} className="text-[11px] text-muted-foreground">
                <code className="font-mono bg-muted px-1 rounded">{hint.key}</code>
                {hint.required && <span className="text-red-500 ml-1">*</span>}
                <span className="ml-1">— {hint.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {mcp.docsUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(mcp.docsUrl, '_blank')}
            title="查看文档"
          >
            <ExternalLink size={14} />
          </Button>
        )}
        {!mcp.installed && (
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
        )}
      </div>
    </div>
  )
}
