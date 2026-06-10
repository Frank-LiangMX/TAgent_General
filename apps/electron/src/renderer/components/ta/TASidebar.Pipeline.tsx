/**
 * TASidebarPipeline — 流水线概览
 *
 * 显示流水线运行状态统计和最近任务。
 * 数据来源: ~/.tagent/ta/pipeline_runs.jsonl
 */

import { useSetAtom } from 'jotai'
import { GitBranch, Loader2 } from 'lucide-react'
import * as React from 'react'

import { taActiveTabAtom } from '@/atoms/app-mode'

import type { PipelineRun, PipelineSummary } from '@tagent/shared'

export function TASidebarPipeline(): React.ReactElement {
  const setActiveTab = useSetAtom(taActiveTabAtom)
  const [summary, setSummary] = React.useState<PipelineSummary | null>(null)
  const [recentPipelines, setRecentPipelines] = React.useState<PipelineRun[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setIsLoading(true)
      try {
        const [summaryResult, listResult] = await Promise.all([
          window.electronAPI.getPipelineSummary(),
          window.electronAPI.listPipelineRuns({ limit: 5 }),
        ])
        if (!mounted) return
        setSummary(summaryResult)
        setRecentPipelines(listResult)
      } catch (error) {
        console.error('[TASidebarPipeline] 加载失败:', error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const displaySummary = summary ?? { running: 0, pending: 0, completed: 0, failed: 0, cancelled: 0, total: 0 }

  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* 状态卡 */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="运行中" value={displaySummary.running} color="blue" />
        <StatCard label="等待中" value={displaySummary.pending} color="amber" />
        <StatCard label="已完成" value={displaySummary.completed} color="emerald" />
        <StatCard label="失败" value={displaySummary.failed} color="red" />
      </div>

      {/* 最近任务 */}
      {!isLoading && recentPipelines.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">最近任务</div>
          {recentPipelines.slice(0, 3).map((pipeline) => (
            <div
              key={pipeline.id}
              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md bg-muted/30"
            >
              {pipeline.status === 'running' && (
                <Loader2 size={12} className="text-blue-500 animate-spin" />
              )}
              <span className="truncate flex-1">{pipeline.name}</span>
              <span className="text-muted-foreground text-[10px]">
                {pipeline.status === 'running' ? '运行中' : pipeline.status === 'completed' ? '已完成' : pipeline.status === 'failed' ? '失败' : pipeline.status}
              </span>
            </div>
          ))}
        </div>
      )}

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
