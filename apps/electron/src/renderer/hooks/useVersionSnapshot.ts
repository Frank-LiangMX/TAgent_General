/**
 * version-snapshot.ts — Design Preview 版本快照管理（v2.1）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.4
 *
 * v2.1 关键改动（修 2 个 bug）：
 *  - 移除 useVersionSnapshotWatcher 的 effect 嗅探实现。原因：HMR / 重渲染抖动
 *    会让 ref 重置，导致 watcher 误判"html 变了" → setSnapshots([new]) 把旧列表
 *    覆盖为只剩 1 个。
 *  - 改为 setDesignHtmlAtom / setDesignCssAtom 在写入时显式调 appendSnapshotAtom
 *    （atom 写在 design-preview-atoms.ts，这里只 re-export hooks）。
 *  - promote 改为：在已有 snapshots 上 append，不再清空历史。
 */

import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'

import {
  activeSnapshotIdAtom,
  appendSnapshotAtom,
  designCssAtom,
  designHtmlAtom,
  designSnapshotsAtom,
  setDesignHtmlAtom,
  type DesignSnapshot,
} from '@/atoms/design-preview-atoms'

// ==================== 派生 ====================

/**
 * 派生：当前画布实际显示的 html/css。
 * 默认来自 designHtml/Css；如果 activeSnapshotId 指向某个快照，则用快照的版本。
 */
export interface ViewingState {
  html: string | null
  css: string | null
  fromSnapshot: DesignSnapshot | null
  /** false = 最新；true = 历史快照 */
  isViewingHistory: boolean
}

export const viewingDesignStateAtom = atom<ViewingState>((get) => {
  const active = get(activeSnapshotIdAtom)
  const snapshots = get(designSnapshotsAtom)
  if (active) {
    const snap = snapshots.find((s) => s.id === active)
    if (snap) {
      return {
        html: snap.html,
        css: snap.css,
        fromSnapshot: snap,
        isViewingHistory: true,
      }
    }
  }
  return {
    html: get(designHtmlAtom),
    css: get(designCssAtom),
    fromSnapshot: null,
    isViewingHistory: false,
  }
})

/** 切换当前查看的快照版本。传入 null 表示回到最新。 */
export function useSetActiveSnapshot(): (id: string | null) => void {
  const set = useSetAtom(activeSnapshotIdAtom)
  return useCallback((id: string | null) => set(id), [set])
}

/** hook 返回最新与历史模式的状态 */
export function useViewingState(): ViewingState {
  return useAtomValue(viewingDesignStateAtom)
}

/** 简单 wrap：把 useAtom(activeSnapshotIdAtom) 暴露给组件 */
export function useActiveSnapshotId(): [string | null, (id: string | null) => void] {
  return useAtom(activeSnapshotIdAtom)
}

// ==================== hooks ====================

/** 直接 append snapshot 的便捷 hook */
export function useAppendSnapshot(): (p: {
  html: string
  css: string | null
  trigger?: string
}) => void {
  return useSetAtom(appendSnapshotAtom)
}

/**
 * "从这版继续"：把这版快照的内容作为新基线，并在已有 snapshots 上 append。
 * 不再清空历史。
 */
export function usePromoteSnapshotToCurrent(): (id: string) => boolean {
  const snapshots = useAtomValue(designSnapshotsAtom)
  const setHtml = useSetAtom(setDesignHtmlAtom)
  const setActive = useSetAtom(activeSnapshotIdAtom)

  return useCallback(
    (id: string): boolean => {
      const snap = snapshots.find((s) => s.id === id)
      if (!snap) return false
      // 写基线（setDesignHtmlAtom 内部自动 append 一次快照）
      setHtml({ html: snap.html, css: snap.css ?? undefined })
      // 退出历史查看模式
      setActive(null)
      return true
    },
    [snapshots, setHtml, setActive]
  )
}

// ==================== 兼容：watcher 旧 API 留 noop ====================

/**
 * @deprecated v2.1 改为命令式触发。保留 noop 防止 useVersionSnapshotWatcher() 调用崩。
 */
export function useVersionSnapshotWatcher(): void {
  // noop
}
