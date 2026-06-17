/**
 * TAModeView - TA 模式主视图
 *
 * 包含：
 * - 左侧 Tab 导航（资产库 / 审核 / 流水线 / 配置）
 * - 右侧内容区域
 * - MCP Server 状态指示器
 * - 一键安装 TA MCP Server 对话框
 */

import { useAtomValue } from 'jotai'
import {
  Database,
  ClipboardCheck,
  GitBranch,
  Settings,
  Loader2,
  Brain,
  Download,
  X,
  Circle,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { AssetLibraryPanel } from './asset-library/AssetLibraryPanel'
import { TAConfigPanel } from './config/TAConfigPanel'
import { PipelinePanel } from './pipeline/PipelinePanel'
import { ReviewQueuePanel } from './review/ReviewQueuePanel'
import { TAInstallDialog } from './TAInstallDialog'

import { currentAgentWorkspaceIdAtom, agentWorkspacesAtom } from '@/atoms/agent-atoms'
import { MemoryMonitorPanel } from '@/components/memory/MemoryMonitorPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TATabId = 'assets' | 'review' | 'pipeline' | 'memory' | 'config'

const tabs: { id: TATabId; label: string; icon: React.ReactNode }[] = [
  { id: 'assets', label: '资产库', icon: <Database size={16} /> },
  { id: 'review', label: '审核', icon: <ClipboardCheck size={16} /> },
  { id: 'pipeline', label: '流水线', icon: <GitBranch size={16} /> },
  { id: 'memory', label: '记忆', icon: <Brain size={16} /> },
  { id: 'config', label: '配置', icon: <Settings size={16} /> },
]

interface TAMcpStatus {
  installed: boolean
  configured: boolean
  pythonVersion?: string
  error?: string
}

export function TAModeView(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<TATabId>('assets')
  const [mcpStatus, setMcpStatus] = React.useState<TAMcpStatus | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [installDialogOpen, setInstallDialogOpen] = React.useState(false)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)

  // 计算当前 workspace slug
  const workspaceSlug = React.useMemo(() => {
    const ws = workspaces.find((w) => w.id === currentWorkspaceId)
    return ws?.slug ?? null
  }, [workspaces, currentWorkspaceId])

  // 检查 TA MCP Server 状态
  React.useEffect(() => {
    let mounted = true

    async function checkStatus() {
      if (!workspaceSlug) return

      setIsLoading(true)
      try {
        const status = await window.electronAPI.getTAMcpStatus()
        const configured = await window.electronAPI.isTAMcpConfigured(workspaceSlug)
        if (mounted) {
          setMcpStatus({ ...status, configured })
        }
      } catch (error) {
        console.error('[TA Mode] 检查 MCP 状态失败:', error)
        if (mounted) {
          setMcpStatus({
            installed: false,
            configured: false,
            error: '状态检查失败',
          })
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    checkStatus()

    return () => {
      mounted = false
    }
  }, [workspaceSlug])

  // 安装完成后由 dialog 回调通知，重新检查状态
  const handleInstallComplete = React.useCallback(
    async (success: boolean) => {
      if (!success) return
      // 重新拉状态：installed 应变为 true，跳到"未配置"或"运行中"
      if (workspaceSlug) {
        try {
          const status = await window.electronAPI.getTAMcpStatus()
          const configured = await window.electronAPI.isTAMcpConfigured(workspaceSlug)
          setMcpStatus({ ...status, configured })
        } catch (error) {
          console.error('[TA Mode] 安装后刷新状态失败:', error)
        }
      }
    },
    [workspaceSlug]
  )

  // 监听全局事件：Agent 拦截到 TA 工具不可用时，弹安装对话框
  React.useEffect(() => {
    const handler = () => setInstallDialogOpen(true)
    window.addEventListener('tagent:ta-install-request', handler)
    return () => window.removeEventListener('tagent:ta-install-request', handler)
  }, [])

  // 启用 TA MCP
  const handleEnableMcp = React.useCallback(async () => {
    if (!workspaceSlug) return

    try {
      await window.electronAPI.enableTAMcp(workspaceSlug)
      const status = await window.electronAPI.getTAMcpStatus()
      const configured = await window.electronAPI.isTAMcpConfigured(workspaceSlug)
      setMcpStatus({ ...status, configured })
    } catch (error) {
      console.error('[TA Mode] 启用 MCP 失败:', error)
    }
  }, [workspaceSlug])

  return (
    <div className="h-full flex bg-background rounded-2xl shadow-xl overflow-hidden">
      {/* 左侧 Tab 导航 */}
      <div className="w-[200px] flex-shrink-0 border-r border-border bg-muted/30 p-3">
        <div className="flex flex-col gap-1">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                activeTab === id
                  ? 'bg-primary/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* TA MCP 状态指示器 */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="px-3 py-2">
            <div className="text-xs text-muted-foreground mb-1">MCP Server</div>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">检测中...</span>
              </div>
            ) : mcpStatus?.installed && mcpStatus?.configured ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-foreground/80">ta-agent-mcp 运行中</span>
              </div>
            ) : mcpStatus?.installed && !mcpStatus?.configured ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs text-foreground/80">未配置</span>
                </div>
                <button
                  onClick={handleEnableMcp}
                  className="w-full text-xs px-2 py-1 bg-primary/10 rounded hover:bg-primary/20 transition-colors"
                >
                  启用
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs text-foreground/80">未安装</span>
                </div>
                {mcpStatus?.error && (
                  <div className="text-xs text-muted-foreground break-all">{mcpStatus.error}</div>
                )}
                <Button
                  variant="default"
                  size="sm"
                  className="w-full h-7 text-xs gap-1.5"
                  onClick={() => setInstallDialogOpen(true)}
                >
                  <Download size={12} />
                  一键安装
                </Button>
              </div>
            )}
            {mcpStatus?.pythonVersion && (
              <div className="text-xs text-muted-foreground mt-1">
                Python {mcpStatus.pythonVersion}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧内容区域 */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeTab === 'assets' && <AssetLibraryPanel />}
        {activeTab === 'review' && <ReviewQueuePanel />}
        {activeTab === 'pipeline' && <PipelinePanel />}
        {activeTab === 'memory' && <MemoryMonitorPanel />}
        {activeTab === 'config' && <TAConfigPanel />}
      </div>

      {/* 安装对话框 */}
      <TAInstallDialog
        open={installDialogOpen}
        onOpenChange={setInstallDialogOpen}
        onComplete={handleInstallComplete}
      />
    </div>
  )
}
