/**
 * NudgeService - 记忆自进化 Nudge 机制
 *
 * 根据设计文档 §6.5.4 实现：
 * - 每 5 turn 检查用户行为模式
 * - 检测重复行为/事实/纠正
 * - 弹出提示询问用户是否记住
 *
 * 检测模式：
 * - 行为重复：同一行为 ≥3 次/5turn → L0 (peer_view)
 * - 事实重复：同一事实 ≥2 次跨 session → L2
 * - 显式纠正："不是 X，是 Y" → L3 raw（自动写）
 * - 项目重复：加载项目 ≥2 次相似 → L1
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { app } from 'electron'

import { memoryLayerService, type MemoryMode } from './memory-layer-service'

// ===== 类型定义 =====

/** Nudge 类型 */
export type NudgeType = 'behavior_repeat' | 'fact_repeat' | 'correction' | 'project_repeat'

/** Nudge 候选项 */
export interface NudgeCandidate {
  id: string
  type: NudgeType
  targetLayer: 'L0' | 'L1' | 'L2' | 'L3'
  pattern: string
  evidence: string[]
  suggestedContent: string
  userMessage: string // LLM 改写后的用户友好提示
}

/** Nudge 结果 */
export interface NudgeResult {
  accepted: boolean
  deferred: boolean
  rejected: boolean
}

/** 模式检测结果 */
interface PatternMatch {
  type: NudgeType
  pattern: string
  count: number
  evidence: string[]
}

// ===== 配置 =====

/** 各层冷却 turn 数 */
const LAYER_COOLDOWN_TURNS: Record<string, number> = {
  L0: 5,
  L1: 10,
  L2: 3,
  L3: 20,
}

/** 检测间隔 turn 数 */
const NUUDGE_CHECK_INTERVAL = 5

/** 每批最大候选数 */
const MAX_CANDIDATES_PER_BATCH = 3

// ===== NudgeService =====

class NudgeService {
  /** 各会话的 turn 计数 */
  private sessionTurnCounts: Map<string, number> = new Map()

  /** 各会话的各层冷却计数 */
  private sessionLayerCooldowns: Map<string, Map<string, number>> = new Map()

  /** 待处理的 Nudge 候选项 */
  private pendingNudges: Map<string, NudgeCandidate[]> = new Map()

  /** Nudge 结果回调 */
  private nudgeCallbacks: Map<string, (nudge: NudgeCandidate, result: NudgeResult) => void> = new Map()

  /**
   * 获取记忆目录路径
   */
  private getMemoryDir(mode: MemoryMode): string {
    const isDev = !app.isPackaged
    const baseDir = isDev ? path.join(app.getPath('home'), '.tagent-dev') : path.join(app.getPath('home'), '.tagent')
    return mode === 'general' ? path.join(baseDir, 'memory') : path.join(baseDir, 'ta', 'memory')
  }

  /**
   * turn_start 钩子 - 检测是否需要运行 Nudge
   *
   * @param sessionId 会话 ID
   * @param recentMessages 最近 5 turn 的消息
   * @param mode 记忆模式
   * @returns Nudge 候选项列表（可能为空）
   */
  onTurnStart(
    sessionId: string,
    recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
    mode: MemoryMode,
  ): NudgeCandidate[] {
    // 增加 turn 计数
    const currentTurn = (this.sessionTurnCounts.get(sessionId) || 0) + 1
    this.sessionTurnCounts.set(sessionId, currentTurn)

    // 减少各层冷却
    this.decrementCooldowns(sessionId)

    // 每 5 turn 检查一次
    if (currentTurn % NUUDGE_CHECK_INTERVAL !== 0) {
      return []
    }

    // 检测模式
    const patterns = this.detectPatterns(recentMessages, mode)

    // 过滤冷却中的层
    const candidates = patterns
      .filter((p) => !this.isInCooldown(sessionId, this.getLayerForType(p.type)))
      .slice(0, MAX_CANDIDATES_PER_BATCH)
      .map((p) => this.createNudgeCandidate(p))

    // 缓存候选项
    if (candidates.length > 0) {
      this.pendingNudges.set(sessionId, candidates)
    }

    return candidates
  }

  /**
   * 检测模式
   */
  private detectPatterns(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    mode: MemoryMode,
  ): PatternMatch[] {
    const patterns: PatternMatch[] = []
    const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content)

    // 1. 检测行为重复（同一表述 ≥3 次）
    const behaviorPatterns = this.detectBehaviorRepeat(userMessages)
    patterns.push(...behaviorPatterns)

    // 2. 检测事实重复（跨 session 检测需要历史数据，这里简化为当前 session 内 ≥2 次）
    const factPatterns = this.detectFactRepeat(userMessages, mode)
    patterns.push(...factPatterns)

    // 3. 检测显式纠正（"不是 X，是 Y"）
    const correctionPatterns = this.detectCorrections(messages)
    patterns.push(...correctionPatterns)

    // 4. 检测项目重复（需要历史数据，暂不实现）
    // TODO: 实现 project_repeat 检测

    return patterns
  }

  /**
   * 检测行为重复
   */
  private detectBehaviorRepeat(userMessages: string[]): PatternMatch[] {
    const patterns: PatternMatch[] = []

    // 提取用户偏好表述
    const preferencePatterns = [
      /不要[^\s]{2,10}/g, // "不要 emoji"
      /用[^\s]{2,10}不用[^\s]{2,10}/g, // "用中文不用英文"
      /保持[^\s]{2,10}/g, // "保持简洁"
    ]

    for (const regex of preferencePatterns) {
      const matches = new Map<string, string[]>()

      for (const msg of userMessages) {
        const found = msg.match(regex)
        if (found) {
          for (const match of found) {
            const evidence = matches.get(match) || []
            evidence.push(msg.slice(0, 100))
            matches.set(match, evidence)
          }
        }
      }

      // ≥3 次的行为作为候选
      for (const [pattern, evidence] of matches) {
        if (evidence.length >= 3) {
          patterns.push({
            type: 'behavior_repeat',
            pattern,
            count: evidence.length,
            evidence,
          })
        }
      }
    }

    return patterns
  }

  /**
   * 检测事实重复
   */
  private detectFactRepeat(userMessages: string[], _mode: MemoryMode): PatternMatch[] {
    const patterns: PatternMatch[] = []

    // 提取事实性表述（包含"是"、"叫"、"在"等）
    const factPatterns = [/我[的之][^\s]{1,20}是[^\s]{1,20}/g, /(名字|邮箱|账号|地址)[^\s]{0,5}[是为][^\s]{1,20}/g]

    for (const regex of factPatterns) {
      const matches = new Map<string, string[]>()

      for (const msg of userMessages) {
        const found = msg.match(regex)
        if (found) {
          for (const match of found) {
            const evidence = matches.get(match) || []
            evidence.push(msg.slice(0, 100))
            matches.set(match, evidence)
          }
        }
      }

      // ≥2 次的事实作为候选
      for (const [pattern, evidence] of matches) {
        if (evidence.length >= 2) {
          patterns.push({
            type: 'fact_repeat',
            pattern,
            count: evidence.length,
            evidence,
          })
        }
      }
    }

    return patterns
  }

  /**
   * 检测显式纠正
   */
  private detectCorrections(messages: Array<{ role: 'user' | 'assistant'; content: string }>): PatternMatch[] {
    const patterns: PatternMatch[] = []

    // 检测纠正模式
    const correctionPatterns = [
      /不是[^\s]{1,20}[,，是][^\s]{1,20}/g, // "不是 X，是 Y"
      /不对[，,]?应该是/g, // "不对，应该是"
      /改[成变为][^\s]{1,20}/g, // "改成 X"
    ]

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (!msg || msg.role !== 'user') continue

      for (const regex of correctionPatterns) {
        const found = msg.content.match(regex)
        if (found) {
          // 找到对应的 assistant 消息作为上下文
          let context = ''
          const prevMsg = messages[i - 1]
          if (i > 0 && prevMsg && prevMsg.role === 'assistant') {
            context = prevMsg.content.slice(0, 200)
          }

          for (const match of found) {
            patterns.push({
              type: 'correction',
              pattern: match,
              count: 1,
              evidence: [context ? `AI: ${context}` : '', `用户: ${msg.content.slice(0, 100)}`],
            })
          }
        }
      }
    }

    return patterns
  }

  /**
   * 获取类型对应的层
   */
  private getLayerForType(type: NudgeType): 'L0' | 'L1' | 'L2' | 'L3' {
    switch (type) {
      case 'behavior_repeat':
        return 'L0'
      case 'project_repeat':
        return 'L1'
      case 'fact_repeat':
        return 'L2'
      case 'correction':
        return 'L3'
    }
  }

  /**
   * 创建 Nudge 候选项
   */
  private createNudgeCandidate(pattern: PatternMatch): NudgeCandidate {
    const id = `${pattern.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const targetLayer = this.getLayerForType(pattern.type)

    // 生成用户友好的提示（简化版，生产环境应调用 LLM）
    const userMessage = this.generateUserMessage(pattern)

    return {
      id,
      type: pattern.type,
      targetLayer,
      pattern: pattern.pattern,
      evidence: pattern.evidence,
      suggestedContent: pattern.pattern,
      userMessage,
    }
  }

  /**
   * 生成用户提示（简化版）
   */
  private generateUserMessage(pattern: PatternMatch): string {
    switch (pattern.type) {
      case 'behavior_repeat':
        return `我注意到你多次提到"${pattern.pattern}"，要我记住这个偏好吗？`
      case 'fact_repeat':
        return `我看到你反复提到"${pattern.pattern}"，要我存为长期事实吗？`
      case 'correction':
        return `我把你这次的纠正记下来了`
      case 'project_repeat':
        return `我看到你做项目都用类似结构，要存为模板吗？`
    }
  }

  /**
   * 检查层是否在冷却中
   */
  private isInCooldown(sessionId: string, layer: 'L0' | 'L1' | 'L2' | 'L3'): boolean {
    const cooldowns = this.sessionLayerCooldowns.get(sessionId)
    if (!cooldowns) return false
    return (cooldowns.get(layer) || 0) > 0
  }

  /**
   * 减少各层冷却计数
   */
  private decrementCooldowns(sessionId: string): void {
    const cooldowns = this.sessionLayerCooldowns.get(sessionId)
    if (!cooldowns) return

    for (const [layer, count] of cooldowns) {
      if (count > 0) {
        cooldowns.set(layer, count - 1)
      }
    }
  }

  /**
   * 设置层冷却
   */
  private setCooldown(sessionId: string, layer: 'L0' | 'L1' | 'L2' | 'L3'): void {
    let cooldowns = this.sessionLayerCooldowns.get(sessionId)
    if (!cooldowns) {
      cooldowns = new Map()
      this.sessionLayerCooldowns.set(sessionId, cooldowns)
    }
    const turns = LAYER_COOLDOWN_TURNS[layer] ?? 5
    cooldowns.set(layer, turns)
  }

  /**
   * 处理用户对 Nudge 的响应
   *
   * @param sessionId 会话 ID
   * @param nudgeId Nudge ID
   * @param action 用户操作：'accept' | 'reject' | 'defer'
   * @param mode 记忆模式
   */
  async handleNudgeResponse(
    sessionId: string,
    nudgeId: string,
    action: 'accept' | 'reject' | 'defer',
    mode: MemoryMode,
  ): Promise<void> {
    const candidates = this.pendingNudges.get(sessionId)
    if (!candidates) return

    const nudge = candidates.find((c) => c.id === nudgeId)
    if (!nudge) return

    const result: NudgeResult = {
      accepted: action === 'accept',
      deferred: action === 'defer',
      rejected: action === 'reject',
    }

    // 设置冷却（无论用户如何选择）
    this.setCooldown(sessionId, nudge.targetLayer)

    if (action === 'accept') {
      // 写入对应层
      await this.writeToLayer(nudge, mode)
    } else if (action === 'reject') {
      // 记录拒绝，防止重复弹
      await this.recordRejection(nudge, mode)
    } else if (action === 'defer') {
      // 记录延后，下个周期再问
      await this.recordDeferral(nudge, mode)
    }

    // 从待处理列表移除
    const remaining = candidates.filter((c) => c.id !== nudgeId)
    if (remaining.length > 0) {
      this.pendingNudges.set(sessionId, remaining)
    } else {
      this.pendingNudges.delete(sessionId)
    }

    // 触发回调
    const callback = this.nudgeCallbacks.get(sessionId)
    if (callback) {
      callback(nudge, result)
    }
  }

  /**
   * 写入对应层
   */
  private async writeToLayer(nudge: NudgeCandidate, mode: MemoryMode): Promise<void> {
    const dir = this.getMemoryDir(mode)

    switch (nudge.targetLayer) {
      case 'L0':
        // L0 用户画像 - 追加到 peer_view
        await this.appendMdFile(path.join(dir, 'L0_user.md'), 'peer_view', nudge.suggestedContent)
        break
      case 'L1':
        // L1 项目画像
        await this.appendMdFile(path.join(dir, 'L1_project.md'), 'project', nudge.suggestedContent)
        break
      case 'L2':
        // L2 稳定事实
        await this.appendMdFile(path.join(dir, 'L2_facts.md'), 'fact', nudge.suggestedContent)
        break
      case 'L3':
        // L3 纠错记录 - 追加到 corrections.jsonl
        await this.appendCorrection(dir, nudge)
        break
    }
  }

  /**
   * 追加内容到 Markdown 文件
   */
  private async appendMdFile(filePath: string, section: string, content: string): Promise<void> {
    const timestamp = new Date().toISOString().slice(0, 10)
    const line = `- [${timestamp}] ${content}\n`

    if (!fs.existsSync(filePath)) {
      // 创建新文件
      const header = `# ${section}\n\n${line}`
      await fs.promises.writeFile(filePath, header, 'utf-8')
    } else {
      // 追加
      await fs.promises.appendFile(filePath, line, 'utf-8')
    }
  }

  /**
   * 追加纠正记录
   */
  private async appendCorrection(dir: string, nudge: NudgeCandidate): Promise<void> {
    const filePath = path.join(dir, 'corrections.jsonl')
    const record = {
      timestamp: Date.now(),
      correction: nudge.suggestedContent,
      context: nudge.evidence.join('\n'),
    }
    const line = JSON.stringify(record) + '\n'

    if (!fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, line, 'utf-8')
    } else {
      await fs.promises.appendFile(filePath, line, 'utf-8')
    }
  }

  /**
   * 记录拒绝
   */
  private async recordRejection(nudge: NudgeCandidate, mode: MemoryMode): Promise<void> {
    const dir = this.getMemoryDir(mode)
    const filePath = path.join(dir, 'nudges', 'rejected.jsonl')

    // 确保目录存在
    const nudgesDir = path.join(dir, 'nudges')
    if (!fs.existsSync(nudgesDir)) {
      await fs.promises.mkdir(nudgesDir, { recursive: true })
    }

    const record = {
      timestamp: Date.now(),
      type: nudge.type,
      pattern: nudge.pattern,
    }
    await fs.promises.appendFile(filePath, JSON.stringify(record) + '\n', 'utf-8')
  }

  /**
   * 记录延后
   */
  private async recordDeferral(nudge: NudgeCandidate, mode: MemoryMode): Promise<void> {
    const dir = this.getMemoryDir(mode)
    const filePath = path.join(dir, 'nudges', 'deferred.jsonl')

    // 确保目录存在
    const nudgesDir = path.join(dir, 'nudges')
    if (!fs.existsSync(nudgesDir)) {
      await fs.promises.mkdir(nudgesDir, { recursive: true })
    }

    const record = {
      timestamp: Date.now(),
      type: nudge.type,
      pattern: nudge.pattern,
      nudgeId: nudge.id,
    }
    await fs.promises.appendFile(filePath, JSON.stringify(record) + '\n', 'utf-8')
  }

  /**
   * 注册 Nudge 回调
   */
  registerCallback(sessionId: string, callback: (nudge: NudgeCandidate, result: NudgeResult) => void): void {
    this.nudgeCallbacks.set(sessionId, callback)
  }

  /**
   * 注销回调
   */
  unregisterCallback(sessionId: string): void {
    this.nudgeCallbacks.delete(sessionId)
    this.pendingNudges.delete(sessionId)
  }

  /**
   * 清理会话状态
   */
  clearSession(sessionId: string): void {
    this.sessionTurnCounts.delete(sessionId)
    this.sessionLayerCooldowns.delete(sessionId)
    this.pendingNudges.delete(sessionId)
    this.nudgeCallbacks.delete(sessionId)
  }
}

// 导出单例
export const nudgeService = new NudgeService()
