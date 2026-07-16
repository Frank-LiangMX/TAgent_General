/**
 * canvas-snapshot.ts — 版本快照（v3）
 *
 * 每次执行 shape ops 后自动快照，支持回看/"从这版继续"。
 * 设计同 v2 VersionTimeline，但数据源从 HTML → CanvasDocument。
 */

import { atom } from 'jotai'

import type { CanvasDocument } from './canvas-types'

export interface CanvasSnapshot {
  id: string
  version: number
  document: CanvasDocument
  createdAt: number
  triggerMessage?: string
}

const MAX_SNAPSHOTS = 50

export const canvasSnapshotsAtom = atom<CanvasSnapshot[]>([])

/** 添加快照（去重） */
export const addCanvasSnapshotAtom = atom(
  null,
  (_get, set, payload: { document: CanvasDocument; trigger?: string }) => {
    set(canvasSnapshotsAtom, (prev) => {
      const last = prev[prev.length - 1]
      // 内容相同跳过
      if (last && JSON.stringify(last.document) === JSON.stringify(payload.document)) {
        return prev
      }
      const snap: CanvasSnapshot = {
        id: 'csnap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        version: prev.length + 1,
        document: payload.document,
        createdAt: Date.now(),
        triggerMessage: payload.trigger,
      }
      const next = [...prev, snap]
      return next.length > MAX_SNAPSHOTS ? next.slice(-MAX_SNAPSHOTS) : next
    })
  }
)

/** 清空快照 */
export const clearCanvasSnapshotsAtom = atom(null, (_get, set) => {
  set(canvasSnapshotsAtom, [])
})

/** 查看某快照的 id（null = 最新） */
export const activeCanvasSnapshotIdAtom = atom<string | null>(null)
