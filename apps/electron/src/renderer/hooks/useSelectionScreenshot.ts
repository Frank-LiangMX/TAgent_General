/**
 * useSelectionScreenshot — 框选区域截图提取
 *
 * MVP 限制：由于 iframe sandbox 限制（同源策略），无法直接 canvas drawImage
 * 跨域 iframe 内容。MVP 阶段使用 html2canvas 替代方案或截图占位。
 *
 * 未来方案：
 * - A. 移除 sandbox 同源限制（同源 iframe）
 * - B. 用 html-to-image 库截图后裁剪
 * - C. 让 Agent 自行读取 DOM 结构（通过 tool_use 工具）
 *
 * 设计来源：docs/plans/2026-07-13-design-preview-design.md §5.2
 */

import { useAtomValue } from 'jotai'

import { designSelectionAtom, type SelectionRegion } from '@/atoms/design-preview-atoms'

export interface SelectionScreenshot {
  /** base64 data URL */
  dataUrl: string | null
  /** 区域坐标 */
  region: SelectionRegion
  /** 元素描述（如果能提取到） */
  elementDescription?: string
}

/**
 * 获取框选区域的截图。
 *
 * MVP 阶段：返回 null（截图功能预留接口）。
 * 等后续 Phase 实现真实截图能力。
 */
export function useSelectionScreenshot(): SelectionScreenshot | null {
  const selection = useAtomValue(designSelectionAtom)

  if (!selection) return null

  return {
    dataUrl: null,
    region: selection,
    elementDescription: undefined,
  }
}

/**
 * 框选区域内 iframe 元素的辅助函数（未来实现）。
 *
 * 当前 MVP 阶段，框选只是区域坐标，不提取具体元素。
 * 后续可通过 postMessage 让 iframe 内容脚本返回选区元素信息。
 */
export async function getElementInSelection(
  iframe: HTMLIFrameElement | null,
  _region: SelectionRegion
): Promise<{ tag: string; text: string; className: string } | null> {
  if (!iframe) return null
  try {
    const doc = iframe.contentDocument
    if (!doc) return null
    // 同源策略：MVP 阶段这个调用大多会失败
    // 未来可改为：通过 postMessage 让 iframe 内脚本主动返回
    const elements = doc.elementsFromPoint(
      _region.x + _region.width / 2,
      _region.y + _region.height / 2
    )
    if (elements.length === 0) return null
    const el = elements[0] as HTMLElement
    return {
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.slice(0, 200) ?? '',
      className: el.className,
    }
  } catch {
    return null
  }
}