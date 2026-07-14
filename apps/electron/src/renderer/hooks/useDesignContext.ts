/**
 * useDesignContext — Design Preview 上下文提取 hook
 *
 * 从 Design Canvas atoms 中组装 DesignContextForAgent，
 * 用于注入到 Agent 对话上下文中。
 *
 * 设计来源：docs/plans/2026-07-13-design-preview-design.md §4.3
 */

import { useAtomValue } from 'jotai'

import {
  designCssAtom,
  designDeviceAtom,
  designEnabledAtom,
  designHtmlAtom,
  designSelectionAtom,
  type DesignContextForAgent,
  type SelectionRegion,
} from '@/atoms/design-preview-atoms'

/** 截断 HTML/CSS 长度（避免 prompt 过长） */
const MAX_CONTENT_CHARS = 8000

/** 截断字符串 */
function truncate(value: string | null | undefined, max: number = MAX_CONTENT_CHARS): string | undefined {
  if (!value) return undefined
  if (value.length <= max) return value
  return value.slice(0, max) + `\n\n... (截断，原始内容 ${value.length} 字符)`
}

/** HTML 摘要（提取可读文本） */
function summarizeHtml(html: string): string {
  // 移除脚本和样式
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  // 提取文本（粗略）
  const text = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 500)
}

/**
 * 获取当前 Design Canvas 的完整上下文。
 *
 * 返回的上下文可以直接注入到 Agent 对话中，
 * 让 Agent 看到当前画布的 HTML、CSS、设备、框选信息。
 */
export function useDesignContext(): DesignContextForAgent | null {
  const enabled = useAtomValue(designEnabledAtom)
  const html = useAtomValue(designHtmlAtom)
  const css = useAtomValue(designCssAtom)
  const device = useAtomValue(designDeviceAtom)
  const selection = useAtomValue(designSelectionAtom)

  if (!enabled) return null

  const ctx: DesignContextForAgent = {
    designModeEnabled: true,
    device,
  }

  if (html) {
    ctx.htmlSummary = summarizeHtml(html)
  }

  if (selection) {
    ctx.userSelection = {
      region: selection,
    }
  }

  // 完整内容（可选，注入时决定是否使用）
  if (html) {
    (ctx as DesignContextForAgent & { _htmlFull?: string })._htmlFull = html
  }
  if (css) {
    (ctx as DesignContextForAgent & { _cssFull?: string })._cssFull = css
  }

  return ctx
}

/**
 * 把 Design 上下文格式化为可附加到 userMessage 的文本。
 *
 * 设计为：在用户原始消息之后附加 <design-context> 块，
 * 让 Agent 能明确看到设计上下文，但不影响用户主要意图。
 */
export function formatDesignContextForMessage(
  ctx: DesignContextForAgent | null
): string {
  if (!ctx || !ctx.designModeEnabled) return ''

  const lines: string[] = []
  lines.push('<design-context>')
  lines.push(`[Design Preview 已启用] 当前设备: ${ctx.device}`)

  if (ctx.userSelection) {
    const { region } = ctx.userSelection
    lines.push(
      `[框选区域] x=${region.x}, y=${region.y}, width=${region.width}, height=${region.height}`
    )
  }

  if (ctx.htmlSummary) {
    lines.push(`[页面摘要] ${ctx.htmlSummary}`)
  }

  // 完整 HTML/CSS（用代码块包裹，避免被 Agent 误解为指令）
  const ctxWithFull = ctx as DesignContextForAgent & {
    _htmlFull?: string
    _cssFull?: string
  }
  if (ctxWithFull._htmlFull) {
    const truncatedHtml = truncate(ctxWithFull._htmlFull)
    if (truncatedHtml) {
      lines.push('[当前 HTML]')
      lines.push('```html')
      lines.push(truncatedHtml)
      lines.push('```')
    }
  }
  if (ctxWithFull._cssFull) {
    const truncatedCss = truncate(ctxWithFull._cssFull)
    if (truncatedCss) {
      lines.push('[当前 CSS]')
      lines.push('```css')
      lines.push(truncatedCss)
      lines.push('```')
    }
  }

  lines.push('</design-context>')
  return lines.join('\n')
}

/**
 * 增强 userMessage：把 Design 上下文附加到用户消息末尾。
 * 如果没有 Design 上下文，返回原消息。
 */
export function augmentMessageWithDesignContext(
  userMessage: string,
  ctx: DesignContextForAgent | null
): string {
  const ctxText = formatDesignContextForMessage(ctx)
  if (!ctxText) return userMessage
  return `${userMessage}\n\n${ctxText}`
}

/** 类型导出 */
export type { SelectionRegion }