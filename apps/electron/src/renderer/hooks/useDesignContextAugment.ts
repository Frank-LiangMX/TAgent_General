/**
 * useDesignContextAugment — 发送时把精简 Design Context 追加到 userMessage（仅 wire）
 *
 * 委托 useDesignContext 的 formatDesignContextForMessage，不再前置整页 HTML/CSS。
 * 可见气泡应使用未 augment 的原文（见 AgentView display/wire 分离）。
 */

import { useStore } from 'jotai'

import {
  canvasLayersAtom,
  designDeviceAtom,
  designEnabledAtom,
  designHtmlAtom,
  designSelectionAtom,
  selectedElementIdsAtom,
  type CanvasElement,
  type DesignContextForAgent,
} from '@/atoms/design-preview-atoms'

import { augmentMessageWithDesignContext } from '@/hooks/useDesignContext'

function summarizeHtml(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  const text = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 500)
}

/** 从 jotai store 即时组装 DesignContextForAgent（发送瞬间快照） */
function buildLiveContext(store: ReturnType<typeof useStore>): DesignContextForAgent | null {
  const enabled = store.get(designEnabledAtom)
  if (!enabled) return null

  const html = store.get(designHtmlAtom)
  const device = store.get(designDeviceAtom)
  const selection = store.get(designSelectionAtom)
  const layers = store.get(canvasLayersAtom)
  const selectedIds = store.get(selectedElementIdsAtom)

  const ctx: DesignContextForAgent = {
    designModeEnabled: true,
    device,
  }

  if (html) {
    ctx.htmlSummary = summarizeHtml(html)
  }

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

export interface DesignContextSnapshot {
  enabled: boolean
  hasSelection: boolean
  hasHtml: boolean
}

export function useDesignContextAugment(): {
  snapshot: DesignContextSnapshot
  /** 仅 wire：原文 + 精简 design-context；UI 请用未调用的原文 */
  augment: (userMessage: string) => string
} {
  const store = useStore()

  const enabled = store.get(designEnabledAtom)
  const snapshot: DesignContextSnapshot = {
    enabled,
    hasSelection: Boolean(
      store.get(designSelectionAtom) || store.get(selectedElementIdsAtom).length > 0
    ),
    hasHtml: Boolean(store.get(designHtmlAtom)),
  }

  const augment = (userMessage: string): string => {
    const ctx = buildLiveContext(store)
    return augmentMessageWithDesignContext(userMessage, ctx)
  }

  return { snapshot, augment }
}

export { augmentMessageWithDesignContext }
