/**
 * AutomationManagerView - 定时任务管理视图
 *
 * 简单列表视图：展示定时任务列表，支持创建/暂停/恢复/删除/手动运行。
 * 后续可迭代为更丰富的 UI。
 */

import {
  Loader2,
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import * as React from 'react'

import type { Automation, CreateAutomationInput } from '@tagent/shared'

import {
  loadAutomations,
  createAutomation,
  deleteAutomation,
  toggleAutomation,
  runAutomationNow,
} from '@/atoms/automation-atoms'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AutomationManagerView(): React.ReactElement {
  const [automations, setAutomations] = React.useState<Automation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [runningId, setRunningId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadAutomations()
      setAutomations(data)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
    const cleanup = window.electronAPI.automation.onChanged(() => {
      load()
    })
    return cleanup
  }, [load])

  const handleToggle = async (id: string) => {
    await toggleAutomation(id)
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该定时任务？')) return
    await deleteAutomation(id)
    await load()
  }

  const handleRunNow = async (id: string) => {
    setRunningId(id)
    try {
      await runAutomationNow(id)
    } finally {
      setRunningId(null)
    }
  }

  const enabled = automations.filter((a) => a.enabled)
  const paused = automations.filter((a) => !a.enabled && !a.completedAt)
  const completed = automations.filter((a) => !a.enabled && !!a.completedAt)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">自动任务</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* 启用中 */}
      {enabled.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            启用中 ({enabled.length})
          </h3>
          <div className="space-y-1">
            {enabled.map((a) => (
              <AutomationCard
                key={a.id}
                automation={a}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onRunNow={handleRunNow}
                running={runningId === a.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* 已暂停 */}
      {paused.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            已暂停 ({paused.length})
          </h3>
          <div className="space-y-1">
            {paused.map((a) => (
              <AutomationCard
                key={a.id}
                automation={a}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onRunNow={handleRunNow}
                running={runningId === a.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* 已完成 */}
      {completed.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            已完成 ({completed.length})
          </h3>
          <div className="space-y-1">
            {completed.map((a) => (
              <AutomationCard
                key={a.id}
                automation={a}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onRunNow={handleRunNow}
                running={runningId === a.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* 空状态 */}
      {automations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Clock size={48} className="mb-4 opacity-30" />
          <p className="text-sm">还没有定时任务</p>
          <p className="text-xs mt-1">在 Agent 对话中描述你想定期执行的任务即可创建</p>
        </div>
      )}
    </div>
  )
}

// ===== 单个任务卡片 =====

interface AutomationCardProps {
  automation: Automation
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onRunNow: (id: string) => void
  running: boolean
}

function AutomationCard({
  automation,
  onToggle,
  onDelete,
  onRunNow,
  running,
}: AutomationCardProps): React.ReactElement {
  const lastRun = automation.runHistory[automation.runHistory.length - 1]
  const lastStatus = lastRun?.status
  const scheduleLabel = getScheduleLabel(automation)

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg border',
        'hover:bg-muted/30 transition-colors',
        !automation.enabled && 'opacity-60'
      )}
    >
      {/* 状态指示 */}
      <div className="flex-shrink-0">
        {automation.enabled ? (
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        )}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{automation.name}</span>
          {lastStatus === 'succeeded' && <CheckCircle2 size={12} className="text-emerald-500" />}
          {lastStatus === 'failed' && <XCircle size={12} className="text-destructive" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {scheduleLabel}
          {(automation.consecutiveFailures ?? 0) > 0 && (
            <span className="text-destructive ml-2">
              连续失败 {automation.consecutiveFailures} 次
            </span>
          )}
        </div>
      </div>

      {/* 操作 */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onRunNow(automation.id)}
          disabled={running || !automation.enabled}
          title="立即运行"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onToggle(automation.id)}
          title={automation.enabled ? '暂停' : '恢复'}
        >
          {automation.enabled ? <Pause size={12} /> : <Play size={12} />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(automation.id)}
          title="删除"
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  )
}

// ===== 辅助函数 =====

function getScheduleLabel(a: Automation): string {
  if (a.scheduleType === 'once') {
    return `仅运行一次（${a.scheduledAt ? new Date(a.scheduledAt).toLocaleString('zh-CN') : '指定时间'}）`
  }
  if (a.scheduleType === 'daily') return `每天 ${a.timeOfDay ?? '09:00'}`
  if (a.scheduleType === 'weekly') {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `每${names[a.dayOfWeek ?? 1]} ${a.timeOfDay ?? '09:00'}`
  }
  if (a.scheduleType === 'monthly') return `每月 ${a.dayOfMonth ?? 1} 号 ${a.timeOfDay ?? '09:00'}`
  const min = a.intervalMinutes
  if (min < 60) return `每 ${min} 分钟`
  if (min < 1440) return `每 ${min / 60} 小时`
  return `每 ${min / 1440} 天`
}
