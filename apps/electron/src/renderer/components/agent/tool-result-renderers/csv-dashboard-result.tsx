/**
 * csv_dashboard 工具结果渲染器
 *
 * 成功时展示紧凑卡片 +「在预览中打开」；失败/解析失败回退 DefaultResultRenderer。
 * 打开路径走 openCsvDashboard → 分屏 / Tab 统一预览壳（WebPreviewFrame）。
 */

import { useAtomValue, useStore } from 'jotai'
import * as React from 'react'

import { Button } from '@tagent/ui'

import { DefaultResultRenderer } from './default-result'

import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { FilePathChip } from '@/components/ai-elements/file-path-chip'
import { openCsvDashboard } from '@/lib/open-csv-dashboard'

interface CsvDashboardResultRendererProps {
  result: string
  isError: boolean
  input: Record<string, unknown>
}

/** 工具返回的 JSON 结构（字段均为可选，容错解析） */
interface CsvDashboardToolPayload {
  status?: string
  file_path?: string
  url?: string
  session_id?: string
  live?: boolean
  live_port?: number
  view_count?: number
  views?: string[]
  title?: string
  active_view?: string
  hint?: string
  error?: string
}

function parsePayload(text: string): CsvDashboardToolPayload | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    return parsed as CsvDashboardToolPayload
  } catch {
    return null
  }
}

function pickTitle(payload: CsvDashboardToolPayload, input: Record<string, unknown>): string {
  if (typeof payload.title === 'string' && payload.title.trim()) return payload.title.trim()
  if (typeof input.title === 'string' && input.title.trim()) return input.title.trim()
  return 'CSV 数据看板'
}

export function CsvDashboardResultRenderer({
  result,
  isError,
  input,
}: CsvDashboardResultRendererProps): React.ReactElement {
  const store = useStore()
  const agentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const [opening, setOpening] = React.useState(false)
  const [openError, setOpenError] = React.useState<string | null>(null)

  const payload = React.useMemo(() => parsePayload(result), [result])

  // 错误态或非 JSON：回退默认渲染
  if (isError || !payload) {
    return <DefaultResultRenderer result={result} isError={isError} />
  }

  const statusOk = !payload.status || payload.status === 'ok'
  if (!statusOk) {
    return <DefaultResultRenderer result={result} isError />
  }

  const csvSessionId =
    typeof payload.session_id === 'string' && payload.session_id.trim()
      ? payload.session_id.trim()
      : null
  const filePath =
    typeof payload.file_path === 'string' && payload.file_path.trim()
      ? payload.file_path.trim()
      : null
  const url = typeof payload.url === 'string' && payload.url.trim() ? payload.url.trim() : null
  const title = pickTitle(payload, input)
  const viewCount =
    typeof payload.view_count === 'number'
      ? payload.view_count
      : Array.isArray(payload.views)
        ? payload.views.length
        : null

  const hint = typeof payload.hint === 'string' && payload.hint.trim() ? payload.hint.trim() : null

  const metaParts: string[] = []
  if (viewCount !== null) metaParts.push(`${viewCount} 个视图`)
  if (payload.live === true) {
    metaParts.push(typeof payload.live_port === 'number' ? `Live · :${payload.live_port}` : 'Live')
  } else if (payload.live === false) {
    metaParts.push('静态文件')
  }

  const canOpen = Boolean(agentSessionId && csvSessionId)

  const handleOpen = async () => {
    if (!agentSessionId || !csvSessionId || opening) return
    setOpening(true)
    setOpenError(null)
    try {
      const res = await openCsvDashboard(store, agentSessionId, {
        csvSessionId,
        filePath,
        title,
        url,
        activeView: typeof payload.active_view === 'string' ? payload.active_view : undefined,
      })
      if (!res.ok) {
        setOpenError(res.error ?? '打开失败')
      }
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : String(err))
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="rounded-glass-popover bg-muted/20 px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-[13px] font-medium text-foreground/90 truncate">{title}</div>
          {metaParts.length > 0 && (
            <div className="text-[11px] text-muted-foreground">{metaParts.join(' · ')}</div>
          )}
          {hint && <div className="text-[11px] text-foreground/70">{hint}</div>}
          {filePath && (
            <div className="pt-0.5">
              {/* 路径 chip 点击同样打开 CSV 看板预览 */}
              <FilePathChip filePath={filePath} onOpenFile={() => void handleOpen()} />
            </div>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="shrink-0 h-7 px-2.5 text-[12px]"
          disabled={!canOpen || opening}
          onClick={() => {
            void handleOpen()
          }}
        >
          {opening ? '打开中…' : '在预览中打开'}
        </Button>
      </div>
      {!canOpen && (
        <div className="text-[11px] text-muted-foreground">
          {!agentSessionId ? '当前无活动会话，无法打开预览' : '缺少 session_id，无法重新打开'}
        </div>
      )}
      {openError && <div className="text-[11px] text-destructive/80">{openError}</div>}
    </div>
  )
}
