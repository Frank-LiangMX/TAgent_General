/**
 * ContextUsageBadge — 上下文使用量指示器
 *
 * - variant="toolbar"：输入框工具栏 36×36 圆形按钮（保留兼容）
 * - variant="inline"：底栏 token 行内联展示（圆环 + Context + 占用比）
 * - 点击弹出 Popover：token 明细 + 手动压缩（后续接 SDK 分项面板）
 */

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

/** Popover 里的一行 key/value */
interface DetailRowProps {
  label: string
  value: string
  emphasized?: boolean
}
function DetailRow({ label, value, emphasized }: DetailRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-foreground/70">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          emphasized ? 'font-medium text-foreground' : 'text-foreground/90'
        )}
      >
        {value}
      </span>
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

  // 压缩中 → 显示 spinner
  if (isCompacting) {
    if (isInline) {
      return (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          <span>压缩中</span>
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

  // 使用稳定值：优先当前数据，回退到上次有效数据
  const stable = stableRef.current
  const hasCurrent = inputTokens != null && inputTokens > 0
  const displayTokens = hasCurrent ? inputTokens : stable?.inputTokens
  const displayWindow = hasCurrent ? contextWindow : stable?.contextWindow

  // P2-1: Context 80% / 90% 触发 Nudges toast (一次会话最多弹 1 次 80% + 1 次 90%)
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
      // 用户已压缩 / 新建会话, 重置 ref 准备下次再弹
      lastNudgeFiredRef.current = 'none'
    }
  }, [displayTokens, displayWindow, onCompact])
  const displayOutput = hasCurrent ? outputTokens : stable?.outputTokens
  const displayCacheRead = hasCurrent ? cacheReadTokens : stable?.cacheReadTokens
  const displayCacheCreation = hasCurrent ? cacheCreationTokens : stable?.cacheCreationTokens

  // 从未有过 usage 数据 → 不显示
  if (!displayTokens || displayTokens <= 0) return null

  // 警告阈值：基于压缩阈值（contextWindow × 0.775 × 80%）
  const compactThreshold = displayWindow
    ? Math.floor(displayWindow * COMPACT_THRESHOLD_RATIO)
    : undefined
  const isWarning = compactThreshold ? displayTokens / compactThreshold >= WARNING_RATIO : false

  const ratio = displayWindow ? displayTokens / displayWindow : 0
  const isDanger = displayWindow ? ratio >= DANGER_RATIO : false

  // 纯输入 = 总上下文 - 缓存读取 - 缓存写入
  const pureInput = displayTokens - (displayCacheRead ?? 0) - (displayCacheCreation ?? 0)

  const percent = displayWindow ? Math.round((displayTokens / displayWindow) * 100) : undefined

  const handleCompactClick = (): void => {
    if (isProcessing) return
    onCompact()
    setOpen(false)
  }

  const toneClass = isDanger
    ? 'text-red-600 dark:text-red-400'
    : isWarning
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-muted-foreground hover:text-foreground'

  const triggerTitle = isDanger
    ? '上下文危险 (>90%), 建议立即 compact'
    : isWarning
      ? '上下文接近阈值'
      : '查看 Context 占用'

  const popoverContent = (
    <PopoverContent
      side="top"
      align={isInline ? 'start' : 'center'}
      sideOffset={8}
      className={cn('w-auto p-2.5', isInline ? 'min-w-[280px] max-w-[360px]' : 'min-w-[220px]')}
      onMouseEnter={isInline ? undefined : cancelClose}
      onMouseLeave={isInline ? undefined : scheduleClose}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
        <div className="flex flex-col gap-2">
          {breakdownLoading ? (
            <p className="text-xs text-muted-foreground">正在加载 Context 分项…</p>
          ) : snapshot ? (
            <ContextUsagePanel snapshot={snapshot} />
          ) : breakdownError ? (
            <p className="text-xs text-muted-foreground">{breakdownError.message}</p>
          ) : null}

          {(snapshot || breakdownError) && <div className="h-px bg-border my-0.5" />}

          <p className="text-[10px] font-medium text-foreground/70">API 汇总</p>
          <div className="flex flex-col gap-1.5">
          {pureInput > 0 && <DetailRow label="输入" value={pureInput.toLocaleString()} />}
          {displayOutput ? <DetailRow label="输出" value={displayOutput.toLocaleString()} /> : null}
          {displayCacheCreation ? (
            <DetailRow label="缓存写入" value={displayCacheCreation.toLocaleString()} />
          ) : null}
          {displayCacheRead ? (
            <DetailRow label="缓存读取" value={displayCacheRead.toLocaleString()} />
          ) : null}

          {displayWindow ? (
            <>
              <div className="h-px bg-border my-0.5" />
              <DetailRow
                label="上下文"
                value={`${formatTokens(displayTokens)} / ${formatTokens(displayWindow)}`}
                emphasized
              />
              {percent != null && (
                <DetailRow label="占用" value={`${percent}%`} emphasized={isWarning} />
              )}
            </>
          ) : null}

          <div className="h-px bg-border my-0.5" />
          <Button
            type="button"
            variant={isWarning ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-7 text-xs gap-1.5',
              isWarning && 'bg-amber-500 hover:bg-amber-600 text-white'
            )}
            onClick={handleCompactClick}
            disabled={isProcessing}
          >
            <Minimize2 className="size-3.5" />
            {isProcessing ? '对话进行中' : '手动压缩'}
          </Button>
          {/* P1-3: 客户端压缩 (LLM compact_session 失败时的 fallback) */}
          {onClientCompact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={onClientCompact}
                  disabled={isProcessing}
                >
                  <Minimize2 className="size-3" />
                  客户端压缩
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p>客户端 drop_old_tool_results：不调 LLM，直接丢弃较早的 tool_use / tool_result 对</p>
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
                    'flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors',
                    toneClass
                  )}
                >
                  <UsageRing ratio={ratio} isWarning={isWarning} isDanger={isDanger} />
                  <span className="text-muted-foreground/80">Context</span>
                  {displayWindow ? (
                    <span className="font-medium tabular-nums text-foreground/90">
                      {formatTokens(displayTokens)}/{formatTokens(displayWindow)}
                    </span>
                  ) : (
                    <span className="font-medium tabular-nums text-foreground/90">
                      {formatTokens(displayTokens)}
                    </span>
                  )}
                  {percent != null && (
                    <span className={cn('tabular-nums', isDanger && 'font-medium')}>{percent}%</span>
                  )}
                </button>
              </TooltipTrigger>
            </PopoverTrigger>
            <TooltipContent side="top">
              <p>{triggerTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">点击查看详情</p>
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
            <p>{triggerTitle}</p>
          </TooltipContent>
        </Tooltip>
        {popoverContent}
      </Popover>
    </TooltipProvider>
  )
}
