/**
 * Usage Stats Types - 使用统计类型定义
 */

/** 模型使用统计 */
export interface ModelUsageStats {
  modelId: string
  sessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  totalCostUsd: number
  avgInputPerSession: number
  avgOutputPerSession: number
}

/** 时间范围统计 */
export interface TimeRangeStats {
  period: 'today' | 'week' | 'month' | 'all'
  sessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  byModel: ModelUsageStats[]
}

/** 使用统计总览 */
export interface UsageStatsOverview {
  totalSessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  totalCostUsd: number
  byModel: ModelUsageStats[]
  byTimeRange: {
    today: TimeRangeStats
    week: TimeRangeStats
    month: TimeRangeStats
    all: TimeRangeStats
  }
}

/** 使用统计 IPC 通道常量 */
export const USAGE_STATS_IPC_CHANNELS = {
  /** 获取使用统计总览 */
  GET_OVERVIEW: 'usage-stats:get-overview',
} as const
