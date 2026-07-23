/**
 * 运行计时器：纯状态转换函数 + 格式化纯函数 + 单一 interval hook
 *
 * 设计约束：
 * - transitionRunTimerState 是纯函数，可测试、无副作用
 * - 整个应用只有一个 setInterval 来驱动运行计时视觉
 * - startedAt 来自 AgentStreamState.startedAt（agent-atoms.ts）
 * - thinking↔acting 切换不重置计时（同 session running 持续）
 * - 组件卸载时自动清除 interval
 * - 按 sessionId 隔离，切换会话自动重置
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import { agentSessionStreamingStateAtomFamily } from '@/atoms/agent-atoms'

/** 格式化运行耗时（毫秒数 → mm:ss，分钟始终两位数） */
export function formatRunElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 运行计时器纯状态 */
export interface RunTimerState {
  /** 当前是否正在运行 */
  isRunning: boolean
  /** 当前运行的起始时间戳（ms），null 表示未运行 */
  startedAt: number | null
  /** 当前所属 sessionId（用于隔离不同会话） */
  sessionId: string | null
}

/** 空闲状态 */
const IDLE_STATE: RunTimerState = {
  isRunning: false,
  startedAt: null,
  sessionId: null,
}

/**
 * 纯状态转换函数：根据输入事件决定下一个计时器状态
 *
 * 规则：
 * - 同 session running 持续（thinking↔acting）→ 保持 startedAt
 * - false → 清空 startedAt
 * - 下一个 false→true → 使用 streamStartedAt 或 now
 * - session change → 完全隔离，视为新的状态
 */
export function transitionRunTimerState(
  previous: RunTimerState,
  input: {
    sessionId: string
    isRunning: boolean
    streamStartedAt?: number
    now: number
  }
): RunTimerState {
  const { sessionId, isRunning, streamStartedAt, now } = input

  // 会话切换：完全隔离，重新开始
  if (previous.sessionId !== sessionId) {
    if (isRunning) {
      return {
        isRunning: true,
        startedAt: streamStartedAt ?? now,
        sessionId,
      }
    }
    return { ...IDLE_STATE, sessionId }
  }

  // 同一会话内
  if (isRunning) {
    // running 持续（thinking↔acting 切换）→ 保持 startedAt 不重置
    // startedAt 可能为 0（Unix epoch），必须用 null 检查而非 truthiness
    if (previous.isRunning && previous.startedAt !== null) {
      return previous
    }
    // 新一轮运行：优先使用 streamStartedAt，回退到 now
    return {
      isRunning: true,
      startedAt: streamStartedAt ?? now,
      sessionId,
    }
  }

  // 停止运行：清空
  return { isRunning: false, startedAt: null, sessionId }
}

/** 运行计时 hook：从 session streaming state 读取 startedAt + running，驱动唯一 interval */
export function useSessionRunElapsed(sessionId: string | undefined): {
  elapsedMs: number
  isCompleted: boolean
  isRunning: boolean
  shouldShow: boolean
} {
  const streamState = useAtomValue(agentSessionStreamingStateAtomFamily(sessionId ?? '__none__'))

  const isRunning = streamState?.running ?? false
  const streamStartedAt = streamState?.startedAt

  const [timerState, setTimerState] = React.useState<RunTimerState>(IDLE_STATE)
  const [completedElapsedMs, setCompletedElapsedMs] = React.useState<number | null>(null)
  const previousRunningRef = React.useRef(false)
  const previousSessionIdRef = React.useRef<string | undefined>(sessionId)
  const lastStartedAtRef = React.useRef<number | null>(null)

  // 状态转换（纯函数）
  React.useEffect(() => {
    if (!sessionId) {
      setTimerState(IDLE_STATE)
      return
    }
    setTimerState((prev) =>
      transitionRunTimerState(prev, {
        sessionId,
        isRunning,
        streamStartedAt,
        now: Date.now(),
      })
    )
  }, [sessionId, isRunning, streamStartedAt])

  // 单一 interval 驱动 elapsedMs
  const [elapsedMs, setElapsedMs] = React.useState(0)

  React.useEffect(() => {
    if (previousSessionIdRef.current === sessionId) return
    previousSessionIdRef.current = sessionId
    previousRunningRef.current = false
    lastStartedAtRef.current = null
    setCompletedElapsedMs(null)
  }, [sessionId])

  React.useEffect(() => {
    if (!timerState.isRunning || timerState.startedAt === null) {
      setElapsedMs(0)
      return
    }

    const tick = (): void => setElapsedMs(Date.now() - timerState.startedAt!)
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [timerState.isRunning, timerState.startedAt])

  React.useEffect(() => {
    if (timerState.isRunning && timerState.startedAt !== null) {
      previousRunningRef.current = true
      lastStartedAtRef.current = timerState.startedAt
      setCompletedElapsedMs(null)
      return
    }

    if (previousRunningRef.current && lastStartedAtRef.current !== null) {
      setCompletedElapsedMs(Math.max(0, Date.now() - lastStartedAtRef.current))
    }

    previousRunningRef.current = false
  }, [timerState.isRunning, timerState.startedAt])

  // sessionId 变化时 timerState 尚未更新，同步返回 idle 防止显示旧会话计时
  if (sessionId && timerState.sessionId && timerState.sessionId !== sessionId) {
    return { elapsedMs: 0, isCompleted: false, isRunning: false, shouldShow: false }
  }

  if (timerState.isRunning) {
    return { elapsedMs, isCompleted: false, isRunning: true, shouldShow: true }
  }

  if (completedElapsedMs !== null) {
    return {
      elapsedMs: completedElapsedMs,
      isCompleted: true,
      isRunning: false,
      shouldShow: true,
    }
  }

  return { elapsedMs: 0, isCompleted: false, isRunning: false, shouldShow: false }
}
