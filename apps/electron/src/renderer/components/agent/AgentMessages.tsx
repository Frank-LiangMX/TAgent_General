/**
 * AgentMessages — Agent 消息列表
 *
 * 复用 Chat 的 Conversation/Message 原语组件，
 * 流式输出通过 SDK 渲染路径（MessageGroupRenderer）展示工具活动。
 */

import { isSdkCompactingStatusMessage } from '@tagent/shared'
import {
  useSmoothStream,
  ThreePetalSpiral,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import { useAtomValue, useSetAtom, useStore } from 'jotai'
import * as React from 'react'

import type { StickToBottomContext } from 'use-stick-to-bottom'

import type { AskMessage, AgentEventUsage, RetryAttempt, SDKMessage } from '@tagent/shared'
import { AskMessageItem } from './AskMessageItem'
import { buildLiveGroupSet } from './live-group-set'
import { shouldShowPendingStreamTurn } from './pending-stream-turn'
import {
  SessionAlertIcon,
  SessionChevronDown,
  SessionChevronRight,
  SessionRefreshIcon,
} from './session-icons'
import {
  groupIntoTurns,
  MessageGroupRenderer,
  getGroupId,
  getGroupPreview,
  extractUserText,
  parseAttachedFiles as sdkParseAttachedFiles,
  isImageFile as sdkIsImageFile,
  CompactingIndicator,
  buildHistoricalTaskSubjects,
  type MessageGroup,
} from './SDKMessageRenderer'

import type { AgentStreamState } from '@/atoms/agent-atoms'
import type { MinimapItem } from '@/components/ai-elements/scroll-minimap'

import {
  askMessagesMapAtom,
  currentAskMessagesAtom,
  currentAskRefreshVersionAtom,
  currentAskStreamStateAtom,
} from '@/atoms/ask-atoms'
import { tabMinimapCacheAtom } from '@/atoms/tab-atoms'
import { userProfileAtom } from '@/atoms/user-profile'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  BasePathsProvider,
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import { ScrollMinimap } from '@/components/ai-elements/scroll-minimap'
import { StickyUserMessage } from '@/components/ai-elements/sticky-user-message'
import { ScrollPositionManager } from '@/hooks/useScrollPositionMemory'
import { stripDesignContextFromUserMessage } from '@/lib/strip-design-context'
import { markdownToPlainText } from '@/lib/markdown-rich-text'
import { cn } from '@/lib/utils'

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

/**
 * 切会话分批挂载常量（P1-7）
 * - INITIAL_BATCH：切会话瞬间首批挂载的"最近 N 条"（时间线靠底 = 最新）
 * - GROW_STEP：空闲帧递增挂载时每批追加的条数
 */
const VISIBLE_INITIAL_BATCH = 20
const VISIBLE_GROW_STEP = 40

/**
 * requestIdleCallback 兼容 helper（P1-7 分批挂载用）
 *
 * Electron/Chromium 原生支持 requestIdleCallback；若运行时缺失或 TS 类型未覆盖，
 * 退化到 requestAnimationFrame（语义略不同，但能保证让出主线程后下一帧回调）。
 *
 * 返回一个 cancel 句柄（number），调用方在 useEffect 清理时传入 cancelIdleShim
 * 取消，避免切会话后旧会话的递增回调污染新会话。
 */
type IdleShimHandle = number

function scheduleIdle(task: () => void): IdleShimHandle {
  const ric = (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback
  if (typeof ric === 'function') {
    // 原生路径：DOM lib 提供 requestIdleCallback 全局类型
    return (window as Window).requestIdleCallback(task as IdleRequestCallback)
  }
  return window.requestAnimationFrame(task)
}

function cancelIdleShim(handle: IdleShimHandle): void {
  const cic = (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback
  if (typeof cic === 'function') {
    ;(window as unknown as { cancelIdleCallback: (h: number) => void }).cancelIdleCallback(handle)
    return
  }
  window.cancelAnimationFrame(handle)
}

/** 消息对象引用 → 稳定 key 缓存，避免内容相同的消息产生重复 key */
const stableKeyCache = new WeakMap<object, string>()
let stableKeyFallbackCounter = 0

/**
 * 合并本地 Ask 消息与主进程拉取的 Ask 消息
 *
 * 规则：
 * 1. 用 id 去重
 * 2. 当本地有流式中累积的内容（content 更长），优先用本地版本
 * 3. 当主进程版本有 durationMs / partial / error 字段，本地缺失时补齐
 */
function mergeAskMessages(local: AskMessage[], fetched: AskMessage[]): AskMessage[] {
  const byId = new Map<string, AskMessage>()

  for (const m of fetched) {
    byId.set(m.id, m)
  }
  for (const m of local) {
    const fetchedVersion = byId.get(m.id)
    if (!fetchedVersion) {
      byId.set(m.id, m)
      continue
    }
    // 合并：取 content/reasoning 较长的那一个
    const useLocalContent = (m.content?.length ?? 0) > (fetchedVersion.content?.length ?? 0)
    byId.set(m.id, {
      ...fetchedVersion,
      content: useLocalContent ? m.content : fetchedVersion.content,
      reasoning: m.reasoning?.length ? m.reasoning : (fetchedVersion.reasoning ?? m.reasoning),
      durationMs: m.durationMs ?? fetchedVersion.durationMs,
      partial: m.partial ?? fetchedVersion.partial,
      error: m.error ?? fetchedVersion.error,
    })
  }

  return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt)
}

function getSDKMessageStableKey(message: SDKMessage): string {
  const record = message as Record<string, unknown>
  if (typeof record.uuid === 'string' && record.uuid.length > 0) {
    return `${message.type}:uuid:${record.uuid}`
  }

  // 已缓存的消息对象直接返回，保证跨渲染稳定
  if (stableKeyCache.has(message)) {
    return stableKeyCache.get(message)!
  }

  const parentToolUseId =
    typeof record.parent_tool_use_id === 'string' ? record.parent_tool_use_id : ''
  const sessionId = typeof record.session_id === 'string' ? record.session_id : ''

  let key: string

  if (message.type === 'result') {
    const result = record as { subtype?: unknown; terminal_reason?: unknown; result?: unknown }
    key = `result:${sessionId}:${String(result.subtype ?? '')}:${String(result.terminal_reason ?? '')}:${String(result.result ?? '')}:${++stableKeyFallbackCounter}`
  } else if (message.type === 'system') {
    const sys = record as { subtype?: unknown; task_id?: unknown; tool_use_id?: unknown }
    key = `system:${sessionId}:${String(sys.subtype ?? '')}:${String(sys.task_id ?? '')}:${String(sys.tool_use_id ?? '')}:${stableStringify(record)}:${++stableKeyFallbackCounter}`
  } else if ('message' in record) {
    const inner = record.message as { content?: unknown } | undefined
    key = `${message.type}:${sessionId}:${parentToolUseId}:${stableStringify(inner?.content)}:${++stableKeyFallbackCounter}`
  } else {
    key = `${message.type}:${sessionId}:${parentToolUseId}:${stableStringify(record)}:${++stableKeyFallbackCounter}`
  }

  stableKeyCache.set(message, key)
  return key
}

/** AgentMessages 属性接口 */
interface AgentMessagesProps {
  sessionId: string
  /** 用户在前端选择的模型 ID（用于显示渠道配置的 Model Name） */
  sessionModelId?: string
  /** 消息是否已完成首次加载 */
  messagesLoaded?: boolean
  /** Phase 4: 持久化的 SDKMessage（新格式） */
  persistedSDKMessages?: SDKMessage[]
  streaming: boolean
  streamState?: AgentStreamState
  /** Phase 2: 实时 SDKMessage 列表（流式期间累积） */
  liveMessages?: SDKMessage[]
  /** 当前会话工作目录，用于解析相对文件路径 */
  sessionPath?: string | null
  /** 附加目录列表（与 sessionPath 一并用作相对路径解析候选） */
  attachedDirs?: string[]
  /** 最后一轮是否被用户中断 */
  stoppedByUser?: boolean
  onRetry?: () => void
  onRetryInNewSession?: () => void
  onFork?: (upToMessageUuid: string) => void
  onRewind?: (assistantMessageUuid: string) => void
  onCompact?: () => void
  /** 底部悬浮输入框模式：为消息列表预留底部空间 */
  floatingInput?: boolean
  /** 是否显示置顶用户消息（Office 模式下隐藏） */
  showStickyUserMessage?: boolean
  /** 是否显示正文刻度与滚动定位器（Office dock 使用精简滚动层） */
  showMinimap?: boolean
}

/** 会话内空状态 — 轻量提示（创建前引导在 MainArea 层） */
function EmptyState(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground/60">输入消息开始对话</p>
    </div>
  )
}

/**
 * 首条 assistant SDK 消息到达前的运行占位。
 * 运行中胶囊与流式 token 都挂在 live assistant-turn 上；若等完整消息才建 turn，
 * 会出现「侧栏在跑、会话区长时间无反馈，最后一次性倒出」的假静默。
 */
function PendingStreamTurn({
  streamingText,
  streamingThinking,
  retrying,
}: {
  streamingText?: string
  streamingThinking?: string
  retrying?: AgentStreamState['retrying']
}): React.ReactElement {
  const hasText = !!(streamingText && streamingText.length > 0)
  const hasThinking = !!(streamingThinking && streamingThinking.length > 0)

  return (
    <Message from="assistant">
      <MessageContent>
        <div className="agent-turn flex flex-col gap-3">
          {hasThinking && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {streamingThinking}
            </div>
          )}
          {hasText && <MessageResponse>{streamingText}</MessageResponse>}
        </div>
      </MessageContent>
      {retrying && (
        <div className="agent-turn-footer">
          <div className="agent-turn-footer__meta">
            <RetryingNotice retrying={retrying} />
          </div>
        </div>
      )}
    </Message>
  )
}

/** 重试提示组件 - 折叠式 */
export function RetryingNotice({
  retrying,
}: {
  retrying: NonNullable<AgentStreamState['retrying']>
}): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)

  // 倒计时逻辑
  React.useEffect(() => {
    if (retrying.failed || retrying.history.length === 0) {
      setCountdown(0)
      return
    }

    const lastAttempt = retrying.history[retrying.history.length - 1]
    if (!lastAttempt) return

    // 计算倒计时
    const updateCountdown = (): void => {
      const elapsed = (Date.now() - lastAttempt.timestamp) / 1000 // 已过去的秒数
      const remaining = Math.max(0, lastAttempt.delaySeconds - elapsed)
      setCountdown(Math.ceil(remaining))

      if (remaining <= 0) {
        setCountdown(0)
      }
    }

    // 立即更新一次
    updateCountdown()

    // 每 100ms 更新一次倒计时
    const timer = setInterval(updateCountdown, 100)
    return () => clearInterval(timer)
  }, [retrying.failed, retrying.history])

  return (
    <div className="rounded-glass-popover border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-3 mb-3">
      {/* 头部：简洁状态 */}
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
        onClick={() => setExpanded(!expanded)}
      >
        {retrying.failed ? (
          <SessionAlertIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <SessionRefreshIcon className="size-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
        )}
        <span className="text-sm text-amber-900 dark:text-amber-100 flex-1">
          {retrying.failed
            ? `重试失败 (${retrying.currentAttempt}/${retrying.maxAttempts})`
            : countdown > 0
              ? `重试倒计时 ${countdown}秒 (${retrying.currentAttempt}/${retrying.maxAttempts})`
              : `重试中 (${retrying.currentAttempt}/${retrying.maxAttempts})`}
          {retrying.history.length > 0 &&
            ` · ${retrying.history[retrying.history.length - 1]?.reason}`}
        </span>
        {expanded ? (
          <SessionChevronDown className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <SessionChevronRight className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        )}
      </button>

      {/* 展开内容：重试历史 */}
      {expanded && retrying.history.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-amber-200 dark:border-amber-800 pt-3 animate-in fade-in duration-150 fill-mode-both">
          <div className="text-xs font-medium text-amber-900 dark:text-amber-100">尝试历史：</div>
          {retrying.history.map((attempt, index) => (
            <RetryAttemptItem
              key={attempt.timestamp}
              attempt={attempt}
              isLatest={index === retrying.history.length - 1}
              isFailed={retrying.failed && index === retrying.history.length - 1}
            />
          ))}
          {!retrying.failed && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 pl-6">
              {countdown > 0 ? (
                <>
                  <SessionRefreshIcon className="size-3 animate-spin" />
                  <span>
                    等待 {countdown} 秒后开始第 {retrying.currentAttempt} 次尝试
                  </span>
                </>
              ) : (
                <>
                  <SessionRefreshIcon className="size-3 animate-spin" />
                  <span>正在进行第 {retrying.currentAttempt} 次尝试...</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 单条重试尝试记录 */
function RetryAttemptItem({
  attempt,
  isLatest,
  isFailed: _isFailed,
}: {
  attempt: RetryAttempt
  isLatest: boolean
  isFailed: boolean
}): React.ReactElement {
  const [showStderr, setShowStderr] = React.useState(false)
  const [showStack, setShowStack] = React.useState(false)

  const time = new Date(attempt.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className={cn('pl-6 space-y-2', isLatest && 'font-medium')}>
      {/* 尝试头部 */}
      <div className="flex items-start gap-2">
        <span className="text-destructive shrink-0">❌</span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-xs text-amber-900 dark:text-amber-100">
            第 {attempt.attempt} 次 ({time}) - {attempt.reason}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-300 font-mono break-words">
            {attempt.errorMessage}
          </div>

          {/* 环境信息 */}
          {attempt.environment && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 space-y-0.5">
              <div>运行时: {attempt.environment.runtime}</div>
              <div>平台: {attempt.environment.platform}</div>
              <div>模型: {attempt.environment.model}</div>
              {attempt.environment.workspace && <div>工作区: {attempt.environment.workspace}</div>}
            </div>
          )}

          {/* 可展开的 stderr */}
          {attempt.stderr && (
            <div className="mt-2">
              <button
                type="button"
                className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1"
                onClick={() => setShowStderr(!showStderr)}
              >
                {showStderr ? (
                  <SessionChevronDown className="size-3" />
                ) : (
                  <SessionChevronRight className="size-3" />
                )}
                显示 stderr 输出
              </button>
              {showStderr && (
                <pre className="mt-1 text-[10px] text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/30 p-2 rounded overflow-x-auto max-h-[200px] overflow-y-auto">
                  {attempt.stderr}
                </pre>
              )}
            </div>
          )}

          {/* 可展开的堆栈跟踪 */}
          {attempt.stack && (
            <div className="mt-2">
              <button
                type="button"
                className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1"
                onClick={() => setShowStack(!showStack)}
              >
                {showStack ? (
                  <SessionChevronDown className="size-3" />
                ) : (
                  <SessionChevronRight className="size-3" />
                )}
                显示堆栈跟踪
              </button>
              {showStack && (
                <pre className="mt-1 text-[10px] text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/30 p-2 rounded overflow-x-auto max-h-[200px] overflow-y-auto">
                  {attempt.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 格式化耗时（毫秒 → 可读字符串，仅保留整数秒） */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 1) return `0s`
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

/** 构建 usage tooltip 多行文本 */
export function buildUsageTooltip(durationMs: number, usage?: AgentEventUsage): string {
  const lines: string[] = []
  lines.push(`耗时: ${formatDuration(durationMs)}`)

  if (usage) {
    const pureInput =
      usage.inputTokens - (usage.cacheReadTokens ?? 0) - (usage.cacheCreationTokens ?? 0)
    if (pureInput > 0) lines.push(`输入: ${pureInput.toLocaleString()}`)
    if (usage.outputTokens) lines.push(`输出: ${usage.outputTokens.toLocaleString()}`)
    if (usage.cacheCreationTokens)
      lines.push(`缓存写入: ${usage.cacheCreationTokens.toLocaleString()}`)
    if (usage.cacheReadTokens) lines.push(`缓存读取: ${usage.cacheReadTokens.toLocaleString()}`)
  }

  return lines.join('\n')
}

/**
 * 完成 状态胶囊
 * - completed：同款样式，文案「完成」+ 固定耗时（无动画）
 * - running 状态已迁移至 ComposerAssistantPresence 铭牌
 */
export function AgentStatusBadge({
  status,
  durationMs,
  transitionSessionId,
  usage,
}: {
  status: 'completed'
  /** 最终耗时（ms） */
  durationMs?: number
  transitionSessionId?: string
  usage?: AgentEventUsage
}): React.ReactElement {
  const timeLabel = formatDuration(durationMs ?? 0)

  const badge = (
    <div className="agent-running-badge select-none" role="status" aria-label={`完成 ${timeLabel}`}>
      <span className="agent-running-badge__check" aria-hidden>
        ✓
      </span>
      <span className="agent-running-badge__label">
        完成
        <span className="agent-running-badge__time tabular-nums">{timeLabel}</span>
      </span>
    </div>
  )

  if (durationMs != null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex cursor-default"
            data-run-badge-complete-target={transitionSessionId}
          >
            {badge}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="whitespace-pre-line text-left">{buildUsageTooltip(durationMs, usage)}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <span
      className="inline-flex cursor-default"
      data-run-badge-complete-target={transitionSessionId}
    >
      {badge}
    </span>
  )
}

/** @deprecated 使用 AgentStatusBadge status=completed；保留导出以免外部引用断裂 */
export function DurationBadge({
  durationMs,
  usage,
}: {
  durationMs: number
  usage?: AgentEventUsage
}): React.ReactElement {
  return <AgentStatusBadge status="completed" durationMs={durationMs} usage={usage} />
}

function AgentMessagesImpl({
  sessionId,
  sessionModelId,
  messagesLoaded,
  persistedSDKMessages,
  streaming,
  streamState,
  liveMessages,
  sessionPath,
  attachedDirs,
  stoppedByUser,
  onRetry,
  onRetryInNewSession,
  onFork,
  onRewind,
  onCompact,
  floatingInput,
  showStickyUserMessage = true,
  showMinimap = true,
}: AgentMessagesProps): React.ReactElement {
  const userProfile = useAtomValue(userProfileAtom)
  const setMinimapCache = useSetAtom(tabMinimapCacheAtom)
  const store = useStore()
  /** 淡入控制：切换会话时先隐藏，等布局完成后再显示。 */
  const [ready, setReady] = React.useState(false)
  // 空会话无需淡入过渡（无消息则无滚动位置问题）
  const [skipFadeIn, setSkipFadeIn] = React.useState(false)
  const prevSessionIdRef = React.useRef<string | null>(null)

  /**
   * 分批挂载窗口（P1-7）：切长会话时先只挂"最近 N 条"，空闲帧再递增挂剩余历史，
   * 让切会话那一帧的主线程快速让出，避免几百条历史一次性挂 DOM 卡死 TabBar 指示器/蒙版动画。
   *
   * - visibleCount 表示"从时间线底部（最新）向上挂载多少条"。
   *   渲染用 mergedTimeline.slice(Math.max(0, length - visibleCount))，即保留最新 visibleCount 条。
   * - 流式 live 消息永远在时间线底部，初始 N 条已覆盖最新内容 → 分批不影响流式输出（风险点 3）。
   * - 滚动位置恢复（风险点 1）：分批期间 ScrollPositionManager 的 scrollReady 门控为 false，
   *   等全量挂完（visibleCount >= length）再恢复，避免 scrollHeight 不足导致恢复到错误位置。
   */
  const [visibleCount, setVisibleCount] = React.useState<number>(VISIBLE_INITIAL_BATCH)

  // 滚动时禁用 backdrop-filter，消除 GPU 合成滞后导致的拖影
  const scrollContextRef = React.useRef<StickToBottomContext | null>(null)
  React.useEffect(() => {
    const scrollEl = scrollContextRef.current?.scrollRef?.current
    if (!scrollEl) return
    let scrollTimer = 0
    const onScroll = (): void => {
      scrollEl.classList.add('is-scrolling')
      clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(() => {
        scrollEl.classList.remove('is-scrolling')
      }, 150)
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scrollEl.removeEventListener('scroll', onScroll)
      clearTimeout(scrollTimer)
    }
  }, [])

  // 拉取初始 Ask 消息（会话切换 + 流式完成后 refreshVersion 触发）
  const askRefreshVersion = useAtomValue(currentAskRefreshVersionAtom)
  React.useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    void window.electronAPI
      .getAskMessages(sessionId)
      .then((messages) => {
        if (cancelled) return
        store.set(askMessagesMapAtom, (prev) => {
          const map = new Map(prev)
          // 合并：保留流式中累积的（content 更长）以避免覆盖
          const current = map.get(sessionId) ?? []
          const merged = mergeAskMessages(current, messages)
          map.set(sessionId, merged)
          return map
        })
      })
      .catch((err) => {
        console.warn('[AgentMessages] 拉取 Ask 消息失败:', err)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, askRefreshVersion])

  React.useEffect(() => {
    if (sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId
      setReady(false)
      setSkipFadeIn(false)
      // 切会话瞬间收缩到首批 N 条（从最新往上挂），剩余在空闲帧渐进补齐
      setVisibleCount(VISIBLE_INITIAL_BATCH)
    }
  }, [sessionId])

  React.useEffect(() => {
    if (ready) return

    // 必须等消息加载完成，否则空 SDK 消息会被误判为空对话
    if (messagesLoaded === false) return

    // 流式进行中且有实时内容 → 跳过 fade 直接显示
    if (streaming && liveMessages && liveMessages.length > 0) {
      setReady(true)
      return
    }

    if ((!persistedSDKMessages || persistedSDKMessages.length === 0) && !streaming) {
      setSkipFadeIn(true)
      setReady(true)
      return
    }
    let cancelled = false
    requestAnimationFrame(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [streaming, liveMessages, persistedSDKMessages, messagesLoaded])

  // 从 streamState 属性中计算派生值
  const streamingContent = streamState?.content ?? ''
  const streamingThinkingContent = streamState?.thinkingContent ?? ''
  const retrying = streamState?.retrying

  const { displayedContent: rawSmoothContent } = useSmoothStream({
    content: streamingContent,
    isStreaming: streaming,
  })
  const { displayedContent: rawSmoothThinking } = useSmoothStream({
    content: streamingThinkingContent,
    isStreaming: streaming,
  })

  // 防闪屏守卫：useSmoothStream 通过 useEffect 重置 displayedContent，比 render 晚一帧。
  // 当 streamingContent 已清空但 smoothContent 仍持有旧值时，
  // 会导致 fallback 气泡与持久化消息同时渲染一帧（重复内容闪烁）。
  // 用原始 streamingContent 作为守卫：内容已清空且不在流式中，立即归零。
  const smoothContent = streaming || streamingContent ? rawSmoothContent : ''
  const smoothThinking = streaming || streamingThinkingContent ? rawSmoothThinking : ''

  /**
   * 流式完成过渡：streaming 结束到持久化消息加载完成之间，
   * 强制 resize="instant" 避免中间高度变化触发平滑滚动动画。
   *
   * 使用 render-phase 计算避免 useEffect 延迟一帧的问题：
   * - streaming 变 false 的第一帧就能立即切到 instant，防止闪动
   * - 后续通过 ref+timeout 延迟 150ms 才允许切回 smooth
   */
  const [transitioningCooldown, setTransitioningCooldown] = React.useState(false)
  const wasStreamingRef = React.useRef(streaming)

  // render-phase 判断：是否处于需要 instant resize 的过渡期
  // liveMessages 非空说明持久化消息还没加载完（加载完后会清空 liveMessages）
  const needsInstant =
    !streaming &&
    (!!streamingContent ||
      !!streamingThinkingContent ||
      !!smoothContent ||
      !!smoothThinking ||
      (liveMessages != null && liveMessages.length > 0))

  React.useEffect(() => {
    // 刚从 streaming → not-streaming：启动 cooldown
    if (wasStreamingRef.current && !streaming) {
      setTransitioningCooldown(true)
    }
    wasStreamingRef.current = streaming
  }, [streaming])

  React.useEffect(() => {
    if (needsInstant) return
    // 过渡完成后延迟 150ms 才关闭 cooldown，给 StickToBottom 时间稳定
    const timer = setTimeout(() => setTransitioningCooldown(false), 150)
    return () => clearTimeout(timer)
  }, [needsInstant])

  const transitioning = needsInstant || transitioningCooldown

  // 合并持久化 + 实时 SDKMessage（供 ContentBlock 内查找工具结果）
  const allSDKMessages = React.useMemo(() => {
    const persisted = persistedSDKMessages ?? []
    const live = liveMessages ?? []
    const stampStableKey = (message: SDKMessage): SDKMessage => {
      const key = getSDKMessageStableKey(message)
      ;(message as Record<string, unknown>)._tagentStableKey = key
      return message
    }
    const keyOf = (message: SDKMessage): string =>
      (message as Record<string, unknown>)._tagentStableKey as string

    const persistedWithKeys = persisted.map(stampStableKey)
    const liveWithKeys = live.map(stampStableKey)
    if (streaming || liveWithKeys.length === 0 || persistedWithKeys.length === 0) {
      return [...persistedWithKeys, ...liveWithKeys]
    }

    // 流式结束后的刷新中，持久化消息尾部可能已经包含 live 序列。
    // 只替换有序尾部重叠，避免按内容全局去重误删历史中的相同问答。
    let overlap = Math.min(persistedWithKeys.length, liveWithKeys.length)
    for (; overlap > 0; overlap--) {
      const persistedStart = persistedWithKeys.length - overlap
      const liveStart = liveWithKeys.length - overlap
      let matches = true
      for (let i = 0; i < overlap; i++) {
        if (keyOf(persistedWithKeys[persistedStart + i]!) !== keyOf(liveWithKeys[liveStart + i]!)) {
          matches = false
          break
        }
      }
      if (matches) break
    }

    if (overlap === 0) return [...persistedWithKeys, ...liveWithKeys]
    return [...persistedWithKeys.slice(0, persistedWithKeys.length - overlap), ...liveWithKeys]
  }, [persistedSDKMessages, liveMessages, streaming])
  const hasContent = allSDKMessages.length > 0

  // 统一分组：将持久化 + 实时消息合并后再分组，确保 system 消息（如压缩分割线）出现在正确位置
  const allGroups = React.useMemo(() => {
    return groupIntoTurns(allSDKMessages, sessionModelId)
  }, [allSDKMessages, sessionModelId])

  const hasInlineCompactingIndicator = React.useMemo(
    () =>
      (streamState?.isCompacting ?? false) &&
      allGroups.some(
        (g) => g.type === 'system' && isSdkCompactingStatusMessage(g.message as SDKMessage)
      ),
    [allGroups, streamState?.isCompacting]
  )

  // 跨 turn 历史 TaskCreate id → subject 映射：顶层算一次，避免每个 AssistantTurnRenderer
  // 都对全量 allMessages 做 O(M) 扫描（流式期间 useMemo 因 allMessages 引用变化失效，
  // 长会话会触发 O(T × M) 雪崩）。
  const historicalTaskSubjects = React.useMemo(() => {
    return buildHistoricalTaskSubjects(allSDKMessages)
  }, [allSDKMessages])

  // 标记哪些 group 属于实时流式消息（用于 isStreaming / onFork 差异化渲染）
  const liveGroupSet = React.useMemo(() => {
    return buildLiveGroupSet({
      allGroups,
      liveMessages,
      streaming,
    })
  }, [allGroups, liveMessages, streaming])

  // 迷你地图：一刻度 = 一轮（以用户消息为锚），预览含用户 + 助手摘要
  const minimapItems: MinimapItem[] = React.useMemo(() => {
    const items: MinimapItem[] = []
    for (let i = 0; i < allGroups.length; i += 1) {
      const group = allGroups[i]
      if (!group || group.type !== 'user') continue

      const rawText = extractUserText(group.message) ?? ''
      const cleaned = stripDesignContextFromUserMessage(rawText).displayText
      const { files, text } = sdkParseAttachedFiles(cleaned)
      const userPreview = (text || cleaned).trim().slice(0, 160)

      let replyPreview: string | undefined
      let replyModel: string | undefined
      for (let j = i + 1; j < allGroups.length; j += 1) {
        const next = allGroups[j]
        if (!next) continue
        if (next.type === 'user') break
        if (next.type === 'assistant-turn') {
          const preview = getGroupPreview(next).trim()
          if (preview) {
            // peep 卡只展示纯文本，避免 # ** ` 等 markdown 占位
            replyPreview = markdownToPlainText(preview).replace(/\s+/g, ' ').trim().slice(0, 180)
          }
          replyModel = next.model
          break
        }
      }

      items.push({
        id: getGroupId(group),
        role: 'user',
        preview: userPreview || '(空消息)',
        replyPreview,
        attachments: files.map((f) => ({ name: f.filename || f.path })),
        avatar: userProfile.avatar,
        model: replyModel,
      })
    }
    return items
  }, [allGroups, userProfile.avatar])

  // 同步 minimap 缓存到 Tab 级别（供 Tab hover 预览使用）
  React.useEffect(() => {
    if (minimapItems.length > 0) {
      setMinimapCache((prev) => {
        const next = new Map(prev)
        next.set(sessionId, minimapItems)
        return next
      })
    }
  }, [sessionId, minimapItems, setMinimapCache])

  // 所有用户消息的数据 — 供 StickyUserMessage 使用
  const allUserMessagesData = React.useMemo(() => {
    return allGroups
      .filter((g): g is MessageGroup & { type: 'user' } => g.type === 'user')
      .map((g) => {
        const rawText = extractUserText(g.message) ?? ''
        const cleaned = stripDesignContextFromUserMessage(rawText).displayText
        const { files, text } = sdkParseAttachedFiles(cleaned)
        return {
          id: getGroupId(g),
          text,
          attachments: files.map((f) => ({
            filename: f.filename,
            isImage: sdkIsImageFile(f.filename),
          })),
        }
      })
  }, [allGroups])

  // 实时消息中是否已有可渲染的助手内容
  // 流式中：通过 liveGroupSet 精确判断（只有 streaming 时 liveGroupSet 才非空）
  // 流式结束后：直接检查 liveMessages 中是否有助手消息，
  // 防止 streaming→false 到 liveMessages 被清除之间的过渡帧中 fallback 气泡重复渲染
  const hasLiveAssistantContent = streaming
    ? allGroups.some((g) => g.type === 'assistant-turn' && liveGroupSet.has(g))
    : liveMessages != null && liveMessages.some((m) => (m as { type: string }).type === 'assistant')

  // ===== Ask 档位时间线合并 =====
  const askMessages = useAtomValue(currentAskMessagesAtom)
  const askStreamState = useAtomValue(currentAskStreamStateAtom)

  /** 时间线条目：SDK group 或 Ask 消息 */
  type TimelineEntry =
    | { kind: 'sdk'; group: MessageGroup; id: string; createdAt: number }
    | { kind: 'ask'; message: AskMessage; id: string; createdAt: number }

  /** 合并 SDK + Ask，按 createdAt 排序 */
  const mergedTimeline = React.useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = []

    // SDK groups
    for (const group of allGroups) {
      let createdAt = Date.now()
      let id: string
      if (group.type === 'user') {
        const c = (group.message.message as { content?: Array<{ type: string; text?: string }> })
          ?.content
        const firstText = c?.find((b) => b.type === 'text' && b.text)?.text
        // 从 message 抽 _createdAt 优先
        const userMsg = group.message as { _createdAt?: number; uuid?: string }
        if (typeof userMsg._createdAt === 'number') {
          createdAt = userMsg._createdAt
        } else if (firstText) {
          // 退化：截前 30 字符作为稳定 id（不会用于 React key，只是排序）
          createdAt = Date.now()
        }
        id = userMsg.uuid ?? getGroupId(group)
      } else if (group.type === 'assistant-turn') {
        createdAt = group.createdAt ?? Date.now()
        id = getGroupId(group)
      } else {
        // system
        const sysMsg = group.message as { _createdAt?: number; uuid?: string }
        if (typeof sysMsg._createdAt === 'number') {
          createdAt = sysMsg._createdAt
        }
        id = sysMsg.uuid ?? getGroupId(group)
      }
      entries.push({ kind: 'sdk', group, id, createdAt })
    }

    // Ask messages
    for (const msg of askMessages) {
      if (!msg.content.trim() && !msg.attachments?.length) continue
      entries.push({ kind: 'ask', message: msg, id: msg.id, createdAt: msg.createdAt })
    }

    // 按 createdAt 稳定排序（同时间戳时 SDK 优先以保留原有 minimap 顺序）
    entries.sort((a, b) => {
      const da = a.createdAt
      const db = b.createdAt
      if (da !== db) return da - db
      // 稳定排序：同时间戳时让 SDK 在前（保持与原 allGroups 顺序一致）
      if (a.kind === b.kind) return 0
      return a.kind === 'sdk' ? -1 : 1
    })

    return entries
  }, [allGroups, askMessages])

  const totalEntries = mergedTimeline.length

  // P1-7 风险点 3（流式不受干扰）：流式追加新消息时 mergedTimeline.length 增长，
  // 若 visibleCount 已到全量，需同步跟随，避免把最新流式内容 slice 掉。
  // 已全挂载时强制 visibleCount = length；未全挂载时不收缩（分批递增逻辑会追上）。
  React.useEffect(() => {
    if (Number.isFinite(visibleCount) && visibleCount >= totalEntries) {
      setVisibleCount(Number.POSITIVE_INFINITY)
    }
  }, [totalEntries, visibleCount])

  // P1-7 核心递增：空闲帧渐进挂载剩余历史，直至覆盖全量。
  // - 依赖 visibleCount 与 totalEntries：每帧挂一批后 visibleCount 变化 → 重排下一帧。
  // - 到达全量（visibleCount >= totalEntries）后停。
  // - scheduleIdle 让出主线程，切换动画/流式合成优先拿帧。
  React.useEffect(() => {
    if (!Number.isFinite(visibleCount)) return
    if (visibleCount >= totalEntries) return
    if (totalEntries === 0) return
    let cancelled = false
    const handle = scheduleIdle(() => {
      if (cancelled) return
      setVisibleCount((prev) => Math.min(prev + VISIBLE_GROW_STEP, totalEntries))
    })
    return () => {
      cancelled = true
      cancelIdleShim(handle)
    }
  }, [visibleCount, totalEntries])

  // P1-7 风险点 2（向下/向上滚到未挂区不空白）：用户向上滚接近已挂窗口顶端时，
  // 立即追加一批，不等空闲帧，保证滚到的位置已有内容。仅当仍在分批递增时生效。
  React.useEffect(() => {
    if (!Number.isFinite(visibleCount)) return
    if (visibleCount >= totalEntries) return
    const scrollEl = scrollContextRef.current?.scrollRef?.current
    if (!scrollEl) return
    let cancelled = false
    const onScroll = (): void => {
      if (cancelled) return
      // 时间线升序（最新在底），已挂窗口为 [length-visibleCount, length)。
      // 用户向上滚 → scrollTop 减小，接近顶部 200px 视为接近未挂区上沿，立即加一批。
      if (scrollEl.scrollTop < 200) {
        setVisibleCount((prev) => Math.min(prev + VISIBLE_GROW_STEP, totalEntries))
      }
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelled = true
      scrollEl.removeEventListener('scroll', onScroll)
    }
  }, [visibleCount, totalEntries])

  // P1-7 风险点 1（滚动位置恢复）：分批挂载期间 ScrollPositionManager 的 ready 门控为 false，
  // 等全量挂完再恢复，避免下方历史未挂、scrollHeight 不足导致恢复到错误位置。
  const fullyMounted =
    !Number.isFinite(visibleCount) || visibleCount >= totalEntries
  const scrollReady = ready && fullyMounted

  // P1-7 渲染切片：保留最新 visibleCount 条（时间线底部 = 最新，含流式 live）
  const visibleTimeline = React.useMemo<TimelineEntry[]>(() => {
    if (!Number.isFinite(visibleCount) || visibleCount >= totalEntries) {
      return mergedTimeline
    }
    const start = Math.max(0, totalEntries - visibleCount)
    return mergedTimeline.slice(start)
  }, [mergedTimeline, visibleCount, totalEntries])
  // findLastIndex 需在完整时间线上找，避免分批后"已被用户中断"badge 指向被截断索引
  const lastAssistantTurnIndexInFull = React.useMemo(() => {
    return mergedTimeline.findLastIndex(
      (e) => e.kind === 'sdk' && e.group.type === 'assistant-turn'
    )
  }, [mergedTimeline])

  // P1-7：visibleTimeline 是 mergedTimeline 的尾部切片（最新在底），
  // startOffset 用于把 localIdx 还原成完整时间线索引，供"已被用户中断"badge 判定。
  const visibleStartOffset = Number.isFinite(visibleCount)
    ? Math.max(0, totalEntries - visibleCount)
    : 0

  return (
    <BasePathsProvider basePaths={attachedDirs}>
      <Conversation
        contextRef={scrollContextRef}
        resize={ready && !transitioning ? 'smooth' : 'instant'}
        className={
          ready
            ? skipFadeIn
              ? 'opacity-100'
              : 'opacity-100 transition-opacity duration-200'
            : 'opacity-0'
        }
      >
        <ScrollPositionManager id={sessionId} ready={scrollReady} />
        <ConversationContent
          className={cn(
            'tagent-agent-thread',
            floatingInput ? 'conversation-floating-input' : undefined
          )}
        >
          {!hasContent && !streaming ? (
            <EmptyState />
          ) : (
            <>
              {/* 统一消息渲染（持久化 + 实时 + Ask 合并为一个列表，确保 system 消息位置正确） */}
              {/* P1-7：分批挂载时只渲染 visibleTimeline（最近 N 条，最新在底，含流式 live） */}
              {visibleTimeline.map((entry, localIdx) => {
                const idx = visibleStartOffset + localIdx
                if (entry.kind === 'ask') {
                  // Ask 消息：AssistantTurn 中可能的最后一个，isStreaming 由 ask 流式状态判定
                  const isAskStreaming =
                    askStreamState?.running && askStreamState.messageId === entry.message.id
                  return (
                    <AskMessageItem
                      key={`ask:${entry.id}`}
                      message={entry.message}
                      isStreaming={!!isAskStreaming}
                      sessionId={sessionId}
                    />
                  )
                }

                // SDK group：原有渲染逻辑
                const group = entry.group
                const isLive = liveGroupSet.has(group)
                const isErrorGroup =
                  group.type === 'assistant-turn' && group.assistantMessages.some((m) => !!m.error)
                const shouldDisableActions = isLive && !isErrorGroup
                // 仅在最后一个 SDK assistant-turn 上显示"已被用户中断" badge
                // P1-7：用完整时间线上的 findLastIndex，避免分批后 badge 指向被截断索引
                const isLastAssistantTurn =
                  !streaming &&
                  stoppedByUser &&
                  group.type === 'assistant-turn' &&
                  idx === lastAssistantTurnIndexInFull
                return (
                  <MessageGroupRenderer
                    key={getGroupId(group)}
                    sessionId={sessionId}
                    group={group}
                    allMessages={allSDKMessages}
                    historicalTaskSubjects={historicalTaskSubjects}
                    basePath={sessionPath || undefined}
                    basePaths={
                      attachedDirs && attachedDirs.length > 0
                        ? // 附加目录时仍保留 sessionPath，避免项目内相对路径丢失解析基准
                          [sessionPath, ...attachedDirs].filter(
                            (p): p is string => typeof p === 'string' && p.length > 0
                          )
                        : undefined
                    }
                    onFork={shouldDisableActions ? undefined : onFork}
                    onRewind={shouldDisableActions ? undefined : onRewind}
                    onRetry={shouldDisableActions ? undefined : onRetry}
                    onRetryInNewSession={shouldDisableActions ? undefined : onRetryInNewSession}
                    onCompact={shouldDisableActions ? undefined : onCompact}
                    isStreaming={isLive || undefined}
                    streamingText={isLive && hasLiveAssistantContent ? smoothContent : undefined}
                    streamingThinking={
                      isLive && hasLiveAssistantContent ? smoothThinking : undefined
                    }
                    isContextCompacting={streamState?.isCompacting}
                    stoppedByUser={isLastAssistantTurn || undefined}
                    sessionModelId={sessionModelId}
                    retrying={isLive ? retrying : undefined}
                  />
                )
              })}

              {/* P1-7 分批加载提示：切长会话时先挂最近 N 条，剩余历史在空闲帧渐进补齐。
                  此处提示用户"更早的历史还在加载"，避免误以为卡住/出 bug。
                  全量挂完（fullyMounted）后立即消失。 */}
              {(() => {
                // 剩余未挂条数：已全挂（Infinity 或 visibleCount >= totalEntries）时为 0
                const remaining = fullyMounted
                  ? 0
                  : Math.max(0, totalEntries - Math.min(visibleCount, totalEntries))
                if (remaining <= 0) return null
                return (
                  <div
                    aria-live="polite"
                    className="flex items-center justify-center gap-2 py-2 text-muted-foreground"
                  >
                    {/* 纯 CSS spinner，不新引依赖（参考 MainArea.tsx 切会话蒙版写法） */}
                    <span className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
                    <span className="text-xs">
                      正在加载更早的 {remaining} 条消息…
                    </span>
                  </div>
                )
              })()}

              {/* 首条 live assistant 到达前：立刻展示运行胶囊 + 已到的流式 token */}
              {shouldShowPendingStreamTurn({
                streaming,
                hasLiveAssistantContent,
              }) && (
                <PendingStreamTurn
                  streamingText={smoothContent || undefined}
                  streamingThinking={smoothThinking || undefined}
                  retrying={retrying}
                />
              )}

              {/* SDK status=compacting 到达后会在时间线内联显示；此处仅作事件到达前的兜底 */}
              {streamState?.isCompacting && !hasInlineCompactingIndicator && (
                <CompactingIndicator />
              )}
            </>
          )}
        </ConversationContent>
        {showMinimap && <ScrollMinimap items={minimapItems} />}
        <ConversationScrollButton />
        {showStickyUserMessage && allUserMessagesData.length > 0 && (
          <StickyUserMessage userMessages={allUserMessagesData} />
        )}
      </Conversation>
    </BasePathsProvider>
  )
}

/**
 * 性能优化（2026-07-05）：用 React.memo 包装，避免父组件 AgentView 因输入框按键
 * 引发的 re-render 串到 24 轮 100+ 条消息列表。AgentMessages 的 props 大多是稳定
 * 引用（useCallback / useMemo / useState setter），唯一频繁变化的是 persistedSDKMessages
 * （流式追加时）和 streaming（开关切换），这些场景下重渲染是必要的。
 *
 * 输入框打字时 AgentView 因订阅 inputContent 重渲染，但传给 AgentMessages 的 props
 * 引用都没变，memo 浅比较后跳过重渲染，输入框打字不再卡顿。
 */
export const AgentMessages = React.memo(AgentMessagesImpl)
