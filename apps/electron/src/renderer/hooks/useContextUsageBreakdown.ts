import type { ContextUsageSnapshot, GetContextUsageError } from '@tagent/shared'
import * as React from 'react'

import { contextUsageRefreshNonceAtom } from '@/atoms/context-usage-atoms'
import { useAtomValue } from 'jotai'

interface UseContextUsageBreakdownResult {
  snapshot: ContextUsageSnapshot | null
  error: GetContextUsageError | null
  /** 尚无任意可展示数据（缓存/流式预览都没有） */
  loading: boolean
  /** 已有快照，正在后台拉取 SDK 最新分项 */
  refreshing: boolean
  /** 当前快照为流式估算摘要，非 SDK 分项 */
  isStreamPreview: boolean
}

/** 用流式 usage 拼出摘要快照，供分项加载前优先展示大致占用 */
export function buildStreamPreviewSnapshot(
  totalTokens: number,
  maxTokens: number,
  model?: string
): ContextUsageSnapshot {
  const percentage = maxTokens > 0 ? Math.min(100, (totalTokens / maxTokens) * 100) : 0
  return {
    categories: [],
    totalTokens,
    maxTokens,
    rawMaxTokens: maxTokens,
    percentage,
    model: model ?? '',
    isAutoCompactEnabled: false,
    memoryFiles: [],
    mcpTools: [],
    agents: [],
    apiUsage: null,
    fetchedAt: Date.now(),
  }
}

export function useContextUsageBreakdown(
  sessionId: string | null | undefined,
  enabled: boolean,
  streamPreview?: { totalTokens: number; maxTokens: number; model?: string } | null
): UseContextUsageBreakdownResult {
  const refreshNonce = useAtomValue(contextUsageRefreshNonceAtom)
  const [snapshot, setSnapshot] = React.useState<ContextUsageSnapshot | null>(null)
  const [error, setError] = React.useState<GetContextUsageError | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [isStreamPreview, setIsStreamPreview] = React.useState(false)
  const hasDisplayedRef = React.useRef(false)

  React.useEffect(() => {
    if (!enabled || !sessionId) {
      setSnapshot(null)
      setError(null)
      setLoading(false)
      setRefreshing(false)
      setIsStreamPreview(false)
      hasDisplayedRef.current = false
      return
    }

    let cancelled = false
    hasDisplayedRef.current = false
    setIsStreamPreview(false)

    // 阶段 1：缓存快照（毫秒级，不调用 SDK）
    void window.electronAPI.getContextUsageCached(sessionId).then((cachedResult) => {
      if (cancelled) return
      if (cachedResult.ok) {
        setSnapshot(cachedResult.snapshot)
        setIsStreamPreview(false)
        hasDisplayedRef.current = true
        setLoading(false)
      }
    })

    const delayMs = refreshNonce > 0 ? 500 : 0
    const timer = window.setTimeout(() => {
      if (!hasDisplayedRef.current) {
        if (streamPreview && streamPreview.totalTokens > 0 && streamPreview.maxTokens > 0) {
          setSnapshot(
            buildStreamPreviewSnapshot(
              streamPreview.totalTokens,
              streamPreview.maxTokens,
              streamPreview.model
            )
          )
          setIsStreamPreview(true)
          hasDisplayedRef.current = true
          setLoading(false)
        } else {
          setLoading(true)
        }
      } else {
        setRefreshing(true)
      }

      void window.electronAPI
        .getContextUsage(sessionId)
        .then((result) => {
          if (cancelled) return
          if (result.ok) {
            setSnapshot(result.snapshot)
            setIsStreamPreview(false)
            setError(null)
            hasDisplayedRef.current = true
          } else if (!hasDisplayedRef.current) {
            setSnapshot(null)
            setError(result)
          }
        })
        .catch((fetchError: unknown) => {
          if (cancelled) return
          if (!hasDisplayedRef.current) {
            setSnapshot(null)
            setError({
              ok: false,
              code: 'SDK_ERROR',
              message: fetchError instanceof Error ? fetchError.message : '获取 Context 分项失败',
            })
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
            setRefreshing(false)
          }
        })
    }, delayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    sessionId,
    enabled,
    refreshNonce,
    streamPreview?.totalTokens,
    streamPreview?.maxTokens,
    streamPreview?.model,
  ])

  return { snapshot, error, loading, refreshing, isStreamPreview }
}
