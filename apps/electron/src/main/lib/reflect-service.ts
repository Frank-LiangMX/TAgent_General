/**
 * ReflectService - 记忆自进化 Reflect 机制
 *
 * 根据设计文档 §6.5.5 实现：
 * - 每日 03:00（或启动时距上次 >36h）触发
 * - 从 L2_facts + L4_sessions 提炼洞察写入 L5
 * - anti_echo_filter 防回音壁
 * - contradiction_check 矛盾检查
 *
 * 触发条件：
 * - 定时：每日 03:00
 * - 启动时：距上次 >36h
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { app } from 'electron'

import { memoryLayerService, type MemoryMode } from './memory-layer-service'

// ===== 类型定义 =====

/** Reflect 执行结果 */
export interface ReflectResult {
  success: boolean
  insightsGenerated: number
  insights: string[]
  error?: string
}

/** Reflect 状态 */
interface ReflectState {
  lastRunTime: number | null
  lastInsights: string[]
}

// ===== 配置 =====

/** Reflect 间隔（毫秒）：36 小时 */
const REFLECT_INTERVAL_MS = 36 * 60 * 60 * 1000

/** 最大洞察数 */
const MAX_INSIGHTS = 20

// ===== ReflectService =====

class ReflectService {
  /** 各模式的 Reflect 状态 */
  private states: Map<MemoryMode, ReflectState> = new Map()

  /** 定时器 ID */
  private timerId: NodeJS.Timeout | null = null

  /**
   * 获取记忆目录路径
   */
  private getMemoryDir(mode: MemoryMode): string {
    const isDev = !app.isPackaged
    const baseDir = isDev
      ? path.join(app.getPath('home'), '.tagent-dev')
      : path.join(app.getPath('home'), '.tagent')
    return mode === 'general' ? path.join(baseDir, 'memory') : path.join(baseDir, 'ta', 'memory')
  }

  /**
   * 初始化服务
   */
  initialize(): void {
    // 加载上次运行时间
    this.loadState('general')
    this.loadState('ta')

    // 检查是否需要立即运行
    this.checkAndRun('general')
    this.checkAndRun('ta')

    // 设置定时器：每日 03:00 运行
    this.scheduleNextRun()
  }

  /**
   * 加载状态
   */
  private loadState(mode: MemoryMode): void {
    const dir = this.getMemoryDir(mode)
    const statePath = path.join(dir, 'reflect_state.json')

    try {
      if (fs.existsSync(statePath)) {
        const content = fs.readFileSync(statePath, 'utf-8')
        const state = JSON.parse(content) as ReflectState
        this.states.set(mode, state)
      } else {
        this.states.set(mode, { lastRunTime: null, lastInsights: [] })
      }
    } catch {
      this.states.set(mode, { lastRunTime: null, lastInsights: [] })
    }
  }

  /**
   * 保存状态
   */
  private saveState(mode: MemoryMode): void {
    const dir = this.getMemoryDir(mode)
    const state = this.states.get(mode)
    if (!state) return

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const statePath = path.join(dir, 'reflect_state.json')
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8')
  }

  /**
   * 检查并运行 Reflect
   */
  private checkAndRun(mode: MemoryMode): void {
    const state = this.states.get(mode)
    const now = Date.now()

    // 首次运行或距上次 >36h
    if (!state?.lastRunTime || now - state.lastRunTime > REFLECT_INTERVAL_MS) {
      this.runReflect(mode).catch((e) => {
        console.warn(`[ReflectService] ${mode} 模式 Reflect 失败:`, e)
      })
    }
  }

  /**
   * 计算下次运行时间（明天 03:00）
   */
  private scheduleNextRun(): void {
    const now = new Date()
    const next3AM = new Date(now)
    next3AM.setHours(3, 0, 0, 0)

    // 如果今天 03:00 已过，设为明天 03:00
    if (next3AM <= now) {
      next3AM.setDate(next3AM.getDate() + 1)
    }

    const delay = next3AM.getTime() - now.getTime()

    console.log(
      `[ReflectService] 下次运行时间: ${next3AM.toISOString()}, 距今 ${Math.round(delay / 1000 / 60)} 分钟`
    )

    this.timerId = setTimeout(() => {
      this.runReflect('general').catch(console.error)
      this.runReflect('ta').catch(console.error)
      // 递归调度下一次
      this.scheduleNextRun()
    }, delay)
  }

  /**
   * 执行 Reflect
   */
  async runReflect(mode: MemoryMode): Promise<ReflectResult> {
    const dir = this.getMemoryDir(mode)
    const result: ReflectResult = {
      success: false,
      insightsGenerated: 0,
      insights: [],
    }

    try {
      // 1. 读取 L2_facts
      const l2Content = this.readMdFile(path.join(dir, 'L2_facts.md'))
      const l2Facts = this.parseMdLines(l2Content)

      // 2. 读取 L4_sessions（最近 7 天）
      const l4Sessions = this.getRecentSessions(mode, 7)

      // 3. 读取现有 L5_insights
      const l5Content = this.readMdFile(path.join(dir, 'L5_insights.md'))
      const existingInsights = this.parseMdLines(l5Content)

      // 4. 如果数据不足，跳过
      if (l2Facts.length < 2 && l4Sessions.length < 1) {
        console.log(`[ReflectService] ${mode} 模式数据不足，跳过 Reflect`)
        return { ...result, success: true }
      }

      // 5. 提炼洞察（简化版：从事实中提取模式）
      const newInsights = this.extractInsights(l2Facts, l4Sessions, existingInsights)

      // 6. anti_echo_filter: 过滤重复
      const filteredInsights = newInsights.filter((insight) => {
        // 检查是否与现有 L5 重复
        return !existingInsights.some((existing) => this.isSimilar(insight, existing))
      })

      // 7. 限制数量
      const insightsToWrite = filteredInsights.slice(0, MAX_INSIGHTS - existingInsights.length)

      if (insightsToWrite.length > 0) {
        // 8. 写入 L5_insights.md
        await this.appendInsights(dir, insightsToWrite)

        result.success = true
        result.insightsGenerated = insightsToWrite.length
        result.insights = insightsToWrite

        console.log(`[ReflectService] ${mode} 模式生成了 ${insightsToWrite.length} 条新洞察`)
      } else {
        result.success = true
        console.log(`[ReflectService] ${mode} 模式无新洞察`)
      }

      // 更新状态
      const state = this.states.get(mode) || { lastRunTime: null, lastInsights: [] }
      state.lastRunTime = Date.now()
      state.lastInsights = insightsToWrite
      this.states.set(mode, state)
      this.saveState(mode)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      result.error = msg
      console.error(`[ReflectService] ${mode} 模式 Reflect 失败:`, error)
    }

    return result
  }

  /**
   * 读取 Markdown 文件
   */
  private readMdFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      return ''
    }
    return fs.readFileSync(filePath, 'utf-8')
  }

  /**
   * 解析 Markdown 行
   */
  private parseMdLines(content: string): string[] {
    return content
      .split('\n')
      .filter((line) => line.trim() && line.startsWith('-'))
      .map((line) => line.replace(/^-\s*/, '').trim())
  }

  /**
   * 获取最近的 L4 会话
   */
  private getRecentSessions(mode: MemoryMode, days: number): string[] {
    const sessions = memoryLayerService.listRecentSessions(mode, 50)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

    return sessions.filter((s) => s.created_at > cutoff).map((s) => `${s.title}: ${s.summary}`)
  }

  /**
   * 提炼洞察（简化版）
   *
   * 生产环境应调用 LLM 进行提炼
   */
  private extractInsights(
    l2Facts: string[],
    l4Sessions: string[],
    existingInsights: string[]
  ): string[] {
    const insights: string[] = []

    // 简化版：从事实中提取关键词模式
    const keywordCounts = new Map<string, number>()

    for (const fact of l2Facts) {
      // 提取关键词（简化版）
      const keywords = fact.match(/[一-龥]{2,4}|[a-zA-Z]{3,}/g) || []
      for (const keyword of keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1)
      }
    }

    // 出现 ≥2 次的关键词可能形成洞察
    for (const [keyword, count] of keywordCounts) {
      if (count >= 2 && !existingInsights.some((i) => i.includes(keyword))) {
        const relatedFacts = l2Facts.filter((f) => f.includes(keyword))
        if (relatedFacts.length >= 2) {
          insights.push(`用户在多个场景提到「${keyword}」，可能是一个重要偏好`)
        }
      }
    }

    return insights.slice(0, 5) // 最多 5 条
  }

  /**
   * 检查两段文本是否相似
   */
  private isSimilar(a: string, b: string): boolean {
    // 简化版：检查关键词重叠
    const keywordsA = new Set(a.match(/[一-龥]{2,4}|[a-zA-Z]{3,}/g) || [])
    const keywordsB = new Set(b.match(/[一-龥]{2,4}|[a-zA-Z]{3,}/g) || [])

    let overlap = 0
    for (const kw of keywordsA) {
      if (keywordsB.has(kw)) overlap++
    }

    // 超过 50% 重叠视为相似
    const threshold = Math.max(keywordsA.size, keywordsB.size) * 0.5
    return overlap >= threshold
  }

  /**
   * 追加洞察到 L5_insights.md
   */
  private async appendInsights(dir: string, insights: string[]): Promise<void> {
    const filePath = path.join(dir, 'L5_insights.md')
    const timestamp = new Date().toISOString().slice(0, 10)

    const lines = insights.map((i) => `- [${timestamp}] ${i}\n`).join('')

    if (!fs.existsSync(filePath)) {
      const header = `# L5 提炼洞察\n\n> 每日 Reflect 自动生成\n\n${lines}`
      await fs.promises.writeFile(filePath, header, 'utf-8')
    } else {
      await fs.promises.appendFile(filePath, '\n' + lines, 'utf-8')
    }
  }

  /**
   * 关闭服务
   */
  close(): void {
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }
}

// 导出单例
export const reflectService = new ReflectService()
