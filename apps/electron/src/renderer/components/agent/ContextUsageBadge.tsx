/**
 * ContextUsageBadge — 上下文使用量指示器
 *
 * 占用比以 SDK getContextUsage() 为准（与分项面板同源），避免流式 usage 在部分模型上虚高。
 */

import { COMPACTION_IN_PROGRESS_LABEL } from '@tagent/shared'
import { Loader2, Minimize2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollProgressContainer } from '@/components/ui/scroll-progress-container'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useContextUsageBreakdown } from '@/hooks/useContextUsageBreakdown'
import { getContextUsageDescription } from '@/lib/context-usage-labels'
import { cn } from '@/lib/utils'

import { ContextUsagePanel } from './ContextUsagePanel'
import { ContextUsageTermHint } from './ContextUsageTermHint'

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
  const streamTokens = hasCurrent ? inputTokens : stable?.inputTokens
  const streamWindow = hasCurrent ? contextWindow : stable?.contextWindow

  const streamPreview =
    streamWindow && streamTokens && streamTokens > 0 && streamTokens <= streamWindow
      ? { totalTokens: streamTokens, maxTokens: streamWindow }
      : null

  const {
    snapshot,
    error: breakdownError,
    loading: breakdownLoading,
    refreshing: breakdownRefreshing,
    isStreamPreview,
  } = useContextUsageBreakdown(sessionId, !!sessionId, streamPreview)

  // SDK / 缓存快照（不含流式估算预览）— 圆环与百分比以此为准
  const authoritativeSnapshot = snapshot && !isStreamPreview ? snapshot : null

  // 圆环与百分比：优先 SDK 分项（准确）；流式 usage 仅作加载前兜底，且超过 100% 时不展示以免误导
  const streamRatio =
    streamWindow && streamTokens && streamTokens <= streamWindow
      ? streamTokens / streamWindow
      : undefined
  const displayTokens = authoritativeSnapshot?.totalTokens ?? streamTokens
  const displayWindow = authoritativeSnapshot?.maxTokens ?? streamWindow
  const ratio = authoritativeSnapshot ? authoritativeSnapshot.percentage / 100 : (streamRatio ?? 0)
  const percent = authoritativeSnapshot
    ? Math.round(authoritativeSnapshot.percentage)
    : streamRatio != null
      ? Math.round(streamRatio * 100)
      : undefined

  React.useEffect(() => {
    const ratioForNudge = authoritativeSnapshot
      ? authoritativeSnapshot.percentage / 100
      : streamRatio
    if (ratioForNudge == null) return
    if (ratioForNudge >= NUDGE_90_RATIO && lastNudgeFiredRef.current !== '90') {
      lastNudgeFiredRef.current = '90'
      toast.warning('上下文危险 (>90%)，建议立即压缩或新建会话', {
        duration: 8000,
        action: {
          label: '手动压缩',
          onClick: () => onCompact(),
        },
      })
    } else if (ratioForNudge >= NUDGE_80_RATIO && lastNudgeFiredRef.current === 'none') {
      lastNudgeFiredRef.current = '80'
      toast('上下文已用 80%，建议压缩或开新会话', {
        duration: 6000,
        action: {
          label: '手动压缩',
          onClick: () => onCompact(),
        },
      })
    } else if (ratioForNudge < NUDGE_80_RATIO && lastNudgeFiredRef.current !== 'none') {
      lastNudgeFiredRef.current = 'none'
    }
  }, [authoritativeSnapshot, streamRatio, onCompact])

  const compactThreshold = displayWindow
    ? Math.floor(displayWindow * COMPACT_THRESHOLD_RATIO)
    : undefined
  const isWarning = authoritativeSnapshot
    ? ratio >= COMPACT_THRESHOLD_RATIO * WARNING_RATIO
    : compactThreshold && displayTokens
      ? displayTokens / compactThreshold >= WARNING_RATIO
      : false
  const isDanger = ratio >= DANGER_RATIO

  const showPercentPlaceholder = !authoritativeSnapshot && (breakdownLoading || breakdownRefreshing)
  const effectivePercent = showPercentPlaceholder ? undefined : percent
  const effectiveRatio = showPercentPlaceholder ? 0 : ratio

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
        <div className="flex items-center gap-1 text-muted-foreground" aria-label={triggerTitle}>
          <Loader2 className="size-3.5 animate-spin" />
          {effectivePercent != null ? (
            <span className={cn('text-xs tabular-nums font-medium', toneClass)}>
              {effectivePercent}%
            </span>
          ) : showPercentPlaceholder ? (
            <Loader2 className="size-3.5 animate-spin" />
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

  if (!snapshot && !breakdownLoading && (!displayTokens || displayTokens <= 0)) return null

  const handleCompactClick = (): void => {
    if (isProcessing) return
    onCompact()
    setOpen(false)
  }
  const showFullSkeleton = breakdownLoading && !snapshot
  const panelDetailsLoading = breakdownRefreshing || isStreamPreview

  const popoverContent = (
    <PopoverContent
      side="top"
      align={isInline ? 'start' : 'center'}
      sideOffset={8}
      className={cn(
        'context-usage-popover grid w-[360px] max-h-[min(76vh,560px)] grid-rows-[minmax(300px,1fr)_auto] overflow-hidden p-0',
        isInline ? 'max-w-[360px]' : ''
      )}
      onMouseEnter={isInline ? undefined : cancelClose}
      onMouseLeave={isInline ? undefined : scheduleClose}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <ScrollProgressContainer className="h-full min-h-0" contentClassName="p-3 pr-4">
        {showFullSkeleton ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-background/16 p-3">
            <div className="h-4 w-32 animate-pulse rounded-full bg-muted/60" />
            <div className="h-2.5 w-full animate-pulse rounded-full bg-muted/50" />
            <div className="space-y-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-7 animate-pulse rounded-xl bg-muted/35" />
              ))}
            </div>
          </div>
        ) : snapshot ? (
          <ContextUsagePanel
            snapshot={snapshot}
            detailsLoading={panelDetailsLoading}
            isStreamPreview={isStreamPreview}
          />
        ) : breakdownError ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{breakdownError.message}</p>
        ) : null}
      </ScrollProgressContainer>

      <div className="shrink-0 bg-background/12 px-3 pb-3 pt-2 shadow-[inset_0_1px_0_hsl(var(--glass-shine)/0.14)]">
        {!authoritativeSnapshot && !showFullSkeleton && displayWindow && streamRatio != null ? (
          <div className="mb-2.5 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between gap-3">
              <ContextUsageTermHint term="流式估算" display="流式估算（仅供参考）" inline />
              <span className="tabular-nums font-medium text-foreground/90">
                {formatTokens(displayTokens!)} / {formatTokens(displayWindow)}
                {percent != null ? ` (${percent}%)` : ''}
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                  'bg-background/22 text-foreground/82 shadow-[inset_0_1px_0_hsl(var(--glass-shine)/0.18),0_0_0_1px_hsl(var(--foreground)/0.08)]',
                  'hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55',
                  isDanger && 'bg-red-500/12 text-red-600 hover:bg-red-500/16 dark:text-red-300',
                  isWarning &&
                    !isDanger &&
                    'bg-amber-500/12 text-amber-700 hover:bg-amber-500/16 dark:text-amber-300'
                )}
                onClick={handleCompactClick}
                disabled={isProcessing}
              >
                <Minimize2 className="size-3.5" />
                {isProcessing ? '对话进行中' : '压缩上下文'}
              </button>
            </TooltipTrigger>
            {!isProcessing && (
              <TooltipContent side="top">
                {getContextUsageDescription('压缩上下文')}
              </TooltipContent>
            )}
          </Tooltip>
          {onClientCompact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="h-8 shrink-0 rounded-full px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={onClientCompact}
                  disabled={isProcessing}
                >
                  快速
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {getContextUsageDescription('客户端快速压缩')}
              </TooltipContent>
            </Tooltip>
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
                  <UsageRing ratio={effectiveRatio} isWarning={isWarning} isDanger={isDanger} />
                  {effectivePercent != null ? (
                    <span className={cn('text-xs tabular-nums font-medium', toneClass)}>
                      {effectivePercent}%
                    </span>
                  ) : showPercentPlaceholder ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                </button>
              </TooltipTrigger>
            </PopoverTrigger>
            <TooltipContent side="top">
              {contextAmountLabel ? <p className="tabular-nums">{contextAmountLabel}</p> : null}
              <p
                className={cn('text-xs', contextAmountLabel ? 'mt-0.5 text-muted-foreground' : '')}
              >
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
                <UsageRing ratio={effectiveRatio} isWarning={isWarning} isDanger={isDanger} />
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
