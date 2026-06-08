/**
 * PipelinePanel - 流水线面板
 *
 * 显示流水线执行历史、状态、日志。
 */

import { Play, Pause, CheckCircle, XCircle, Loader2, Clock } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 模拟流水线数据
const mockPipelines = [
  { id: '1', name: '批量重命名', status: 'completed', startTime: Date.now() - 60000, endTime: Date.now() - 55000, itemsProcessed: 24 },
  { id: '2', name: '纹理压缩', status: 'running', startTime: Date.now() - 30000, endTime: null, itemsProcessed: 12 },
  { id: '3', name: '资产导入', status: 'failed', startTime: Date.now() - 120000, endTime: Date.now() - 118000, itemsProcessed: 0, error: '路径不存在' },
  { id: '4', name: '命名检查', status: 'pending', startTime: null, endTime: null, itemsProcessed: 0 },
]

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock size={16} />, color: 'text-muted-foreground', label: '等待中' },
  running: { icon: <Loader2 size={16} className="animate-spin" />, color: 'text-blue-500', label: '运行中' },
  completed: { icon: <CheckCircle size={16} />, color: 'text-emerald-500', label: '已完成' },
  failed: { icon: <XCircle size={16} />, color: 'text-red-500', label: '失败' },
}

export function PipelinePanel(): React.ReactElement {
  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="outline" size="sm" className="h-8">
          <Play size={16} />
          <span className="ml-1">新建流水线</span>
        </Button>
      </div>

      {/* 流水线列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {mockPipelines.map((pipeline) => (
            <PipelineCard key={pipeline.id} pipeline={pipeline} />
          ))}
        </div>
      </div>

      {/* 底部统计 */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        共 {mockPipelines.length} 个流水线任务
      </div>
    </div>
  )
}

interface PipelineCardProps {
  pipeline: {
    id: string
    name: string
    status: string
    startTime: number | null
    endTime: number | null
    itemsProcessed: number
    error?: string
  }
}

function PipelineCard({ pipeline }: PipelineCardProps): React.ReactElement {
  const statusConfig = STATUS_CONFIG[pipeline.status]
  const config = statusConfig ? { ...statusConfig } : STATUS_CONFIG.pending!

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
      <div className={cn('size-8 rounded-full flex items-center justify-center bg-muted', config.color)}>
        {config.icon}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{pipeline.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{config.label}</span>
          {pipeline.itemsProcessed > 0 && <span>· 处理 {pipeline.itemsProcessed} 个</span>}
          {duration && <span>· {duration}</span>}
          {pipeline.error && <span className="text-red-500">· {pipeline.error}</span>}
        </div>
      </div>

      {/* 操作按钮 */}
      {pipeline.status === 'running' && (
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
          <Pause size={14} />
          停止
        </Button>
      )}
      {pipeline.status === 'pending' && (
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
          <Play size={14} />
          启动
        </Button>
      )}
    </div>
  )
}