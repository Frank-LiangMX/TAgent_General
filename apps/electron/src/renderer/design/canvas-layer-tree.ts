/**
 * canvas-layer-tree.ts — 分层树逻辑（v3）
 *
 * 从 CanvasDocument 构建分层树，与 LayerTreePanel 对接。
 * 数据源：currentDocumentAtom → CanvasDocument.shapes
 */

import type { CanvasDocument, CanvasShape } from './canvas-types'

/** 展平的树节点（供 UI 渲染） */
export interface LayerTreeNode {
  id: string
  name: string
  type: string
  depth: number
  childIds: string[]
  visible: boolean
  locked: boolean
}

/** 将 CanvasDocument → 扁平树节点列表 */
export function buildLayerTree(doc: CanvasDocument): LayerTreeNode[] {
  const nodes: LayerTreeNode[] = []
  function walk(id: string, depth: number, visited: Set<string>) {
    if (visited.has(id)) return
    visited.add(id)
    const shape = doc.shapes[id]
    if (!shape) return
    nodes.push({
      id: shape.id,
      name: shape.name,
      type: shape.type,
      depth,
      childIds: shape.children,
      visible: shape.visible,
      locked: shape.locked,
    })
    for (const cid of shape.children) {
      walk(cid, depth + 1, visited)
    }
  }
  for (const rootId of doc.rootIds) {
    walk(rootId, 0, new Set())
  }
  return nodes
}

/** 按 id 查形状的路径（"Root > Page > Form > Button"） */
export function getShapePath(id: string, doc: CanvasDocument): string {
  const parts: string[] = []
  let cur = doc.shapes[id]
  while (cur) {
    parts.unshift(cur.name || cur.id)
    cur = cur.parentId ? doc.shapes[cur.parentId] : undefined
  }
  return parts.join(' > ')
}

/** 描述形状（用于 agent 上下文） */
export function describeShape(shape: CanvasShape): string {
  const base = `${shape.name} (${shape.type})`
  if (shape.text) return `${base} · "${shape.text.slice(0, 30)}"`
  return base
}
