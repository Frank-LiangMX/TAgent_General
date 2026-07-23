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
import { useAgentSessionChannelModel } from '@/hooks/useAgentSessionChannelModel'
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

/** 圆环进度 — toolbar 16 / inline 12 / 面板 hero 用更大 size */
interface UsageRingProps {
  ratio: number
  isWarning: boolean
  isDanger: boolean
  /** 像素边长 */
  size?: number
  /** 描边宽度（viewBox 坐标） */
  strokeWidth?: number
}
function UsageRing({
  ratio,
  isWarning,
  isDanger,
  size = 16,
  strokeWidth = 2,
}: UsageRingProps): React.ReactElement {
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
        strokeOpacity="0.15"
        strokeWidth={strokeWidth}
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 10 10)"
        style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
      />
    </svg>
  )
}

/** 面板内一行明细 */
function MetricRow({
  label,
  value,
  hintTerm,
}: {
  label: string
  value: string
  hintTerm?: string
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[12px] leading-none">
      {hintTerm ? (
        <ContextUsageTermHint
          term={hintTerm}
          display={label}
          className="md-text-faint shrink-0"
          inline
        />
      ) : (
        <span className="md-text-faint shrink-0">{label}</span>
      )}
      <span className="md-text tabular-nums font-medium">{value}</span>
    </div>
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
  const { channel } = useAgentSessionChannelModel(sessionId ?? '')
  /** kscc 内网 CLI 的 usage/窗口与官方 Anthropic 口径不一致，圆环会严重失真 */
  const isKsccChannel = channel?.provider === 'kscc-internal'

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
  if (!isKsccChannel && inputTokens && inputTokens > 0) {
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

  const stable = isKsccChannel ? null : stableRef.current
  const hasCurrent = !isKsccChannel && inputTokens != null && inputTokens > 0
  const streamTokens = hasCurrent ? inputTokens : stable?.inputTokens
  const streamWindow = hasCurrent ? contextWindow : stable?.contextWindow

  // 直接使用流式 usage（不再调用 SDK getContextUsage）
  const streamRatio =
    streamWindow && streamTokens && streamTokens > 0 ? streamTokens / streamWindow : undefined
  const displayTokens = streamTokens
  const displayWindow = streamWindow
  const ratio = streamRatio ?? 0
  const percent = streamRatio != null ? Math.round(streamRatio * 100) : undefined

  React.useEffect(() => {
    // kscc 占用率不可信，禁止据此弹 80%/90% 压缩 Nudge
    if (isKsccChannel || !sessionId || ratio <= 0) return
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
  }, [isKsccChannel, ratio, sessionId, onCompact])

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

  // kscc：不展示 Context 圆环/面板（usage 与窗口推断不可靠）
  if (isKsccChannel) return null

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

  const statusHint = isDanger
    ? '窗口即将撑满，建议立即压缩或新开会话'
    : isWarning
      ? '接近自动压缩阈值，可考虑手动压缩'
      : '占用正常'

  const barToneClass = isDanger
    ? 'bg-red-500 dark:bg-red-400'
    : isWarning
      ? 'bg-amber-500 dark:bg-amber-400'
      : 'bg-primary'

  const compactBtnClass = cn(
    'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    isDanger
      ? 'bg-red-500/15 text-red-600 hover:bg-red-500/22 dark:text-red-300'
      : isWarning
        ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/22 dark:text-amber-300'
        : 'bg-primary/12 text-primary hover:bg-primary/18'
  )

  const popoverContent = (
    <PopoverContent
      side="top"
      align={isInline ? 'start' : 'center'}
      sideOffset={8}
      className="context-usage-popover session-glass-popover w-[300px] overflow-hidden p-0"
      onMouseEnter={isInline ? undefined : cancelClose}
      onMouseLeave={isInline ? undefined : scheduleClose}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      {/* 概览：圆环 + 用量 + 进度条 */}
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex size-[52px] shrink-0 items-center justify-center">
            <UsageRing
              ratio={effectiveRatio}
              isWarning={isWarning}
              isDanger={isDanger}
              size={52}
              strokeWidth={2.25}
            />
            <span
              className={cn(
                'pointer-events-none absolute text-[11px] font-semibold tabular-nums leading-none',
                isDanger
                  ? 'text-red-600 dark:text-red-400'
                  : isWarning
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'md-text'
              )}
            >
              {percent != null ? `${Math.min(percent, 999)}%` : '—'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="md-text text-[12px] font-medium">Context 占用</div>
            {displayWindow && displayTokens != null ? (
              <>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="md-text text-[18px] font-semibold tabular-nums tracking-tight">
                    {formatTokens(displayTokens)}
                  </span>
                  <span className="md-text-faint text-[11px] tabular-nums">
                    / {formatTokens(displayWindow)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-300', barToneClass)}
                    style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
                  />
                </div>
                <p className="md-text-faint mt-1.5 text-[10px] leading-snug">{statusHint}</p>
              </>
            ) : (
              <p className="md-text-faint mt-1 text-[11px]">等待用量数据…</p>
            )}
          </div>
        </div>
      </div>

      {/* 明细：去掉重复的「流式估算」块，只保留一行表 */}
      <div className="mx-3 mb-1 rounded-glass-popover border border-border/40 bg-muted/25 px-3 py-1">
        <MetricRow
          label="输入"
          hintTerm="累计输入"
          value={inputTokens != null ? formatTokens(inputTokens) : '—'}
        />
        {(outputTokens == null || outputTokens > 0) && (
          <MetricRow
            label="输出"
            hintTerm="累计输出"
            value={outputTokens != null ? formatTokens(outputTokens) : '—'}
          />
        )}
        {cacheReadTokens != null && cacheReadTokens > 0 && (
          <MetricRow label="缓存读取" hintTerm="缓存读取" value={formatTokens(cacheReadTokens)} />
        )}
        {cacheCreationTokens != null && cacheCreationTokens > 0 && (
          <MetricRow
            label="缓存写入"
            value={formatTokens(cacheCreationTokens)}
          />
        )}
      </div>

      {/* 操作 */}
      <div className="flex items-center gap-2 border-t border-border/40 px-3 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={compactBtnClass}
              onClick={handleCompactClick}
              disabled={isProcessing}
            >
              <Minimize2 className="size-3.5 shrink-0" />
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
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-medium md-text-faint transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  onClientCompact()
                  setOpen(false)
                }}
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
