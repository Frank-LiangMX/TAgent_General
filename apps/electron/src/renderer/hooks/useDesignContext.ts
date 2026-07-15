/**
 * useDesignContext — Design Preview 上下文提取 hook
 *
 * 组装 DesignContextForAgent，把 iframe 内选中的元素结构化信息（CSS 选择器、标签、文本）
 * 注入到 Agent 对话上下文中，让 Agent 能精确定位用户指向的元素。
 *
 * 注入原则（融合模型）：
 *  - 只生成精简 <design-context>（选中优先 / 否则短摘要）
 *  - 不每轮塞整页 HTML/CSS（上下文进 wire，不进可见 transcript）
 */

import { useAtomValue } from 'jotai'

import {
  designDeviceAtom,
  designEnabledAtom,
  designHtmlAtom,
  designSelectionAtom,
  canvasLayersAtom,
  selectedElementIdsAtom,
  type DesignContextForAgent,
  type SelectionRegion,
  type CanvasElement,
} from '@/atoms/design-preview-atoms'

function summarizeHtml(html: string): string {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const text = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 500)
}

function shortText(value: string | undefined, max = 80): string | undefined {
  if (!value) return undefined
  const t = value.replace(/\s+/g, ' ').trim()
  if (!t) return undefined
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export function useDesignContext(): DesignContextForAgent | null {
  const enabled = useAtomValue(designEnabledAtom)
  const html = useAtomValue(designHtmlAtom)
  const device = useAtomValue(designDeviceAtom)
  const selection = useAtomValue(designSelectionAtom)
  const layers = useAtomValue(canvasLayersAtom)
  const selectedIds = useAtomValue(selectedElementIdsAtom)

  if (!enabled) return null

  const ctx: DesignContextForAgent = {
    designModeEnabled: true,
    device,
  }

  if (html) {
    ctx.htmlSummary = summarizeHtml(html)
  }

  // 选中的元素结构化信息
  if (selection || selectedIds.length > 0) {
    const userSelection: NonNullable<DesignContextForAgent['userSelection']> = {
      region: selection ?? { x: 0, y: 0, width: 0, height: 0 },
    }

    if (selectedIds.length > 0) {
      const elements = selectedIds
        .map((id) => layers.find((l) => l.id === id))
        .filter((el): el is CanvasElement => !!el)
      userSelection.elements = elements.map((el) => ({
        id: el.id,
        tag: el.tag,
        text: el.text,
        role: el.role,
        className: el.className,
        selector: el.selector,
        bounds: { ...el.bounds },
      }))
      // 兼容旧字段
      const first = elements[0]
      if (first) {
        userSelection.elementText = first.text
        userSelection.elementTag = first.tag
        userSelection.selector = first.selector
      }
    }

    ctx.userSelection = userSelection
  }

  return ctx
}

/**
 * 把 Design 上下文格式化为可附加到 userMessage 的精简文本块（仅给 Agent wire）。
 * 有选中 → 元素 + 选择器；无选中 → 页面短摘要。不注入整页 HTML/CSS。
 */
export function formatDesignContextForMessage(ctx: DesignContextForAgent | null): string {
  if (!ctx || !ctx.designModeEnabled) return ''

  const lines: string[] = []
  lines.push('<design-context>')
  lines.push(`[Design Preview 已启用] 当前设备: ${ctx.device}`)

  const sel = ctx.userSelection
  const hasElements = Boolean(sel?.elements && sel.elements.length > 0)
  const hasMeaningfulRegion =
    Boolean(sel?.region) &&
    (sel!.region.width > 0 || sel!.region.height > 0)

  if (hasElements && sel?.elements) {
    lines.push('[选中的元素]')
    for (const el of sel.elements) {
      const text = shortText(el.text)
      const cls = shortText(el.className, 60)
      lines.push(
        `  - id: ${el.id}, tag: ${el.tag}, role: ${el.role}` +
          `${text ? `, text: "${text}"` : ''}` +
          `${cls ? `, class: "${cls}"` : ''}`,
      )
      if (el.selector) lines.push(`    CSS 选择器: ${el.selector}`)
    }
    lines.push(
      '使用说明：用 CSS 选择器定位选中元素，只修改该部分，不要全量重写 HTML。',
    )
  } else if (hasMeaningfulRegion && sel?.region) {
    const r = sel.region
    lines.push(
      `[框选区域] x=${Math.round(r.x)}, y=${Math.round(r.y)}, w=${Math.round(r.width)}, h=${Math.round(r.height)}`,
    )
  }

  // 无选中时带页面短摘要；有选中时摘要可选（帮助理解页面，但保持短）
  if (ctx.htmlSummary) {
    if (!hasElements) {
      lines.push(`[页面摘要] ${ctx.htmlSummary}`)
    }
  }

  lines.push('</design-context>')
  return lines.join('\n')
}

/** 用户可见原文 + 精简 design-context（追加在后，供 Agent wire） */
export function augmentMessageWithDesignContext(
  userMessage: string,
  ctx: DesignContextForAgent | null,
): string {
  const ctxText = formatDesignContextForMessage(ctx)
  if (!ctxText) return userMessage
  return `${userMessage}\n\n${ctxText}`
}

export type { SelectionRegion }
