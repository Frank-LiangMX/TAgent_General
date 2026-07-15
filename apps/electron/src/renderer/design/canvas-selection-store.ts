/**
 * canvas-selection-store.ts — 选中态管理（v3）
 */

import { atom } from 'jotai'

/** 当前选中的形状 id 列表（支持多选） */
export const selectedShapeIdsAtom = atom<string[]>([])

/** 切换单选：传入单个 id（再次点击取消） */
export const selectShapeAtom = atom(null, (_get, set, id: string) => {
  set(selectedShapeIdsAtom, (prev) => {
    if (prev.length === 1 && prev[0] === id) return []
    return [id]
  })
})

/** 加选/反选 */
export const toggleShapeSelectionAtom = atom(null, (_get, set, id: string) => {
  set(selectedShapeIdsAtom, (prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
  )
})

/** 替换整个选中列表 */
export const setSelectedShapesAtom = atom(null, (_get, set, ids: string[]) => {
  set(selectedShapeIdsAtom, ids)
})

/** 清空选中 */
export const clearSelectionAtom = atom(null, (_get, set) => {
  set(selectedShapeIdsAtom, [])
})

/** hover 中的形状 id（仅预览高亮） */
export const hoveredShapeIdAtom = atom<string | null>(null)
