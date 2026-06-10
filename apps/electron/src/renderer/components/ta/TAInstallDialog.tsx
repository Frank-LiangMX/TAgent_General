/**
 * TAInstallDialog - 一键安装 TA MCP Server 对话框
 *
 * 展示安装步骤进度 + 流式日志。
 * 安装完成（成功 / 失败 / 取消）后通过 onComplete 回调通知父组件。
 */

import { Circle, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

/** 安装阶段（与 installer 保持一致） */
type InstallPhase =
  | 'creating_venv'
  | 'checking_wheels'
  | 'upgrading_pip'
  | 'installing'
  | 'verifying'

/** 日志条目 */
interface LogEntry {
  phase: InstallPhase | 'system'
  stream: 'stdout' | 'stderr' | 'system'
  text: string
  ts: number
}

interface TAInstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (success: boolean) => void
}

/** 步骤定义 */
const STEPS: { id: InstallPhase; label: string }[] = [
  { id: 'creating_venv', label: '创建 Python 虚拟环境' },
  { id: 'checking_wheels', label: '检查依赖源' },
  { id: 'upgrading_pip', label: '升级 pip' },
  { id: 'installing', label: '安装 ta-agent-mcp' },
  { id: 'verifying', label: '验证安装' },
]

/** 步骤顺序（用于判定 active/done） */
const STEP_ORDER: InstallPhase[] = STEPS.map((s) => s.id)

export function TAInstallDialog({ open, onOpenChange, onComplete }: TAInstallDialogProps): React.ReactElement {
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [currentPhase, setCurrentPhase] = React.useState<InstallPhase | null>(null)
  const [status, setStatus] = React.useState<'idle' | 'running' | 'success' | 'failed' | 'cancelled'>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const logsEndRef = React.useRef<HTMLDivElement>(null)
  const startedRef = React.useRef(false)

  // 启动安装（仅在每次 open=true 且未启动过时）
  React.useEffect(() => {
    if (!open) {
      // 关闭时重置状态
      startedRef.current = false
      setLogs([])
      setCurrentPhase(null)
      setStatus('idle')
      setError(null)
      return
    }
    if (startedRef.current) return
    startedRef.current = true

    let unsubscribe: (() => void) | null = null
    let mounted = true

    async function startInstall() {
      setStatus('running')
      setError(null)

      unsubscribe = window.electronAPI.onTAInstallLog((chunk) => {
        if (!mounted) return
        const entry: LogEntry = {
          phase: chunk.phase as LogEntry['phase'],
          stream: chunk.stream as LogEntry['stream'],
          text: chunk.text,
          ts: chunk.ts,
        }
        setLogs((prev) => [...prev, entry])
        if (chunk.phase !== 'system' && STEP_ORDER.includes(chunk.phase as InstallPhase)) {
          setCurrentPhase(chunk.phase as InstallPhase)
        }
      })

      try {
        const result = await window.electronAPI.installTAMcp({})
        if (!mounted) return
        if (result.success) {
          setStatus('success')
          toast.success('TA MCP Server 安装成功')
        } else {
          setStatus('failed')
          setError(result.error || '未知错误')
          toast.error('TA MCP Server 安装失败')
        }
        onComplete?.(result.success)
      } catch (e) {
        if (!mounted) return
        const msg = e instanceof Error ? e.message : String(e)
        setStatus('failed')
        setError(msg)
        toast.error('TA MCP Server 安装失败')
        onComplete?.(false)
      }
    }

    startInstall()

    return () => {
      mounted = false
      if (unsubscribe) unsubscribe()
    }
  }, [open, onComplete])

  // 取消安装
  const handleCancel = React.useCallback(async () => {
    if (status === 'running') {
      await window.electronAPI.cancelTAInstall()
      setStatus('cancelled')
    }
    onOpenChange(false)
  }, [status, onOpenChange])

  // 关闭对话框
  const handleClose = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  // 自动滚动到底部
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // 步骤状态
  const stepState = (step: InstallPhase): 'pending' | 'active' | 'done' => {
    if (status === 'success') return 'done'
    if (!currentPhase) return 'pending'
    const currentIdx = STEP_ORDER.indexOf(currentPhase)
    const stepIdx = STEP_ORDER.indexOf(step)
    if (currentIdx === -1) return 'pending'
    if (stepIdx < currentIdx) return 'done'
    if (stepIdx === currentIdx) return 'active'
    return 'pending'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download size={18} />
            安装 TA MCP Server
          </DialogTitle>
          <DialogDescription>首次使用需要安装 Python 依赖，整个过程约 1-2 分钟。</DialogDescription>
        </DialogHeader>

        {/* 步骤条 */}
        <div className="space-y-2 py-2">
          {STEPS.map((step) => {
            const state = stepState(step.id)
            return (
              <div key={step.id} className="flex items-center gap-2.5 text-sm">
                {state === 'done' ? (
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                ) : state === 'active' ? (
                  <Loader2 size={16} className="animate-spin text-primary flex-shrink-0" />
                ) : (
                  <Circle size={16} className="text-muted-foreground/40 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    state === 'pending' && 'text-muted-foreground/60',
                    state === 'active' && 'text-foreground font-medium',
                    state === 'done' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
          {status === 'success' && (
            <div className="flex items-center gap-2.5 text-sm pt-1">
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
              <span className="text-emerald-600 font-medium">完成</span>
            </div>
          )}
          {status === 'failed' && (
            <div className="flex items-start gap-2.5 text-sm pt-1">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-red-600 font-medium">安装失败</div>
                {error && <div className="text-xs text-muted-foreground mt-0.5 break-all">{error}</div>}
              </div>
            </div>
          )}
        </div>

        {/* 日志区 */}
        <div className="border rounded-lg bg-muted/30">
          <ScrollArea className="h-48">
            <div className="p-3 font-mono text-xs space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-muted-foreground/60">等待日志...</div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      log.stream === 'stderr' && 'text-amber-600',
                      log.stream === 'system' && 'text-blue-600'
                    )}
                  >
                    {log.text}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          {status === 'running' ? (
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
          ) : (
            <Button onClick={handleClose}>关闭</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
