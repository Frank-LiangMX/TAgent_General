/**
 * element-descriptor.ts — 把 CanvasElement 列表转成自然语言描述（v2）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.3
 *
 * 用于"指着说话"：用户选中元素 → 描述生成 → 预填 chat prompt。
 */

import type { CanvasElement, CanvasElementRole } from '@/atoms/design-preview-atoms'

const ROLE_LABEL: Record<CanvasElementRole, string> = {
  button: '按钮',
  input: '输入框',
  image: '图片',
  heading: '标题',
  text: '文本',
  link: '链接',
  container: '容器',
  none: '元素',
}

/** 单个元素 → 简明中文短语 */
export function describeElement(el: CanvasElement): string {
  const label = ROLE_LABEL[el.role] || `${el.tag.toLowerCase()} 元素`
  const text = el.text.trim()
  if (!text) return `这个 ${label}`
  const shortText = text.length > 24 ? text.slice(0, 24) + '…' : text
  return `“${shortText}”${label}`
}

/** 选中多个元素 → 整段描述（用于 prompt 注入） */
export function describeElements(elements: CanvasElement[]): string {
  if (elements.length === 0) return ''
  if (elements.length === 1) return describeElement(elements[0]!)
  if (elements.length === 2) {
    return `${describeElement(elements[0]!)}和${describeElement(elements[1]!)}`
  }
  // 3 个及以上：列出前 2 个 + 其余数量
  const first = elements.slice(0, 2).map(describeElement).join('、')
  const rest = elements.length - 2
  return `${first}等 ${elements.length} 个元素（其中 ${rest} 个未列出）`
}

/**
 * 从 elements 推导一个 prompt 文本。
 * 用户在 chat input 里看到的是这句话，可以直接编辑后发送。
 */
export function buildPromptFromSelection(elements: CanvasElement[]): string {
  const desc = describeElements(elements)
  if (!desc) return ''
  return `把${desc}改一下：`
}

/**
 * 派生每个元素的语义路径（page > hero > form > submit 按钮）
 * 用于"把 page 里的 form 里的提交按钮"这种更精确的指代。
 */
export function describeElementWithPath(
  el: CanvasElement,
  allElements: CanvasElement[],
): string {
  const chain: CanvasElement[] = []
  let cur: CanvasElement | undefined = el
  while (cur) {
    chain.unshift(cur)
    cur = cur.parentId ? allElements.find((x) => x.id === cur!.parentId) : undefined
  }
  // chain 长度 >=2 才有 path 价值（否则就是顶层）
  if (chain.length < 2) return describeElement(el)
  const pathLabels = chain
    .slice(0, -1)
    .map((c) => ROLE_LABEL[c.role] || c.tag.toLowerCase())
    .join(' > ')
  const self = describeElement(el)
  return `${self}（在 ${pathLabels} 里）`
}