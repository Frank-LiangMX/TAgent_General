/**
 * ContextUsageBadge — 上下文使用量指示器
 *
 * - variant="toolbar"：输入框工具栏 36×36 圆形按钮（保留兼容）
 * - variant="inline"：底栏 token 行内联展示（圆环 + Context + 占用比）
 * - 点击弹出 Popover：token 明细 + 手动压缩（后续接 SDK 分项面板）
 */

import { COMPACTION_IN_PROGRESS_LABEL } from '@tagent/shared'
import { Loader2, Minimize2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useContextUsageBreakdown } from '@/hooks/useContextUsageBreakdown'
import { cn } from '@/lib/utils'

import { ContextUsagePanel } from './ContextUsagePanel'

/** 压缩阈值比例（SDK 在 ~77.5% 窗口大小时自动压缩） */
const COMPACT_THRESHOLD_RATIO = 0.775
/** 显示警告的阈值（压缩阈值的 80%） */
const WARNING_RATIO = 0.8
/** 危险阈值（直接占 contextWindow 90%, SDK 可能快撑不住） */
const DANGER_RATIO = 0.9
/** P2-1: Nudges 80% 触发阈值（contextWindow × 80%）*/
const NUDGE_80_RATIO = 0.8
/** P2-1: Nudges 90% 触发阈值 */
const NUDGE_90_RATIO = 0.9
/** Popover hover 关闭延迟（ms），与 AgentThinkingPopover 一致 */
const HOVER_CLOSE_DELAY = 150

interface ContextUsageBadgeProps {
  sessionId?: string | null
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  costUsd?: number
  contextWindow?: number
  usageUpdatedAt?: number
  isCompacting: boolean
  isProcessing: boolean
  onCompact: () => void
  /** P1-3: 客户端压缩 (LLM compact_session 失败时的 fallback) */
  onClientCompact?: () => void
  /** toolbar：输入框 36px 圆钮；inline：底栏 token 行内联展示 */
  variant?: 'toolbar' | 'inline'
}

/** 格式化 token 数为可读字符串（如 1234 → "1.2k"） */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`
  }
  return `${tokens}`
}

/** 圆环进度指示器 — 16×16 SVG，描边 2px */
interface UsageRingProps {
  ratio: number
  isWarning: boolean
  isDanger: boolean
}
function UsageRing({ ratio, isWarning, isDanger }: UsageRingProps): React.ReactElement {
  const radius = 8
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, ratio))
  const dashOffset = circumference * (1 - clamped)

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      className={cn(
        'shrink-0 transition-colors',
        isDanger
          ? 'text-red-500 dark:text-red-400'
          : isWarning
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-foreground/70'
      )}
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 10 10)"
        style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
      />
    </svg>
  )
}

export function ContextUsageBadge({
  sessionId,
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheCreationTokens,
  contextWindow,
  isCompacting,
  isProcessing,
  onCompact,
  onClientCompact,
  variant = 'toolbar',
}: ContextUsageBadgeProps): React.ReactElement | null {
  const isInline = variant === 'inline'
  // 保留最近一次有效的 token 值，避免切换会话时闪烁消失
  const stableRef = React.useRef<{
    inputTokens: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
    contextWindow?: number
  } | null>(null)
  if (inputTokens && inputTokens > 0) {
    stableRef.current = {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      contextWindow,
    }
  }

  // P2-1: Nudges 阈值追踪 ref — 记录上次弹过的阈值, 避免重复弹
  // 用 'none' / '80' / '90' 三个状态机
  const lastNudgeFiredRef = React.useRef<'none' | '80' | '90'>('none')

  const [open, setOpen] = React.useState(false)
  const closeTimerRef = React.useRef<number | null>(null)
  const { snapshot, error: breakdownError, loading: breakdownLoading } = useContextUsageBreakdown(
    sessionId,
    open
  )

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = React.useCallback(() => {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY)
  }, [cancelClose])

  React.useEffect(() => cancelClose, [cancelClose])

  const stable = stableRef.current
  const hasCurrent = inputTokens != null && inputTokens > 0
  const displayTokens = hasCurrent ? inputTokens : stable?.inputTokens
  const displayWindow = hasCurrent ? contextWindow : stable?.contextWindow

  React.useEffect(() => {
    if (!displayWindow || !displayTokens) return
    const ratio = displayTokens / displayWindow
    if (ratio >= NUDGE_90_RATIO && lastNudgeFiredRef.current !== '90') {
      lastNudgeFiredRef.current = '90'
      toast.warning('上下文危险 (>90%)，建议立即压缩或新建会话', {
        duration: 8000,
        action: {
          label: '手动压缩',
          onClick: () => onCompact(),
        },
      })
    } else if (ratio >= NUDGE_80_RATIO && lastNudgeFiredRef.current === 'none') {
      lastNudgeFiredRef.current = '80'
      toast('上下文已用 80%，建议压缩或开新会话', {
        duration: 6000,
        action: {
          label: '手动压缩',
          onClick: () => onCompact(),
        },
      })
    } else if (ratio < NUDGE_80_RATIO && lastNudgeFiredRef.current !== 'none') {
      lastNudgeFiredRef.current = 'none'
    }
  }, [displayTokens, displayWindow, onCompact])

  const ratio = displayWindow && displayTokens ? displayTokens / displayWindow : 0
  const percent =
    displayWindow && displayTokens
      ? Math.round((displayTokens / displayWindow) * 100)
      : undefined
  const compactThreshold = displayWindow
    ? Math.floor(displayWindow * COMPACT_THRESHOLD_RATIO)
    : undefined
  const isWarning =
    compactThreshold && displayTokens
      ? displayTokens / compactThreshold >= WARNING_RATIO
      : false
  const isDanger = displayWindow && displayTokens ? ratio >= DANGER_RATIO : false

  const toneClass = isDanger
    ? 'text-red-600 dark:text-red-400'
    : isWarning
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-muted-foreground hover:text-foreground'

  const contextAmountLabel =
    displayTokens && displayWindow
      ? `${formatTokens(displayTokens)} / ${formatTokens(displayWindow)}`
      : displayTokens
        ? formatTokens(displayTokens)
        : undefined

  const triggerTitle = isCompacting
    ? COMPACTION_IN_PROGRESS_LABEL
    : isDanger
      ? '上下文危险 (>90%)，建议立即压缩'
      : isWarning
        ? '上下文接近压缩阈值'
        : '查看 Context 占用'

  if (isCompacting) {
    if (isInline) {
      return (
        <div className="flex items-center gap-1 text-muted-foreground" title={triggerTitle}>
          <Loader2 className="size-3.5 animate-spin" />
          {percent != null ? (
            <span className={cn('text-xs tabular-nums font-medium', toneClass)}>{percent}%</span>
          ) : null}
        </div>
      )
    }
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-[36px] rounded-full text-muted-foreground cursor-default"
        disabled
      >
        <Loader2 className="size-4 animate-spin" />
      </Button>
    )
  }

  if (!displayTokens || displayTokens <= 0) return null

  const handleCompactClick = (): void => {
    if (isProcessing) return
    onCompact()
    setOpen(false)
  }

  const popoverContent = (
    <PopoverContent
      side="top"
      align={isInline ? 'start' : 'center'}
      sideOffset={8}
      className={cn(
        'flex max-h-[min(70vh,480px)] w-auto flex-col overflow-hidden p-0',
        isInline ? 'min-w-[280px] max-w-[340px]' : 'min-w-[240px]'
      )}
      onMouseEnter={isInline ? undefined : cancelClose}
      onMouseLeave={isInline ? undefined : scheduleClose}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
        {breakdownLoading ? (
          <div className="flex flex-col gap-3">
            <div className="h-3 w-full animate-pulse rounded-full bg-muted/60" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-md bg-muted/40" />
              ))}
            </div>
          </div>
        ) : snapshot ? (
          <ContextUsagePanel snapshot={snapshot} />
        ) : breakdownError ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{breakdownError.message}</p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border/50 px-3 py-2.5">
        {!snapshot && !breakdownLoading && displayWindow ? (
          <div className="mb-2.5 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">当前窗口</span>
              <span className="tabular-nums font-medium text-foreground/90">
                {formatTokens(displayTokens)} / {formatTokens(displayWindow)}
                {percent != null ? ` (${percent}%)` : ''}
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant={isWarning || isDanger ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-8 w-full gap-1.5 text-xs',
              isDanger && 'bg-red-500 text-white hover:bg-red-600',
              isWarning && !isDanger && 'bg-amber-500 text-white hover:bg-amber-600'
            )}
            onClick={handleCompactClick}
            disabled={isProcessing}
          >
            <Minimize2 className="size-3.5" />
            {isProcessing ? '对话进行中' : '手动压缩'}
          </Button>
          {onClientCompact && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={onClientCompact}
              disabled={isProcessing}
              title="不调 LLM，直接丢弃较早的 tool 块（兼容端点兜底）"
            >
              客户端压缩
            </Button>
          )}
        </div>
      </div>
    </PopoverContent>
  )

  if (isInline) {
    return (
      <TooltipProvider delayDuration={300}>
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <PopoverTrigger asChild>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1 rounded-md px-0.5 py-0.5 transition-colors',
                    toneClass
                  )}
                >
                  <UsageRing ratio={ratio} isWarning={isWarning} isDanger={isDanger} />
                  {percent != null ? (
                    <span className={cn('text-xs tabular-nums font-medium', toneClass)}>
                      {percent}%
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
            </PopoverTrigger>
            <TooltipContent side="top">
              {contextAmountLabel ? (
                <p className="tabular-nums">{contextAmountLabel}</p>
              ) : null}
              <p className={cn('text-xs', contextAmountLabel ? 'mt-0.5 text-muted-foreground' : '')}>
                {triggerTitle}
              </p>
            </TooltipContent>
          </Tooltip>
          {popoverContent}
        </Popover>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('size-[36px] rounded-full', toneClass)}
                onMouseEnter={() => {
                  cancelClose()
                  setOpen(true)
                }}
                onMouseLeave={scheduleClose}
              >
                <UsageRing ratio={ratio} isWarning={isWarning} isDanger={isDanger} />
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="bottom">
            {contextAmountLabel ? <p className="tabular-nums">{contextAmountLabel}</p> : null}
            <p className={cn('text-xs', contextAmountLabel ? 'mt-0.5 text-muted-foreground' : '')}>
              {triggerTitle}
            </p>
          </TooltipContent>
        </Tooltip>
        {popoverContent}
      </Popover>
    </TooltipProvider>
  )
}
