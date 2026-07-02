/**
 * SpeedTestBadge — 单模型测速结果展示
 *
 * 显示「模型名 延迟」，颜色分级：
 * - success + ttfbMs < 800 → 绿底
 * - 800-2000 → 黄
 * - ≥2000 → 红
 * - !success → 红 + "超时"
 */
import type { ModelSpeedTestResult } from '@tagent/shared'

interface SpeedTestBadgeProps {
  modelId: string
  result?: ModelSpeedTestResult
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function SpeedTestBadge({ modelId, result }: SpeedTestBadgeProps) {
  if (!result) return null

  if (!result.success) {
    return (
      <span
        className="text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 dark:text-red-400"
        title={result.message}
      >
        {modelId} · 超时
      </span>
    )
  }

  const ttfb = result.ttfbMs ?? 0
  let cls: string
  if (ttfb < 800) {
    cls = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  } else if (ttfb < 2000) {
    cls = 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  } else {
    cls = 'bg-red-500/15 text-red-500 dark:text-red-400'
  }

  return (
    <span
      className={`text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full ${cls}`}
      title={result.message}
    >
      {modelId} · {formatMs(ttfb)}
    </span>
  )
}
