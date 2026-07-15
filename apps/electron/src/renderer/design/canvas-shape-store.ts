/**
 * canvas-shape-store.ts — 节点树 store（v3）
 *
 * 基于 jotai atomFamily，按 sessionId（文档 key）隔离。
 * 参考 Kun 的 canvas-shape-store.ts 接口（独立实现）。
 */

import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import {
  createEmptyDocument,
  createShapeId,
  removeShapeTree,
  type CanvasDocument,
  type CanvasShape,
  type BoxBounds,
} from './canvas-types'

// ==================== 存储 ====================

/** 按 sessionId 隔离的文档列表 */
const documentsAtom = atom<Map<string, CanvasDocument>>(new Map())

/** 写入文档 */
export const setDocumentAtom = atom(
  null,
  (_get, set, { key, doc }: { key: string; doc: CanvasDocument }) => {
    set(documentsAtom, (prev) => {
      const next = new Map(prev)
      next.set(key, doc)
      return next
    })
  },
)

/** 按 sessionId 获取文档（atomFamily 实现按需订阅） */
export const canvasDocumentFamily = atomFamily((key: string | null) =>
  atom((get) => {
    if (!key) return createEmptyDocument()
    return get(documentsAtom).get(key) ?? createEmptyDocument()
  }),
)

/** 当前会话的文档 */
export const currentDocumentAtom = atom<CanvasDocument>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  return get(canvasDocumentFamily(sessionId))
})

// ==================== 写入操作（不可变） ====================

function updateDocument(
  key: string,
  updater: (doc: CanvasDocument) => CanvasDocument,
): (get: (atom: unknown) => unknown, set: (atom: unknown, val: unknown) => void) => void {
  return (get, set) => {
    const doc = get(canvasDocumentFamily(key))
    if (!doc) return
    set(setDocumentAtom, { key, doc: updater(doc) })
  }
}

/** 添加形状 */
export const addShapeAtom = atom(
  null,
  (
    get,
    set,
    params: {
      shape: Omit<CanvasShape, 'id'>
      parentId?: string
      documentKey?: string
    },
  ) => {
    const key = params.documentKey ?? get(currentAgentSessionIdAtom)
    if (!key) return
    const id = createShapeId()
    const parentId = params.parentId ?? '__root__'
    const shape: CanvasShape = { ...params.shape, id }
    const doc = get(canvasDocumentFamily(key))
    const parent = doc.shapes[parentId]
    if (!parent) return
    set(setDocumentAtom, {
      key,
      doc: {
        ...doc,
        shapes: {
          ...doc.shapes,
          [id]: shape,
          [parentId]: { ...parent, children: [...parent.children, id] },
        },
      },
    })
    return id
  },
)

/** 更新形状属性 */
export const updateShapeAtom = atom(
  null,
  (
    get,
    set,
    params: { id: string; patch: Partial<CanvasShape>; documentKey?: string },
  ) => {
    const key = params.documentKey ?? get(currentAgentSessionIdAtom)
    if (!key) return
    const doc = get(canvasDocumentFamily(key))
    const existing = doc.shapes[params.id]
    if (!existing) return
    set(setDocumentAtom, {
      key,
      doc: {
        ...doc,
        shapes: { ...doc.shapes, [params.id]: { ...existing, ...params.patch } },
      },
    })
  },
)

/** 删除形状 */
export const deleteShapeAtom = atom(
  null,
  (get, set, params: { id: string; documentKey?: string }) => {
    const key = params.documentKey ?? get(currentAgentSessionIdAtom)
    if (!key) return
    const doc = get(canvasDocumentFamily(key))
    const updated = removeShapeTree(params.id, doc)
    set(setDocumentAtom, { key, doc: updated })
  },
)

/** 移动形状（改 bounds） */
export const moveShapeAtom = atom(
  null,
  (
    get,
    set,
    params: { id: string; bounds: BoxBounds; documentKey?: string },
  ) => {
    const key = params.documentKey ?? get(currentAgentSessionIdAtom)
    if (!key) return
    const doc = get(canvasDocumentFamily(key))
    const existing = doc.shapes[params.id]
    if (!existing) return
    set(setDocumentAtom, {
      key,
      doc: {
        ...doc,
        shapes: {
          ...doc.shapes,
          [params.id]: { ...existing, bounds: params.bounds },
        },
      },
    })
  },
)

/** 重排子节点顺序 */
export const reorderChildAtom = atom(
  null,
  (
    get,
    set,
    params: { parentId: string; childIds: string[]; documentKey?: string },
  ) => {
    const key = params.documentKey ?? get(currentAgentSessionIdAtom)
    if (!key) return
    const doc = get(canvasDocumentFamily(key))
    const parent = doc.shapes[params.parentId]
    if (!parent) return
    set(setDocumentAtom, {
      key,
      doc: {
        ...doc,
        shapes: {
          ...doc.shapes,
          [params.parentId]: { ...parent, children: params.childIds },
        },
      },
    })
  },
)

/** 重置文档（清空所有形状，仅保留根） */
export const resetDocumentAtom = atom(null, (get, set) => {
  const key = get(currentAgentSessionIdAtom)
  if (!key) return
  set(setDocumentAtom, { key, doc: createEmptyDocument() })
})
