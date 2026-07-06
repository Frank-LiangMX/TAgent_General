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

/**
 * 检测间隔 turn 数
 *
 * 2026-07-05 晚：从 5 改为 1。原设计每 5 轮检测一次太慢，用户说"我叫 Frank"
 * 要等 5 轮才弹 toast。改为每轮检测 + 阈值降低（fact ≥1 / behavior ≥2），
 * 让 Nudge 系统真正能触发。冷却机制仍防止重复弹 toast。
 */
const NUUDGE_CHECK_INTERVAL = 1

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
  private nudgeCallbacks: Map<string, (nudge: NudgeCandidate, result: NudgeResult) => void> =
    new Map()

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
    mode: MemoryMode
  ): NudgeCandidate[] {
    // 增加 turn 计数
    const currentTurn = (this.sessionTurnCounts.get(sessionId) || 0) + 1
    this.sessionTurnCounts.set(sessionId, currentTurn)

    // 减少各层冷却
    this.decrementCooldowns(sessionId)

    // 调试日志（2026-07-05 晚）：方便用户重启后验证 Nudge 检测是否触发
    const userMsgs = recentMessages.filter((m) => m.role === 'user').map((m) => m.content)
    console.log(
      `[Nudge] onTurnStart: sessionId=${sessionId.slice(0, 8)}, turn=${currentTurn}, mode=${mode}, recentUserMsgs=${JSON.stringify(userMsgs.slice(-3))}`
    )

    // 每 1 turn 检查一次（2026-07-05 晚：从 5 改为 1）
    if (currentTurn % NUUDGE_CHECK_INTERVAL !== 0) {
      console.log(`[Nudge] 跳过：currentTurn ${currentTurn} % ${NUUDGE_CHECK_INTERVAL} !== 0`)
      return []
    }

    // 检测模式
    const patterns = this.detectPatterns(recentMessages, mode)
    console.log(`[Nudge] detectPatterns 返回 ${patterns.length} 个候选: ${JSON.stringify(patterns.map((p) => ({ type: p.type, pattern: p.pattern, count: p.count })))}`)

    // 过滤冷却中的层
    const candidates = patterns
      .filter((p) => {
        const layer = this.getLayerForType(p.type)
        const inCooldown = this.isInCooldown(sessionId, layer)
        if (inCooldown) {
          console.log(`[Nudge] 候选 ${p.type}（${layer}）在冷却中，过滤掉`)
        }
        return !inCooldown
      })
      .slice(0, MAX_CANDIDATES_PER_BATCH)
      .map((p) => this.createNudgeCandidate(p))

    // 缓存候选项
    if (candidates.length > 0) {
      this.pendingNudges.set(sessionId, candidates)
      console.log(`[Nudge] 返回 ${candidates.length} 个候选项，将弹 toast`)
    } else {
      console.log(`[Nudge] 返回 0 个候选项，不弹 toast`)
    }

    return candidates
  }

  /**
   * 检测模式
   */
  private detectPatterns(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    mode: MemoryMode
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

    // 4. 检测项目重复（同一 workspace_slug 下 ≥2 个会话 → 候选 L1）
    const projectPatterns = this.detectProjectRepeat(mode)
    patterns.push(...projectPatterns)

    return patterns
  }

  /**
   * 检测项目重复
   *
   * 设计文档 §6.5.4：用户加载项目 ≥2 次相似 → 候选 L1（询问是否存为模板）。
   *
   * 实现：读 L4 最近 50 个会话，按 workspace_slug 分组，
   * 同一 workspace 下 ≥2 个会话即触发（简化版，不做标题相似度判断）。
   *
   * 跨 session 检测——与 fact_repeat / behavior_repeat（当前 session 内检测）不同，
   * project_repeat 依赖 L4 历史数据，是真正的跨会话记忆。
   */
  private detectProjectRepeat(mode: MemoryMode): PatternMatch[] {
    const patterns: PatternMatch[] = []

    try {
      const sessions = memoryLayerService.listRecentSessions(mode, 50)
      if (sessions.length < 2) return patterns

      // 已处理过的 workspace（用户点过"记住"或"不记"）不再触发
      const handledSlugs = this.loadHandledProjects(mode)

      // 按 workspace_slug 分组（跳过 null + 跳过已处理）
      const byWorkspace = new Map<string, typeof sessions>()
      for (const s of sessions) {
        if (!s.workspace_slug) continue
        if (handledSlugs.has(s.workspace_slug)) continue
        const arr = byWorkspace.get(s.workspace_slug) ?? []
        arr.push(s)
        byWorkspace.set(s.workspace_slug, arr)
      }

      // 同一 workspace ≥2 个会话 → 候选
      for (const [slug, group] of byWorkspace) {
        if (group.length < 2) continue

        const titles = group
          .map((s) => s.title || '')
          .filter(Boolean)
          .slice(0, 5) // 证据最多 5 条
        if (titles.length === 0) continue

        patterns.push({
          type: 'project_repeat',
          pattern: slug,
          count: group.length,
          evidence: titles,
        })
      }
    } catch (e) {
      console.warn('[Nudge] detectProjectRepeat 失败:', e)
    }

    return patterns
  }

  /**
   * 加载已处理过的 project workspace slug 集合
   *
   * 用户点过"记住"（写入 L1_project.md）或"不记"（写入 nudges/rejected.jsonl）
   * 的 workspace，不再重复触发 project_repeat Nudge。
   *
   * 跨 session 持久化——与 L0/L1/L2/L3 冷却（按 sessionId 隔离）不同，
   * project_repeat 是跨 session 检测，已处理的 workspace 应该永久跳过。
   */
  private loadHandledProjects(mode: MemoryMode): Set<string> {
    const handled = new Set<string>()
    const dir = this.getMemoryDir(mode)

    // 1. 从 L1_project.md 读已存为模板的 workspace slug
    //    （L1 写入格式：`- [日期] 内容 <!-- ... src:slug8 -->`，但 pattern 字段就是 slug）
    const l1Path = path.join(dir, 'L1_project.md')
    if (fs.existsSync(l1Path)) {
      try {
        const content = fs.readFileSync(l1Path, 'utf-8')
        const lines = content.split('\n').filter((l) => l.startsWith('- '))
        for (const line of lines) {
          // 提取 src:xxx 元数据，或回退到整行包含 slug
          const srcMatch = line.match(/src:([^\s>]+)/)
          if (srcMatch) {
            handled.add(srcMatch[1]!)
          }
        }
      } catch {
        // 忽略读取失败
      }
    }

    // 2. 从 nudges/rejected.jsonl 读已拒绝的 project_repeat
    const rejectedPath = path.join(dir, 'nudges', 'rejected.jsonl')
    if (fs.existsSync(rejectedPath)) {
      try {
        const content = fs.readFileSync(rejectedPath, 'utf-8')
        const lines = content.split('\n').filter((l) => l.trim())
        for (const line of lines) {
          try {
            const record = JSON.parse(line) as { type?: string; pattern?: string }
            if (record.type === 'project_repeat' && record.pattern) {
              handled.add(record.pattern)
            }
          } catch {
            // 跳过无法解析的行
          }
        }
      } catch {
        // 忽略读取失败
      }
    }

    return handled
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

      // ≥2 次的行为作为候选（2026-07-05 晚：从 ≥3 降到 ≥2，降低触发门槛）
      for (const [pattern, evidence] of matches) {
        if (evidence.length >= 2) {
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
    // 2026-07-05 晚：放宽正则，覆盖"我叫 X" / "我喜欢 X" / "我是 X" / "我的 X 是 Y" 等日常表达
    const factPatterns = [
      /我[的之][^\s]{1,20}是[^\s]{1,20}/g, // "我的名字是 Frank"
      /(名字|邮箱|账号|地址|性别|年龄|职业|公司|学校|专业)[^\s]{0,5}[是为][^\s]{1,20}/g, // "名字是 Frank"
      /我叫[^\s]{1,20}/g, // "我叫 Frank"
      /我是[^\s]{1,20}/g, // "我是 Frank"
      /我喜欢[^\s]{1,20}/g, // "我喜欢简洁"
      /我爱[^\s]{1,20}/g, // "我爱吃火锅"
      /我用[^\s]{1,20}/g, // "我用 Mac"
      /我在[^\s]{1,20}/g, // "我在北京"
    ]

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

      // ≥1 次的事实作为候选（2026-07-05 晚：从 ≥2 降到 ≥1，单次表述就触发 Nudge）
      for (const [pattern, evidence] of matches) {
        if (evidence.length >= 1) {
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
  private detectCorrections(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): PatternMatch[] {
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
        return `你在「${pattern.pattern}」项目下有过 ${pattern.count} 次会话，要我存为项目模板吗？`
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
   * 获取指定会话待处理的 Nudge 候选项
   *
   * 由 IPC `GET_PENDING_NUDGES` 通道调用，供 UI（如设置页"待处理记忆"列表）拉取。
   * 主流程仍走事件推送（onTurnStart → memory:nudge-event），此方法仅作拉取兜底。
   */
  getPendingNudges(sessionId: string): NudgeCandidate[] {
    return this.pendingNudges.get(sessionId) ?? []
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
    mode: MemoryMode
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
        await this.appendMdFileWithDedup(path.join(dir, 'L0_user.md'), 'peer_view', nudge)
        break
      case 'L1':
        // L1 项目画像
        await this.appendMdFileWithDedup(path.join(dir, 'L1_project.md'), 'project', nudge)
        break
      case 'L2':
        // L2 稳定事实
        await this.appendMdFileWithDedup(path.join(dir, 'L2_facts.md'), 'fact', nudge)
        break
      case 'L3':
        // L3 纠错记录 - 追加到 corrections.jsonl
        await this.appendCorrection(dir, nudge)
        break
    }
  }

  /**
   * 追加内容到 Markdown 文件（带去重 + 结构化元数据）
   *
   * v1.5 升级（hermes-borrow-plan §5.2 修复 3）：
   * - 格式：`- [日期] 内容 <!-- hit:N last_ref:YYYY-MM-DD src:session8 -->`
   * - 去重：pattern 已存在则更新 hit_count + last_referenced_at，不重复写
   * - 元数据用 HTML 注释，markdown 渲染器忽略，人类仍可读
   * - 供 LRU / Self-Repair 使用
   */
  private async appendMdFileWithDedup(
    filePath: string,
    section: string,
    nudge: NudgeCandidate
  ): Promise<void> {
    const timestamp = new Date().toISOString().slice(0, 10)
    const content = nudge.suggestedContent
    const sourceSession = nudge.evidence[0]?.slice(0, 8) ?? ''

    if (!fs.existsSync(filePath)) {
      // 创建新文件
      const line = this.formatMemoryLine(timestamp, content, 1, timestamp, sourceSession)
      const header = `# ${section}\n\n${line}\n`
      await fs.promises.writeFile(filePath, header, 'utf-8')
      return
    }

    // 读现有内容，找是否已存在相同 pattern
    const existing = await fs.promises.readFile(filePath, 'utf-8')
    const dedupResult = this.findExistingLine(existing, content)

    if (dedupResult.found && dedupResult.line) {
      // 已存在：更新 hit_count + last_referenced_at
      const updatedLine = this.bumpHitCount(dedupResult.line, timestamp, sourceSession)
      const newContent = existing.replace(dedupResult.line, updatedLine)
      await fs.promises.writeFile(filePath, newContent, 'utf-8')
      console.log(
        `[Nudge] 去重更新：pattern="${content.slice(0, 30)}..." hit_count 增加`
      )
    } else {
      // 新增
      const line = this.formatMemoryLine(timestamp, content, 1, timestamp, sourceSession)
      await fs.promises.appendFile(filePath, line + '\n', 'utf-8')
    }
  }

  /**
   * 格式化记忆行（带结构化元数据注释）
   */
  private formatMemoryLine(
    date: string,
    content: string,
    hitCount: number,
    lastRef: string,
    sourceSession: string
  ): string {
    return `- [${date}] ${content} <!-- hit:${hitCount} last_ref:${lastRef} src:${sourceSession} -->`
  }

  /**
   * 在现有 .md 内容中查找已存在相同 pattern 的行
   *
   * 匹配规则：行包含 pattern 文本（去除元数据注释后比较）
   */
  private findExistingLine(
    content: string,
    pattern: string
  ): { found: boolean; line?: string } {
    const lines = content.split('\n')
    for (const line of lines) {
      if (!line.startsWith('- ')) continue
      // 去掉 HTML 注释后的纯文本
      const textOnly = line.replace(/<!--.*?-->/, '').trim()
      if (textOnly.includes(pattern)) {
        return { found: true, line }
      }
    }
    return { found: false }
  }

  /**
   * 增加 hit_count + 更新 last_referenced_at
   */
  private bumpHitCount(line: string, newDate: string, sourceSession: string): string {
    const match = line.match(/<!-- hit:(\d+) last_ref:([^ ]+) src:([^ ]*) -->/)
    if (!match) {
      // 老格式行（无元数据），补上元数据
      const textOnly = line.replace(/<!--.*?-->/, '').trim()
      return `${textOnly} <!-- hit:2 last_ref:${newDate} src:${sourceSession} -->`
    }
    const currentHit = parseInt(match[1] ?? '1', 10)
    const newHit = currentHit + 1
    return line.replace(
      /<!-- hit:\d+ last_ref:[^ ]+ src:[^ ]* -->/,
      `<!-- hit:${newHit} last_ref:${newDate} src:${sourceSession} -->`
    )
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
  registerCallback(
    sessionId: string,
    callback: (nudge: NudgeCandidate, result: NudgeResult) => void
  ): void {
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
