/**
 * TASidebarPipeline — 流水线概览
 *
 * 当前 PipelinePanel 仍是 mock 数据，所以概览也展示 mock 状态。
 * 真实流水线数据接入后只需替换数据源。
 */

import { useSetAtom } from 'jotai'
import { GitBranch } from 'lucide-react'
import * as React from 'react'

import { taActiveTabAtom } from '@/atoms/app-mode'

interface PipelineSummary {
  running: number
  pending: number
  completed: number
  failed: number
}

export function TASidebarPipeline(): React.ReactElement {
  const setActiveTab = useSetAtom(taActiveTabAtom)

  // 当前 PipelinePanel 还没有真实 IPC，概览展示静态提示
  const summary: PipelineSummary = { running: 0, pending: 0, completed: 0, failed: 0 }

  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* 状态卡 */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="运行中" value={summary.running} color="blue" />
        <StatCard label="等待中" value={summary.pending} color="amber" />
        <StatCard label="已完成" value={summary.completed} color="emerald" />
        <StatCard label="失败" value={summary.failed} color="red" />
      </div>

      {/* 占位提示 */}
      <div className="rounded-lg bg-muted/40 border border-border/40 px-3 py-3 text-[11px] text-muted-foreground leading-relaxed">
        流水线模块当前为占位数据，真实 IPC 接入后此处自动显示运行中的任务列表。
      </div>

      {/* 跳到主区按钮 */}
      <button
        type="button"
        onClick={() => setActiveTab('pipeline')}
        className="w-full rounded-md border border-border/50 hover:bg-foreground/[0.04] transition-colors px-3 py-2.5 text-[12px] text-foreground/80 flex items-center justify-center gap-1.5"
      >
        <GitBranch size={12} />
        打开流水线
      </button>
    </div>
  )
}

function StatCard({ label, value, color }: {
  label: string
  value: number
  color: 'blue' | 'amber' | 'emerald' | 'red'
}): React.ReactElement {
  const colorClass = {
    blue: 'text-blue-500',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    red: 'text-red-500',
  }[color]
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${colorClass}`}>{value}</div>
    </div>
  )
}
