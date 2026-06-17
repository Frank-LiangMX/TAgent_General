/**
 * PipelinePanel - 流水线面板
 *
 * 显示流水线执行历史、状态、日志。
 * 数据来源: ~/.tagent/ta/pipeline_runs.jsonl
 */

import { Play, Pause, CheckCircle, XCircle, Loader2, Clock, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { PipelineRun, PipelineRunStatus, PipelineSummary } from '@tagent/shared'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<
  PipelineRunStatus,
  { icon: React.ReactNode; color: string; label: string }
> = {
  pending: { icon: <Clock size={16} />, color: 'text-muted-foreground', label: '等待中' },
  running: {
    icon: <Loader2 size={16} className="animate-spin" />,
    color: 'text-blue-500',
    label: '运行中',
  },
  completed: { icon: <CheckCircle size={16} />, color: 'text-emerald-500', label: '已完成' },
  failed: { icon: <XCircle size={16} />, color: 'text-red-500', label: '失败' },
  cancelled: { icon: <XCircle size={16} />, color: 'text-muted-foreground', label: '已取消' },
}

export function PipelinePanel(): React.ReactElement {
  const [pipelines, setPipelines] = React.useState<PipelineRun[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreating, setIsCreating] = React.useState(false)
  const [isCleaning, setIsCleaning] = React.useState(false)
  const [cancellingIds, setCancellingIds] = React.useState<Set<string>>(new Set())

  // 加载流水线列表
  const loadPipelines = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.listPipelineRuns({ limit: 50 })
      setPipelines(result)
    } catch (error) {
      console.error('[PipelinePanel] 加载失败:', error)
      toast.error('加载失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadPipelines()
  }, [loadPipelines])

  // 创建测试流水线
  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await window.electronAPI.createPipelineRun({
        name: `测试流水线 ${new Date().toLocaleTimeString('zh-CN')}`,
        type: 'test',
        triggeredBy: 'user',
      })
      toast.success('流水线已创建')
      await loadPipelines()
    } catch (error) {
      console.error('[PipelinePanel] 创建失败:', error)
      toast.error('创建失败')
    } finally {
      setIsCreating(false)
    }
  }

  // 取消流水线
  const handleCancel = async (id: string) => {
    setCancellingIds((prev) => new Set(prev).add(id))
    try {
      await window.electronAPI.cancelPipelineRun(id)
      toast.success('流水线已取消')
      await loadPipelines()
    } catch (error) {
      console.error('[PipelinePanel] 取消失败:', error)
      toast.error('取消失败')
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  // 清理已完成记录
  const handleCleanup = async () => {
    setIsCleaning(true)
    try {
      const count = await window.electronAPI.cleanupPipelineRuns(7)
      toast.success(`已清理 ${count} 条记录`)
      await loadPipelines()
    } catch (error) {
      console.error('[PipelinePanel] 清理失败:', error)
      toast.error('清理失败')
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={handleCreate}
          disabled={isCreating}
        >
          <Play size={16} />
          <span className="ml-1">新建测试流水线</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={handleCleanup}
          disabled={isCleaning}
        >
          <Trash2 size={16} />
          <span className="ml-1">清理已完成</span>
        </Button>
      </div>

      {/* 流水线列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <div className="text-sm text-muted-foreground">暂无流水线记录</div>
            <div className="text-xs text-muted-foreground mt-1">点击上方按钮创建测试流水线</div>
          </div>
        ) : (
          <div className="space-y-3">
            {pipelines.map((pipeline) => (
              <PipelineCard
                key={pipeline.id}
                pipeline={pipeline}
                onCancel={() => handleCancel(pipeline.id)}
                isCancelling={cancellingIds.has(pipeline.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        共 {pipelines.length} 个流水线任务
      </div>
    </div>
  )
}

interface PipelineCardProps {
  pipeline: PipelineRun
  onCancel: () => void
  isCancelling: boolean
}

function PipelineCard({ pipeline, onCancel, isCancelling }: PipelineCardProps): React.ReactElement {
  const statusConfig = STATUS_CONFIG[pipeline.status]

  const duration = React.useMemo(() => {
    if (!pipeline.startTime || !pipeline.endTime) return null
    const seconds = Math.floor((pipeline.endTime - pipeline.startTime) / 1000)
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}分${seconds % 60}秒`
  }, [pipeline.startTime, pipeline.endTime])

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
      {/* 状态图标 */}
      <div
        className={cn(
          'size-8 rounded-full flex items-center justify-center bg-muted',
          statusConfig.color
        )}
      >
        {statusConfig.icon}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{pipeline.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{statusConfig.label}</span>
          {pipeline.itemsProcessed > 0 && <span>· 处理 {pipeline.itemsProcessed} 个</span>}
          {duration && <span>· {duration}</span>}
          {pipeline.error && <span className="text-red-500">· {pipeline.error}</span>}
        </div>
      </div>

      {/* 操作按钮 */}
      {pipeline.status === 'running' && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onCancel}
          disabled={isCancelling}
        >
          <Pause size={14} />
          停止
        </Button>
      )}
      {pipeline.status === 'pending' && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onCancel}
          disabled={isCancelling}
        >
          取消
        </Button>
      )}
    </div>
  )
}
