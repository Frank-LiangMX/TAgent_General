import type { ContextUsageSnapshot, GetContextUsageError } from '@tagent/shared'
import * as React from 'react'

import { contextUsageRefreshNonceAtom } from '@/atoms/context-usage-atoms'
import { useAtomValue } from 'jotai'

interface UseContextUsageBreakdownResult {
  snapshot: ContextUsageSnapshot | null
  error: GetContextUsageError | null
  loading: boolean
}

export function useContextUsageBreakdown(
  sessionId: string | null | undefined,
  enabled: boolean
): UseContextUsageBreakdownResult {
  const refreshNonce = useAtomValue(contextUsageRefreshNonceAtom)
  const [snapshot, setSnapshot] = React.useState<ContextUsageSnapshot | null>(null)
  const [error, setError] = React.useState<GetContextUsageError | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!enabled || !sessionId) {
      setLoading(false)
      return
    }

    let cancelled = false
    const delayMs = refreshNonce > 0 ? 500 : 0
    const timer = window.setTimeout(() => {
      setLoading(true)
      void window.electronAPI
        .getContextUsage(sessionId)
        .then((result) => {
          if (cancelled) return
          if (result.ok) {
            setSnapshot(result.snapshot)
            setError(null)
          } else {
            setSnapshot(null)
            setError(result)
          }
        })
        .catch((fetchError: unknown) => {
          if (cancelled) return
          setSnapshot(null)
          setError({
            ok: false,
            code: 'SDK_ERROR',
            message: fetchError instanceof Error ? fetchError.message : '获取 Context 分项失败',
          })
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, delayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [sessionId, enabled, refreshNonce])

  return { snapshot, error, loading }
}
