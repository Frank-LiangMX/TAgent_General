/**
 * useDesignContextAugment — 提供当前 Design Context 给消费组件
 *
 * 这个 hook 不再直接 patch sendAgentMessage（window.electronAPI 是只读）。
 * 而是提供 augment 函数，让消费组件（如 AgentView）在发送消息时调用。
 *
 * 推荐使用方式：
 * 1. 在 AgentView 中调用 useDesignContext() 获取 ctx
 * 2. 发送消息时调用 augmentMessageWithDesignContext(userMessage, ctx)
 *
 * 设计来源：docs/plans/2026-07-13-design-preview-design.md §5.2
 */

import { useStore } from 'jotai'

import {
  designCssAtom,
  designEnabledAtom,
  designHtmlAtom,
  designSelectionAtom,
} from '@/atoms/design-preview-atoms'

/** 截断长度 */
const MAX_CONTENT_CHARS = 6000

/** 截断字符串 */
function truncate(
  value: string | null | undefined,
  max: number = MAX_CONTENT_CHARS
): string | undefined {
  if (!value) return undefined
  if (value.length <= max) return value
  return value.slice(0, max) + `\n\n... (截断，原始内容 ${value.length} 字符)`
}

/** 收集当前 Design 上下文 */
export interface DesignContextSnapshot {
  enabled: boolean
  html: string | null
  css: string | null
  selection: { x: number; y: number; width: number; height: number } | null
}

export function useDesignContextAugment(): {
  snapshot: DesignContextSnapshot
  augment: (userMessage: string) => string
} {
  const store = useStore()

  const snapshot: DesignContextSnapshot = {
    enabled: store.get(designEnabledAtom),
    html: store.get(designHtmlAtom),
    css: store.get(designCssAtom),
    selection: store.get(designSelectionAtom),
  }

  const augment = (userMessage: string): string => {
    if (!snapshot.enabled) return userMessage
    const ctxText = buildContextBlock(snapshot)
    if (!ctxText) return userMessage
    // 把上下文放到用户消息前面，Agent 会优先看到
    return `${ctxText}\n\n----- 以下是用户的实际问题 -----\n\n${userMessage}`
  }

  return { snapshot, augment }
}

/** 构造注入文本 */
function buildContextBlock(ctx: DesignContextSnapshot): string {
  if (!ctx.enabled) return ''
  const lines: string[] = []
  lines.push('===== DESIGN_PREVIEW 上下文 START =====')
  lines.push('【必读】以下内容是 Design Preview 画布当前状态，请仔细查看：')
  lines.push('  • 设备类型、框选区域、当前 HTML/CSS')
  lines.push('  • 用户在画布上框选了某个区域，结合框选坐标理解用户意图')
  lines.push('  • 修改 HTML/CSS 后，请明确告诉用户修改了什么')
  lines.push('')

  lines.push(`[设备] ${ctx.enabled ? '已启用' : '未启用'}`)
  if (ctx.selection) {
    const { x, y, width, height } = ctx.selection
    lines.push(
      `[框选区域] x=${Math.round(x)}, y=${Math.round(y)}, w=${Math.round(width)}, h=${Math.round(height)}`
    )
  } else {
    lines.push('[框选区域] 无（用户尚未框选）')
  }

  if (ctx.html) {
    const truncated = truncate(ctx.html)
    if (truncated) {
      lines.push('')
      lines.push('[当前 HTML]')
      lines.push('```html')
      lines.push(truncated)
      lines.push('```')
    }
  } else {
    lines.push('')
    lines.push('[当前 HTML] 无')
  }
  if (ctx.css) {
    const truncated = truncate(ctx.css)
    if (truncated) {
      lines.push('')
      lines.push('[当前 CSS]')
      lines.push('```css')
      lines.push(truncated)
      lines.push('```')
    }
  }

  lines.push('')
  lines.push('===== DESIGN_PREVIEW 上下文 END =====')
  return lines.join('\n')
}