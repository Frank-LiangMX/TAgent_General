/**
 * UsageStatsService - 使用统计服务
 *
 * 统计所有 Agent 会话的 token 使用情况：
 * - 按模型聚合 token 消耗
 * - 按时间范围统计
 * - 总费用统计
 * - 单次调用记录
 *
 * 数据来源: ~/.tagent/agent-sessions/{id}.jsonl
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { getAgentSessionsDir, getAgentSessionsIndexPath } from './config-paths'

import type {
  ModelUsageStats,
  TimeRangeStats,
  UsageCallRecord,
  UsageStatsOverview,
  SessionTokenStats,
} from '@tagent/shared'

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
  title?: string
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
    const modelStatsMap = new Map<
      string,
      {
        sessions: Set<string>
        inputTokens: number
        outputTokens: number
        cacheReadTokens: number
        cacheCreationTokens: number
        costUsd: number
      }
    >()

    // 单次调用记录
    const callRecords: UsageCallRecord[] = []

    // 时间范围统计
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const timeRanges = {
      today: { cutoff: now - dayMs, sessions: new Set<string>(), input: 0, output: 0, cost: 0 },
      week: { cutoff: now - 7 * dayMs, sessions: new Set<string>(), input: 0, output: 0, cost: 0 },
      month: {
        cutoff: now - 30 * dayMs,
        sessions: new Set<string>(),
        input: 0,
        output: 0,
        cost: 0,
      },
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
        const sessionTitle = sessionMeta?.title || '未命名会话'

        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const lines = content.split('\n').filter((line) => line.trim())

          let sessionModelId: string | undefined
          let sessionInputTokens = 0
          let sessionOutputTokens = 0
          let sessionCacheReadTokens = 0
          let sessionCacheCreationTokens = 0
          let sessionCostUsd = 0
          let sessionTimestamp = sessionCreatedAt

          for (const line of lines) {
            let msg: SessionMessage
            try {
              msg = JSON.parse(line)
            } catch {
              continue
            }

            // 从 assistant 消息提取模型 ID（_channelModelId 是注入到 assistant 消息中的）
            if (msg.type === 'assistant' && msg._channelModelId) {
              sessionModelId = msg._channelModelId
            }

            // result 消息包含最终 usage
            if (msg.type === 'result') {
              if (msg.usage) {
                sessionInputTokens += msg.usage.input_tokens || 0
                sessionOutputTokens += msg.usage.output_tokens || 0
                sessionCacheReadTokens += msg.usage.cache_read_input_tokens || 0
                sessionCacheCreationTokens += msg.usage.cache_creation_input_tokens || 0
              }
              if (msg.total_cost_usd) {
                sessionCostUsd += msg.total_cost_usd
              }
              // 使用消息时间戳
              if (msg._createdAt) {
                sessionTimestamp = msg._createdAt
              }
            }
          }

          // 累计统计
          if (sessionInputTokens > 0) {
            // 使用 sessionModelId，如果没有则标记为 unknown
            const effectiveModelId = sessionModelId || 'unknown'

            totalInputTokens += sessionInputTokens
            totalOutputTokens += sessionOutputTokens
            totalCacheReadTokens += sessionCacheReadTokens
            totalCacheCreationTokens += sessionCacheCreationTokens
            totalCostUsd += sessionCostUsd

            // 按模型聚合
            const modelStats = modelStatsMap.get(effectiveModelId) || {
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
            modelStatsMap.set(effectiveModelId, modelStats)

            // 时间范围统计
            for (const [key, range] of Object.entries(timeRanges)) {
              if (sessionCreatedAt >= range.cutoff) {
                range.sessions.add(sessionId)
                range.input += sessionInputTokens
                range.output += sessionOutputTokens
                range.cost += sessionCostUsd
              }
            }

            // 添加单次调用记录
            callRecords.push({
              sessionId,
              sessionTitle,
              modelId: effectiveModelId,
              timestamp: sessionTimestamp,
              inputTokens: sessionInputTokens,
              outputTokens: sessionOutputTokens,
              cacheReadTokens: sessionCacheReadTokens,
              cacheCreationTokens: sessionCacheCreationTokens,
              costUsd: sessionCostUsd,
            })
          }
        } catch {
          // ignore file read errors
        }
      }
    }

    // 按时间倒序排列
    callRecords.sort((a, b) => b.timestamp - a.timestamp)

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
      today: this.buildTimeRangeStats(
        'today',
        timeRanges.today,
        byModel,
        sessionIndex,
        now - dayMs
      ),
      week: this.buildTimeRangeStats(
        'week',
        timeRanges.week,
        byModel,
        sessionIndex,
        now - 7 * dayMs
      ),
      month: this.buildTimeRangeStats(
        'month',
        timeRanges.month,
        byModel,
        sessionIndex,
        now - 30 * dayMs
      ),
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
      recentCalls: callRecords.slice(0, 100), // 最近 100 条记录
    }
  }

  private buildTimeRangeStats(
    period: TimeRangeStats['period'],
    rangeData: { sessions: Set<string>; input: number; output: number; cost: number },
    byModel: ModelUsageStats[],
    sessionIndex: SessionIndexItem[],
    cutoff: number
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

  /**
   * 获取单个会话的 Token 统计
   * 用于恢复历史会话的统计数据显示
   */
  getSessionTokenStats(sessionId: string): SessionTokenStats {
    const sessionsDir = getAgentSessionsDir()
    const filePath = path.join(sessionsDir, `${sessionId}.jsonl`)

    const result: SessionTokenStats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheCreationTokens: 0,
      totalCostUsd: 0,
      turnCount: 0,
    }

    if (!fs.existsSync(filePath)) {
      return result
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        let msg: SessionMessage
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }

        // result 消息包含最终 usage
        if (msg.type === 'result') {
          if (msg.usage) {
            result.totalInputTokens += msg.usage.input_tokens || 0
            result.totalOutputTokens += msg.usage.output_tokens || 0
            result.totalCacheReadTokens += msg.usage.cache_read_input_tokens || 0
            result.totalCacheCreationTokens += msg.usage.cache_creation_input_tokens || 0
          }
          if (msg.total_cost_usd) {
            result.totalCostUsd += msg.total_cost_usd
          }
          result.turnCount++
        }
      }
    } catch {
      // ignore file read errors
    }

    return result
  }
}

export const usageStatsService = new UsageStatsService()
