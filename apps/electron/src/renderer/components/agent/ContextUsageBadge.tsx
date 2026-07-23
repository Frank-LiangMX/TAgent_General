/**
 * ContextUsageBadge — 上下文使用量指示器
 *
 * 占用比以流式 usage 为准，不再调用 SDK getContextUsage()。
 */

import { COMPACTION_IN_PROGRESS_LABEL } from '@tagent/shared'
import { Loader2, Minimize2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tagent/ui'
import { ContextUsageTermHint } from './ContextUsageTermHint'
import { getContextUsageDescription } from '@/lib/context-usage-labels'
import { cn } from '@/lib/utils'

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

/** 圆环进度指示器 — toolbar 16 / inline 底栏 12（原型 status 细读数） */
interface UsageRingProps {
  ratio: number
  isWarning: boolean
  isDanger: boolean
  /** 像素边长，inline 用 12 压低 token 栏高度 */
  size?: number
}
function UsageRing({ ratio, isWarning, isDanger, size = 16 }: UsageRingProps): React.ReactElement {
  const radius = 8
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, ratio))
  const dashOffset = circumference * (1 - clamped)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={cn(
        'token-stats-ring shrink-0 transition-colors',
        isDanger
          ? 'text-red-500 dark:text-red-400'
          : isWarning
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-primary'
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
  const lastSessionRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (lastSessionRef.current !== sessionId) {
      stableRef.current = null
      lastSessionRef.current = sessionId ?? undefined
    }
  }, [sessionId])
  if (inputTokens && inputTokens > 0) {
    stableRef.current = {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      contextWindow,
    }
  }

  // P2-1: Nudges 阈值追踪 ref — 按 sessionId 存储，避免切换会话时误触发
  // 用 Map<sessionId, 'none' | '80' | '90'> 三个状态机
  const lastNudgeFiredMapRef = React.useRef<Map<string, 'none' | '80' | '90'>>(new Map())

  // 切换会话时重置当前会话的 nudge 状态
  React.useEffect(() => {
    if (sessionId && !lastNudgeFiredMapRef.current.has(sessionId)) {
      lastNudgeFiredMapRef.current.set(sessionId, 'none')
    }
  }, [sessionId])

  const lastNudgeFired = sessionId
    ? (lastNudgeFiredMapRef.current.get(sessionId) ?? 'none')
    : 'none'

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

  // 流式预览：允许超过 100% 显示，避免压缩过程中圆环消失
  const streamPreview =
    streamWindow && streamTokens && streamTokens > 0
      ? { totalTokens: streamTokens, maxTokens: streamWindow }
      : null

  // 不再调用 SDK getContextUsage，直接使用流式 usage 数据
  // 直接使用流式 usage 数据（不再调用 SDK getContextUsage）
  const streamRatio =
    streamWindow && streamTokens && streamTokens > 0 ? streamTokens / streamWindow : undefined
  const displayTokens = streamTokens
  const displayWindow = streamWindow
  const ratio = streamRatio ?? 0
  const percent = streamRatio != null ? Math.round(streamRatio * 100) : undefined

  React.useEffect(() => {
    if (!sessionId || ratio <= 0) return
    const ratioForNudge = ratio

    const currentNudgeState = lastNudgeFiredMapRef.current.get(sessionId) ?? 'none'

    if (ratioForNudge >= NUDGE_90_RATIO && currentNudgeState !== '90') {
      lastNudgeFiredMapRef.current.set(sessionId, '90')
      toast.warning('上下文危险 (>90%)，建议立即压缩或新建会话', {
        duration: 8000,
        action: {
          label: '手动压缩',
          onClick: () => onCompact(),
        },
      })
    } else if (ratioForNudge >= NUDGE_80_RATIO && currentNudgeState === 'none') {
      lastNudgeFiredMapRef.current.set(sessionId, '80')
      toast('上下文已用 80%，建议压缩或开新会话', {
        duration: 6000,
        action: {
          label: '手动压缩',
          onClick: () => onCompact(),
        },
      })
    } else if (ratioForNudge < NUDGE_80_RATIO && currentNudgeState !== 'none') {
      lastNudgeFiredMapRef.current.set(sessionId, 'none')
    }
  }, [ratio, sessionId, onCompact])

  const compactThreshold = displayWindow
    ? Math.floor(displayWindow * COMPACT_THRESHOLD_RATIO)
    : undefined
  // 超过 100% 时强制显示危险色（红色）
  const isWarning =
    compactThreshold && displayTokens ? displayTokens / compactThreshold >= WARNING_RATIO : false
  const isDanger =
    ratio >= DANGER_RATIO ||
    (displayTokens != null && displayWindow != null && displayTokens > displayWindow)

  const showPercentPlaceholder = false
  const effectivePercent = showPercentPlaceholder ? undefined : percent
  // 超过 100% 时圆环仍显示，用满圆（ratio=1）+ 红色
  const effectiveRatio = showPercentPlaceholder ? 0 : Math.min(1, ratio)

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
        'context-usage-popover w-[280px] overflow-hidden p-3',
        isInline ? 'max-w-[280px]' : ''
      )}
      onMouseEnter={isInline ? undefined : cancelClose}
      onMouseLeave={isInline ? undefined : scheduleClose}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <div className="space-y-3">
        {/* 占用概览 */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-foreground/80">Context 占用</div>
          {displayWindow && displayTokens != null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {formatTokens(displayTokens)}
              </span>
              <span className="text-xs text-muted-foreground/60">
                / {formatTokens(displayWindow)}
              </span>
              {percent != null && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    percent >= 90
                      ? 'text-red-500'
                      : percent >= 80
                        ? 'text-amber-500'
                        : 'text-muted-foreground/60'
                  )}
                >
                  {percent}%
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground/50">等待数据...</div>
          )}
        </div>

        {/* Token 明细 */}
        <div className="space-y-1 rounded-glass-popover bg-background/50 p-2">
          <ContextUsageTermHint term="输入" display="输入 Token" inline />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/60">本次输入</span>
            <span className="tabular-nums text-foreground/80">
              {inputTokens != null ? formatTokens(inputTokens) : '—'}
            </span>
          </div>
          {outputTokens != null && outputTokens > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/60">输出</span>
              <span className="tabular-nums text-foreground/80">{formatTokens(outputTokens)}</span>
            </div>
          )}
          {cacheReadTokens != null && cacheReadTokens > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/60">缓存读取</span>
              <span className="tabular-nums text-foreground/80">
                {formatTokens(cacheReadTokens)}
              </span>
            </div>
          )}
          {cacheCreationTokens != null && cacheCreationTokens > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/60">缓存写入</span>
              <span className="tabular-nums text-foreground/80">
                {formatTokens(cacheCreationTokens)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 bg-background/12 px-3 pb-3 pt-2 shadow-[inset_0_1px_0_hsl(var(--glass-shine)/0.14)]">
        {displayWindow && streamRatio != null ? (
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
              <TooltipContent side="top">{getContextUsageDescription('压缩上下文')}</TooltipContent>
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
                    'flex h-4 items-center gap-0.5 rounded-sm px-0 py-0 transition-colors',
                    toneClass
                  )}
                >
                  <UsageRing
                    ratio={effectiveRatio}
                    isWarning={isWarning}
                    isDanger={isDanger}
                    size={12}
                  />
                  {effectivePercent != null ? (
                    <span
                      className={cn('text-[8px] tabular-nums font-medium leading-none', toneClass)}
                    >
                      {effectivePercent}%
                    </span>
                  ) : showPercentPlaceholder ? (
                    <Loader2 className="size-3 animate-spin" />
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
