import { toast } from 'sonner'

import type { CapabilityChange } from '@tagent/shared'

/** 变化类型 → 中文描述 */
const CHANGE_LABELS: Record<CapabilityChange['type'], string> = {
  mcp_added: 'MCP 服务器已添加',
  mcp_removed: 'MCP 服务器已移除',
  mcp_enabled: 'MCP 服务器已启用',
  mcp_disabled: 'MCP 服务器已禁用',
  skill_added: 'Skill 已添加',
  skill_removed: 'Skill 已移除',
  skill_enabled: 'Skill 已启用',
  skill_disabled: 'Skill 已禁用',
}

/**
 * 显示能力变化 toast 通知。
 *
 * - 1-3 条变化：每条单独 toast
 * - 4+ 条变化：合并为一条摘要 toast
 */
export function showCapabilityChangeToasts(changes: CapabilityChange[]): void {
  if (changes.length === 0) return

  if (changes.length <= 3) {
    for (const change of changes) {
      const label = CHANGE_LABELS[change.type]
      const isPositive = change.type.endsWith('_added') || change.type.endsWith('_enabled')
      if (isPositive) {
        toast.success(`${label}: ${change.name}`)
      } else {
        toast.info(`${label}: ${change.name}`)
      }
    }
  } else {
    // 批量变化：合并为一条摘要
    const mcpCount = changes.filter((c) => c.type.startsWith('mcp_')).length
    const skillCount = changes.filter((c) => c.type.startsWith('skill_')).length
    const parts: string[] = []
    if (mcpCount > 0) parts.push(`${mcpCount} 个 MCP 服务器`)
    if (skillCount > 0) parts.push(`${skillCount} 个 Skill`)
    toast.info(`工作区配置已更新：${parts.join('、')}`)
  }
}

/**
 * 显示 TA MCP 缺失 toast，附带"立即安装"按钮
 *
 * Agent 在 canUseTool 拦截到 tagent__* 工具不可用时，触发此 toast。
 * 用户点击"立即安装"后，渲染 install dialog 并跳到 TA 模式页。
 */
export function showTAMcpMissingToast(): void {
  toast.error('TA MCP 未就绪：ta-agent-mcp Python 包未安装', {
    description: '点击「立即安装」自动下载依赖（约 1-2 分钟）',
    duration: Infinity, // 不自动消失
    action: {
      label: '立即安装',
      onClick: () => {
        // 触发自定义事件，TA 模式页面监听后弹 dialog
        window.dispatchEvent(new CustomEvent('tagent:ta-install-request'))
      },
    },
  })
}
