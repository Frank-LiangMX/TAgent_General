/**
 * PluginConfigDialog — AI 配置插件确认弹窗
 *
 * 展示工作区上下文预设，用户用自然语言描述需求，确认后再创建会话并发送给 Agent。
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  ScrollArea,
  Textarea,
} from '@tagent/ui'
import * as React from 'react'

import type { WorkspaceCapabilities } from '@tagent/shared'

import { cn } from '@/lib/utils'

interface PluginConfigContext {
  preview: string
  messagePrefix: string
}

export function buildPluginConfigContext(params: {
  workspaceName: string
  workspaceSlug: string
  capabilities: WorkspaceCapabilities | null
}): PluginConfigContext {
  const { workspaceName, workspaceSlug, capabilities } = params
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

  const messagePrefix = `请帮我配置当前工作区的插件（MCP 连接与 Skill 指令）。

## 工作区信息
- 工作区: ${workspaceName}
- MCP 配置: ${mcpConfigPath}
- Skills 目录: ${skillsDirPath}

## 当前插件
${pluginList}`

  return { preview: messagePrefix, messagePrefix }
}

export function buildPluginConfigMessage(prefix: string, userRequest: string): string {
  const trimmed = userRequest.trim()
  return `${prefix}

## 我的需求
${trimmed}

请读取 mcp.json 与 skills/ 目录，根据上述需求添加或修改插件配置。`
}

interface PluginConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceName: string
  workspaceSlug: string
  capabilities: WorkspaceCapabilities | null
  submitting?: boolean
  onSubmit: (message: string) => Promise<void>
}

export function PluginConfigDialog({
  open,
  onOpenChange,
  workspaceName,
  workspaceSlug,
  capabilities,
  submitting = false,
  onSubmit,
}: PluginConfigDialogProps): React.ReactElement {
  const [userRequest, setUserRequest] = React.useState('')

  const context = React.useMemo(
    () =>
      buildPluginConfigContext({
        workspaceName,
        workspaceSlug,
        capabilities,
      }),
    [workspaceName, workspaceSlug, capabilities]
  )

  React.useEffect(() => {
    if (!open) {
      setUserRequest('')
    }
  }, [open])

  const handleSubmit = async (): Promise<void> => {
    if (!userRequest.trim() || submitting) return
    await onSubmit(buildPluginConfigMessage(context.messagePrefix, userRequest))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-3 pt-6">
          <DialogTitle>AI 配置插件</DialogTitle>
          <DialogDescription>
            下方为将发送给 Agent 的工作区上下文。请用自然语言说明想安装或调整的插件，确认后再发送。
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 pb-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground/80">工作区上下文（预设）</Label>
            <ScrollArea className="h-[min(220px,32vh)] rounded-glass-chip border border-border/50 bg-muted/20">
              <pre className="whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-foreground/75">
                {context.preview}
              </pre>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="plugin-config-request"
              className="text-xs font-medium text-foreground/80"
            >
              想安装什么插件？
            </Label>
            <Textarea
              id="plugin-config-request"
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              placeholder="例如：GitHub MCP 和 code-review skill，用于 PR 审查"
              rows={4}
              disabled={submitting}
              className={cn('min-h-[96px] resize-y text-sm')}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground">⌘/Ctrl + Enter 快速发送</p>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/40 bg-muted/10 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={submitting || !userRequest.trim()}
            onClick={() => void handleSubmit()}
          >
            {submitting ? '发送中…' : '发送给 Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
