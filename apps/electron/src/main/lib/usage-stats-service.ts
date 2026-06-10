/**
 * UsageStatsService - 使用统计服务
 *
 * 统计所有 Agent 会话的 token 使用情况：
 * - 按模型聚合 token 消耗
 * - 按时间范围统计
 * - 总费用统计
 *
 * 数据来源: ~/.tagent/agent-sessions/{id}.jsonl
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { app } from 'electron'

import { getAgentSessionsDir, getAgentSessionsIndexPath } from './config-paths'

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

/** JSONL 消息类型（简化版，只提取需要的字段） */
interface SessionMessage {
  type: string
  _channelModelId?: string
  message?: {
    usage?: {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    model?: string
  }
  usage?: {
    input_tokens: number
    output_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  total_cost_usd?: number
  _createdAt?: number
}

/** 会话索引项 */
interface SessionIndexItem {
  id: string
  createdAt?: number
  updatedAt?: number
}

class UsageStatsService {
  /**
   * 获取使用统计总览
   */
  getOverview(): UsageStatsOverview {
    const sessionsDir = getAgentSessionsDir()
    const indexPath = getAgentSessionsIndexPath()

    // 读取会话索引
    let sessionIndex: SessionIndexItem[] = []
    if (fs.existsSync(indexPath)) {
      try {
        const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
        sessionIndex = indexData.sessions || []
      } catch {
        // ignore
      }
    }

    // 按模型聚合
    const modelStatsMap = new Map<string, {
      sessions: Set<string>
      inputTokens: number
      outputTokens: number
      cacheReadTokens: number
      cacheCreationTokens: number
      costUsd: number
    }>()

    // 时间范围统计
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const timeRanges = {
      today: { cutoff: now - dayMs, sessions: new Set<string>(), input: 0, output: 0, cost: 0 },
      week: { cutoff: now - 7 * dayMs, sessions: new Set<string>(), input: 0, output: 0, cost: 0 },
      month: { cutoff: now - 30 * dayMs, sessions: new Set<string>(), input: 0, output: 0, cost: 0 },
      all: { cutoff: 0, sessions: new Set<string>(), input: 0, output: 0, cost: 0 },
    }

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheReadTokens = 0
    let totalCacheCreationTokens = 0
    let totalCostUsd = 0

    // 遍历所有会话文件
    if (fs.existsSync(sessionsDir)) {
      const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'))

      for (const file of files) {
        const filePath = path.join(sessionsDir, file)
        const sessionId = file.replace('.jsonl', '')

        // 获取会话创建时间
        const sessionMeta = sessionIndex.find((s) => s.id === sessionId)
        const sessionCreatedAt = sessionMeta?.createdAt || 0

        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const lines = content.split('\n').filter((line) => line.trim())

          let sessionModelId: string | undefined
          let sessionInputTokens = 0
          let sessionOutputTokens = 0
          let sessionCacheReadTokens = 0
          let sessionCacheCreationTokens = 0
          let sessionCostUsd = 0

          for (const line of lines) {
            let msg: SessionMessage
            try {
              msg = JSON.parse(line)
            } catch {
              continue
            }

            // 提取模型 ID
            const modelId = msg._channelModelId || msg.message?.model || 'unknown'

            // result 消息包含最终 usage
            if (msg.type === 'result') {
              sessionModelId = modelId
              if (msg.usage) {
                sessionInputTokens += msg.usage.input_tokens || 0
                sessionOutputTokens += msg.usage.output_tokens || 0
                sessionCacheReadTokens += msg.usage.cache_read_input_tokens || 0
                sessionCacheCreationTokens += msg.usage.cache_creation_input_tokens || 0
              }
              if (msg.total_cost_usd) {
                sessionCostUsd += msg.total_cost_usd
              }
            }
          }

          // 累计统计
          if (sessionModelId && sessionInputTokens > 0) {
            totalInputTokens += sessionInputTokens
            totalOutputTokens += sessionOutputTokens
            totalCacheReadTokens += sessionCacheReadTokens
            totalCacheCreationTokens += sessionCacheCreationTokens
            totalCostUsd += sessionCostUsd

            // 按模型聚合
            const modelStats = modelStatsMap.get(sessionModelId) || {
              sessions: new Set<string>(),
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheCreationTokens: 0,
              costUsd: 0,
            }
            modelStats.sessions.add(sessionId)
            modelStats.inputTokens += sessionInputTokens
            modelStats.outputTokens += sessionOutputTokens
            modelStats.cacheReadTokens += sessionCacheReadTokens
            modelStats.cacheCreationTokens += sessionCacheCreationTokens
            modelStats.costUsd += sessionCostUsd
            modelStatsMap.set(sessionModelId, modelStats)

            // 时间范围统计
            for (const [key, range] of Object.entries(timeRanges)) {
              if (sessionCreatedAt >= range.cutoff) {
                range.sessions.add(sessionId)
                range.input += sessionInputTokens
                range.output += sessionOutputTokens
                range.cost += sessionCostUsd
              }
            }
          }
        } catch {
          // ignore file read errors
        }
      }
    }

    // 转换模型统计为数组
    const byModel: ModelUsageStats[] = []
    for (const [modelId, stats] of modelStatsMap) {
      const sessionCount = stats.sessions.size
      byModel.push({
        modelId,
        sessions: sessionCount,
        totalInputTokens: stats.inputTokens,
        totalOutputTokens: stats.outputTokens,
        totalCacheReadTokens: stats.cacheReadTokens,
        totalCacheCreationTokens: stats.cacheCreationTokens,
        totalCostUsd: stats.costUsd,
        avgInputPerSession: sessionCount > 0 ? Math.round(stats.inputTokens / sessionCount) : 0,
        avgOutputPerSession: sessionCount > 0 ? Math.round(stats.outputTokens / sessionCount) : 0,
      })
    }

    // 按输入 token 排序
    byModel.sort((a, b) => b.totalInputTokens - a.totalInputTokens)

    // 构建时间范围统计
    const byTimeRange = {
      today: this.buildTimeRangeStats('today', timeRanges.today, byModel, sessionIndex, now - dayMs),
      week: this.buildTimeRangeStats('week', timeRanges.week, byModel, sessionIndex, now - 7 * dayMs),
      month: this.buildTimeRangeStats('month', timeRanges.month, byModel, sessionIndex, now - 30 * dayMs),
      all: this.buildTimeRangeStats('all', timeRanges.all, byModel, sessionIndex, 0),
    }

    return {
      totalSessions: sessionIndex.length,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheCreationTokens,
      totalCostUsd,
      byModel,
      byTimeRange,
    }
  }

  private buildTimeRangeStats(
    period: TimeRangeStats['period'],
    rangeData: { sessions: Set<string>; input: number; output: number; cost: number },
    byModel: ModelUsageStats[],
    sessionIndex: SessionIndexItem[],
    cutoff: number,
  ): TimeRangeStats {
    // 过滤该时间范围内的模型统计
    const filteredModels = byModel.map((m) => ({
      ...m,
      sessions: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
    }))

    return {
      period,
      sessions: rangeData.sessions.size,
      totalInputTokens: rangeData.input,
      totalOutputTokens: rangeData.output,
      totalCostUsd: rangeData.cost,
      byModel: filteredModels,
    }
  }
}

export const usageStatsService = new UsageStatsService()
