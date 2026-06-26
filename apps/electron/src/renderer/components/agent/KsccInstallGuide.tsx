/**
 * KsccInstallGuide — kscc 内网渠道安装引导对话框
 *
 * 快速检测 kscc CLI 状态，就绪后自动启用渠道。
 */

import type { KsccInstallReadiness, Channel } from '@tagent/shared'
import React from 'react'
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface KsccInstallGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (installed: boolean) => void
  docsUrl?: string
}

type CheckStatus = 'pass' | 'fail'

function StatusIcon({ status }: { status: CheckStatus }): React.ReactElement {
  switch (status) {
    case 'pass':
      return <CheckCircle2 size={18} className="text-emerald-500" />
    case 'fail':
      return <XCircle size={18} className="text-red-500" />
  }
}

/** 启用 kscc 渠道并同步白名单 */
async function enableKsccChannel(): Promise<boolean> {
  try {
    const channels: Channel[] = await window.electronAPI.listChannels()
    const ksccCh = channels.find((c) => c.provider === 'kscc-internal')
    if (!ksccCh) return false
    if (ksccCh.enabled) return true
    await window.electronAPI.updateChannel(ksccCh.id, { enabled: true })
    const settings = await window.electronAPI.getSettings()
    const currentIds: string[] = settings.agentChannelIds ?? []
    if (!currentIds.includes(ksccCh.id)) {
      await window.electronAPI.updateSettings({ agentChannelIds: [ksccCh.id, ...currentIds] })
    }
    return true
  } catch (e) {
    console.warn('[KsccInstallGuide] 启用 kscc 渠道失败:', e)
    return false
  }
}

export function KsccInstallGuide({
  open,
  onOpenChange,
  onComplete,
  docsUrl = '',
}: KsccInstallGuideProps): React.ReactElement {
  const [readiness, setReadiness] = React.useState<KsccInstallReadiness | null>(null)
  const [checking, setChecking] = React.useState(false)

  const doCheck = React.useCallback(async () => {
    setChecking(true)
    try {
      const data = (await window.electronAPI.checkKsccReadiness()) as KsccInstallReadiness
      setReadiness(data)
      if (data.kscc?.installed) {
        const ok = await enableKsccChannel()
        if (ok) {
          toast.success('kscc 已就绪，渠道已启用')
          onComplete?.(true)
        }
      }
    } catch {
      toast.error('检测失败')
    } finally {
      setChecking(false)
    }
  }, [onComplete])

  React.useEffect(() => {
    if (open && !readiness) doCheck()
  }, [open, readiness, doCheck])

  const allReady = readiness?.kscc?.installed

  const checks: Array<{ label: string; status: CheckStatus; detail?: string }> = readiness
    ? [
        {
          label: 'Node.js',
          status: readiness.nodeJs?.installed && readiness.nodeJs.meetsMinimum ? 'pass' : 'fail',
          detail: readiness.nodeJs?.installed
            ? readiness.nodeJs.meetsMinimum
              ? `v${readiness.nodeJs.version}`
              : `v${readiness.nodeJs.version}（需要 >= ${readiness.nodeJs.meetsMinimum}）`
            : '未安装',
        },
        {
          label: 'Git',
          status: readiness.git?.installed ? 'pass' : 'fail',
          detail: readiness.git?.installed ? `v${readiness.git.version}` : '未安装',
        },
        {
          label: 'kscc CLI',
          status: readiness.kscc?.installed ? 'pass' : 'fail',
          detail: readiness.kscc?.installed ? readiness.kscc.path : '未安装',
        },
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>kscc 内网渠道</DialogTitle>
          <DialogDescription>
            kscc 是公司内部的 AI 编程工具，提供免费的国产模型。安装 kscc CLI 后即可使用。
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">检测中…</span>
          </div>
        ) : allReady ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 text-sm text-emerald-600">kscc 已就绪，渠道已启用。</p>
          </div>
        ) : readiness ? (
          <div className="space-y-3">
            <div className="space-y-2">
              {checks.map((check) => (
                <div key={check.label} className="flex items-center gap-2.5">
                  <StatusIcon status={check.status} />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground">{check.label}</span>
                    {check.detail && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{check.detail}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {docsUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-blue-500 hover:text-blue-600"
                onClick={() => window.electronAPI.openExternal(docsUrl)}
              >
                <ExternalLink size={14} className="mr-1.5" />
                查看 kscc 安装文档
              </Button>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          {!allReady && readiness && (
            <Button
              variant="outline"
              size="sm"
              disabled={checking}
              onClick={() => {
                setReadiness(null)
                doCheck()
              }}
            >
              重新检测
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
