/**
 * VersionTimeline — Design Preview 底部版本时间线（v2）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.4
 */

import { useAtomValue } from 'jotai'
import { Check, Eye, RotateCcw } from 'lucide-react'
import * as React from 'react'

import {
  designSnapshotsAtom,
  type DesignSnapshot,
} from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'
import {
  useActiveSnapshotId,
  usePromoteSnapshotToCurrent,
  useSetActiveSnapshot,
} from '@/hooks/useVersionSnapshot'

export interface VersionTimelineProps {
  className?: string
}

/** 简单时间相对字符串 */
function relTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts)
  if (diff < 60_000) return `${Math.floor(diff / 1000)}秒前`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`
  return `${Math.floor(diff / 86400_000)}天前`
}

function SnapshotChip({
  snap,
  isActive,
  isCurrentBase,
  onActivate,
  onPromote,
}: {
  snap: DesignSnapshot
  isActive: boolean
  isCurrentBase: boolean
  onActivate: (id: string) => void
  onPromote: (id: string) => void
}): React.ReactElement {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(handle)
  }, [])

  return (
    <div
      className={cn(
        'group flex shrink-0 flex-col items-stretch rounded-md border text-[11px]',
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : isCurrentBase
            ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
            : 'border-border/40 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1"
        onClick={() => onActivate(snap.id)}
        title={snap.triggerMessage || `版本 ${snap.version}`}
      >
        <span className="font-medium">v{snap.version}</span>
        {isCurrentBase && <Check className="size-3" />}
        {isActive && !isCurrentBase && <Eye className="size-3" />}
        <span className="text-[10px] opacity-70">{relTime(snap.createdAt, now)}</span>
      </button>
      {isActive && !isCurrentBase && (
        <button
          type="button"
          className="flex items-center justify-center gap-1 border-t border-primary/30 px-2 py-1 text-[10px] hover:bg-primary/15"
          onClick={(e) => {
            e.stopPropagation()
            onPromote(snap.id)
          }}
          title="把这一版设为基线继续修改"
        >
          <RotateCcw className="size-3" />
          从这版继续
        </button>
      )}
    </div>
  )
}

export function VersionTimeline({
  className,
}: VersionTimelineProps): React.ReactElement | null {
  const snapshots = useAtomValue(designSnapshotsAtom)
  const [activeId, setActiveId] = useActiveSnapshotId()
  const promote = usePromoteSnapshotToCurrent()

  // 最新版本 id（始终是最后一个）
  const latestId = snapshots[snapshots.length - 1]?.id ?? null

  if (snapshots.length === 0) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 border-b border-border/40 bg-background/70 px-3 py-1.5 backdrop-blur',
        className,
      )}
    >
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        版本
      </span>
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {snapshots.map((snap) => (
          <SnapshotChip
            key={snap.id}
            snap={snap}
            isActive={snap.id === activeId}
            isCurrentBase={snap.id === latestId}
            onActivate={(id) => setActiveId(id === latestId ? null : id)}
            onPromote={promote}
          />
        ))}
      </div>
      {activeId && (
        <button
          type="button"
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setActiveId(null)}
          title="回到最新版本"
        >
          回到最新
        </button>
      )}
    </div>
  )
}