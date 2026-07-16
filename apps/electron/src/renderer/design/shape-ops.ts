/**
 * shape-ops.ts — agent 输出协议（v3）
 *
 * Agent 不直接写 HTML，而是发出一系列形状操作（Ops），
 * 每个 Op 精确操作一个节点。
 *
 * 设计参考：F:/Kun shape-ops（概念独立实现）
 *
 * 示例 agent 输出：
 * [
 *   { type: "addShape", shapeType: "rect", bounds: {x:0,y:0,w:390,h:80}, fills: [{type:"solid",color:"#fff",opacity:1}] },
 *   { type: "addShape", shapeType: "text", bounds: {x:16,y:20,w:100,h:24}, text: "登录", fontSize: 20, parentId: "s-1" },
 *   { type: "updateShape", id: "s-3", patch: { cornerRadius: 8, fills: [{type:"solid",color:"#3b82f6",opacity:1}] } }
 * ]
 */

import type { CanvasShape, Fill, BoxBounds, ShapeType, Stroke } from './canvas-types'
import type { CanvasDocument } from './canvas-types'
import { createShapeId, removeShapeTree } from './canvas-types'

// ==================== Op 类型定义 ====================

export type ShapeOp =
  | AddShapeOp
  | UpdateShapeOp
  | DeleteShapeOp
  | MoveShapeOp
  | ReparentShapeOp
  | ReorderChildrenOp
  | SetDocumentOp
  | ResetDocumentOp

export interface AddShapeOp {
  type: 'addShape'
  shapeType: ShapeType
  name?: string
  bounds: BoxBounds
  fills?: Fill[]
  strokes?: Stroke[]
  cornerRadius?: number
  rotation?: number
  opacity?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  textColor?: string
  textAlign?: 'left' | 'center' | 'right'
  imageSrc?: string
  parentId?: string
  /** 显式指定 id（预留：agent 可以输出 id 来保证引用正确） */
  id?: string
}

export interface UpdateShapeOp {
  type: 'updateShape'
  id: string
  patch: Partial<Omit<CanvasShape, 'id'>>
}

export interface DeleteShapeOp {
  type: 'deleteShape'
  id: string
}

export interface MoveShapeOp {
  type: 'moveShape'
  id: string
  bounds: BoxBounds
}

export interface ReparentShapeOp {
  type: 'reparentShape'
  id: string
  newParentId: string
  /** 选填：在兄弟中的索引 */
  index?: number
}

export interface ReorderChildrenOp {
  type: 'reorderChildren'
  parentId: string
  childIds: string[]
}

export interface SetDocumentOp {
  type: 'setDocument'
  document: CanvasDocument
}

export interface ResetDocumentOp {
  type: 'resetDocument'
}

// ==================== 执行器 ====================

export interface OpResult {
  success: boolean
  error?: string
}

/**
 * 执行一个 shape op，返回新的 document（不可变）。
 * 如果 op 失败，返回原 document + error。
 */
export function executeOp(
  doc: CanvasDocument,
  op: ShapeOp
): { doc: CanvasDocument; error?: string } {
  try {
    switch (op.type) {
      case 'addShape':
        return executeAddShape(doc, op)
      case 'updateShape':
        return executeUpdateShape(doc, op)
      case 'deleteShape':
        return executeDeleteShape(doc, op)
      case 'moveShape':
        return executeMoveShape(doc, op)
      case 'reparentShape':
        return executeReparentShape(doc, op)
      case 'reorderChildren':
        return executeReorderChildren(doc, op)
      case 'setDocument':
        return { doc: op.document }
      case 'resetDocument':
        return { doc: { shapes: {}, rootIds: [] } }
      default:
        return { doc, error: `Unknown op type: ${(op as ShapeOp).type}` }
    }
  } catch (e) {
    return { doc, error: e instanceof Error ? e.message : String(e) }
  }
}

function executeAddShape(
  doc: CanvasDocument,
  op: AddShapeOp
): { doc: CanvasDocument; error?: string } {
  const id = op.id ?? createShapeId()
  const parentId = op.parentId ?? '__root__'
  const parent = doc.shapes[parentId]
  if (!parent) return { doc, error: `Parent ${parentId} not found` }

  const shape: CanvasShape = {
    id,
    type: op.shapeType,
    name: op.name ?? op.shapeType + ' ' + id.slice(-4),
    parentId,
    children: [],
    bounds: op.bounds,
    rotation: op.rotation ?? 0,
    opacity: op.opacity ?? 1,
    visible: true,
    locked: false,
    fills: op.fills ?? [],
    strokes: op.strokes ?? [],
    cornerRadius: op.cornerRadius ?? 0,
    /** text/image 专属 */
    ...(op.text !== undefined ? { text: op.text } : {}),
    ...(op.fontSize !== undefined ? { fontSize: op.fontSize } : {}),
    ...(op.fontFamily !== undefined ? { fontFamily: op.fontFamily } : {}),
    ...(op.fontWeight !== undefined ? { fontWeight: op.fontWeight } : {}),
    ...(op.textColor !== undefined ? { textColor: op.textColor } : {}),
    ...(op.textAlign !== undefined ? { textAlign: op.textAlign } : {}),
    ...(op.imageSrc !== undefined ? { imageSrc: op.imageSrc } : {}),
  }

  return {
    doc: {
      ...doc,
      shapes: {
        ...doc.shapes,
        [id]: shape,
        [parentId]: { ...parent, children: [...parent.children, id] },
      },
    },
  }
}

function executeUpdateShape(
  doc: CanvasDocument,
  op: UpdateShapeOp
): { doc: CanvasDocument; error?: string } {
  const existing = doc.shapes[op.id]
  if (!existing) return { doc, error: `Shape ${op.id} not found` }
  return {
    doc: {
      ...doc,
      shapes: { ...doc.shapes, [op.id]: { ...existing, ...op.patch } },
    },
  }
}

function executeDeleteShape(
  doc: CanvasDocument,
  op: DeleteShapeOp
): { doc: CanvasDocument; error?: string } {
  return { doc: removeShapeTree(op.id, doc) }
}

function executeMoveShape(
  doc: CanvasDocument,
  op: MoveShapeOp
): { doc: CanvasDocument; error?: string } {
  const existing = doc.shapes[op.id]
  if (!existing) return { doc, error: `Shape ${op.id} not found` }
  return {
    doc: {
      ...doc,
      shapes: { ...doc.shapes, [op.id]: { ...existing, bounds: op.bounds } },
    },
  }
}

function executeReparentShape(
  doc: CanvasDocument,
  op: ReparentShapeOp
): { doc: CanvasDocument; error?: string } {
  const shape = doc.shapes[op.id]
  if (!shape) return { doc, error: `Shape ${op.id} not found` }
  const newParent = doc.shapes[op.newParentId]
  if (!newParent) return { doc, error: `New parent ${op.newParentId} not found` }

  let updated = doc
  // 从旧父节点移除
  if (shape.parentId && updated.shapes[shape.parentId]) {
    const oldParent = updated.shapes[shape.parentId]!
    updated = {
      ...updated,
      shapes: {
        ...updated.shapes,
        [shape.parentId]: {
          ...oldParent,
          children: oldParent.children.filter((c) => c !== op.id),
        },
      },
    }
  }
  // 加入新父节点
  const newChildren = [...newParent.children]
  if (op.index !== undefined && op.index >= 0) {
    newChildren.splice(op.index, 0, op.id)
  } else {
    newChildren.push(op.id)
  }
  updated = {
    ...updated,
    shapes: {
      ...updated.shapes,
      [op.newParentId]: { ...updated.shapes[op.newParentId]!, children: newChildren },
      [op.id]: { ...updated.shapes[op.id]!, parentId: op.newParentId },
    },
  }
  return { doc: updated }
}

function executeReorderChildren(
  doc: CanvasDocument,
  op: ReorderChildrenOp
): { doc: CanvasDocument; error?: string } {
  const parent = doc.shapes[op.parentId]
  if (!parent) return { doc, error: `Parent ${op.parentId} not found` }
  return {
    doc: {
      ...doc,
      shapes: {
        ...doc.shapes,
        [op.parentId]: { ...parent, children: op.childIds },
      },
    },
  }
}

/**
 * 批量执行 ops：依次执行，遇到失败停止。
 * 返回最终 document + 结果列表。
 */
export function executeOps(
  doc: CanvasDocument,
  ops: ShapeOp[]
): { doc: CanvasDocument; results: OpResult[] } {
  let current = doc
  const results: OpResult[] = []
  for (const op of ops) {
    const { doc: nextDoc, error } = executeOp(current, op)
    if (error) {
      results.push({ success: false, error })
      break
    }
    results.push({ success: true })
    current = nextDoc
  }
  return { doc: current, results }
}
