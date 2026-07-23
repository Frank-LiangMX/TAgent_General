/**
 * VersionTimeline — 底部版本时间线（v3）
 *
 * 数据源：canvasSnapshotsAtom（CanvasDocument 快照）
 * 不再依赖 v2 的 designSnapshotsAtom（HTML 字符串快照）
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Check, Eye, RotateCcw } from 'lucide-react'
import * as React from 'react'

import {
  canvasSnapshotsAtom,
  activeCanvasSnapshotIdAtom,
  addCanvasSnapshotAtom,
} from '@/design/canvas-snapshot'
import { cn } from '@/lib/utils'

function relTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts)
  if (diff < 60_000) return `${Math.floor(diff / 1000)}秒前`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`
  return `${Math.floor(diff / 86400_000)}天前`
}

function SnapshotChip({
  version,
  createdAt,
  isActive,
  isLatest,
  onActivate,
  onPromote,
}: {
  version: number
  createdAt: number
  isActive: boolean
  isLatest: boolean
  onActivate: () => void
  onPromote: () => void
}): React.ReactElement {
  return (
    <div
      className={cn(
        'group flex shrink-0 flex-col items-stretch rounded-glass-popover border text-[11px] transition-colors',
        isActive
          ? 'border-primary/35 bg-primary/10 text-primary'
          : isLatest
            ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
            : 'border-border/45 bg-background/50 text-muted-foreground hover:bg-background/75 hover:text-foreground'
      )}
    >
      <button type="button" className="flex items-center gap-1 px-2 py-1" onClick={onActivate}>
        <span className="font-medium">v{version}</span>
        {isLatest && <Check className="size-3" />}
        {isActive && !isLatest && <Eye className="size-3" />}
        <span className="text-[10px] opacity-70">{relTime(createdAt)}</span>
      </button>
      {isActive && !isLatest && (
        <button
          type="button"
          className="flex items-center justify-center gap-1 border-t border-primary/30 px-2 py-1 text-[10px] hover:bg-primary/15"
          onClick={(e) => {
            e.stopPropagation()
            onPromote()
          }}
        >
          <RotateCcw className="size-3" />
          从这版继续
        </button>
      )}
    </div>
  )
}

export function VersionTimeline({ className }: { className?: string }): React.ReactElement | null {
  const snapshots = useAtomValue(canvasSnapshotsAtom)
  const setActiveSnap = useSetAtom(activeCanvasSnapshotIdAtom)
  const [activeId, setActiveId] = useAtom(activeCanvasSnapshotIdAtom)
  const addSnap = useSetAtom(addCanvasSnapshotAtom)

  if (snapshots.length === 0) return null

  const promoteToCurrent = (snapId: string) => {
    const snap = snapshots.find((s) => s.id === snapId)
    if (!snap) return
    // 把快照文档设为当前基线
    addSnap({ document: snap.document, trigger: '从 v' + snap.version + ' 继续' })
    setActiveId(null)
  }

  return (
    <div className={cn('flex items-center justify-center gap-1.5 pt-2', className)}>
      <div className="flex max-w-full items-center gap-1 overflow-x-auto">
        {snapshots.map((snap) => (
          <SnapshotChip
            key={snap.id}
            version={snap.version}
            createdAt={snap.createdAt}
            isActive={snap.id === activeId}
            isLatest={snap === snapshots[snapshots.length - 1]}
            onActivate={() => setActiveSnap(snap.id === activeId ? null : snap.id)}
            onPromote={() => promoteToCurrent(snap.id)}
          />
        ))}
      </div>
      {activeId && (
        <button
          type="button"
          className="shrink-0 rounded-glass-popover border border-border/45 bg-background/50 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-background/75 hover:text-foreground"
          onClick={() => setActiveId(null)}
        >
          回到最新
        </button>
      )}
    </div>
  )
}
