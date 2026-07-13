/**
 * MemoryEvidenceSink — 证据暂存层（ADR-0006 Phase 1）
 *
 * 前台逐 turn 辅助 LLM 调用被移除后，需要一个轻量级证据收集机制：
 * - Nudge 达到阈值时，将候选写入 pending_evidence.jsonl（不调用 LLM）
 * - recordSessionToMemory 写 L4 后标记 dirty（不调用 backfillKeyFacts）
 * - 后续空闲 MemoryConsolidationService 从 sink 消费证据，执行批量整理
 *
 * 设计约束：
 * - 单并发：任意时刻最多一个 batch 在处理
 * - 幂等：clearPendingEvidence 只清理已处理的条目
 * - 模式隔离：general / ta 的 evidence 和 dirty flag 独立
 * - 不写入 L0-L5：本层只收集证据，不直接修改记忆文件
 *
 * 接口（Phase 2 由 MemoryConsolidationService 实现）：
 * - consumePendingEvidence(mode) → 读取并返回证据，标记已消费
 * - markModeClean(mode) → 清除 dirty 标记
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { app } from 'electron'

import type { MemoryMode } from './memory-layer-service'
import type { NudgeCandidate } from './nudge-service'

// ===== 类型定义 =====

/** 待处理证据条目 */
export interface MemoryEvidenceEntry {
  /** 唯一 id */
  id: string
  /** 写入时间戳 */
  createdAt: number
  /** 来源模式 */
  mode: MemoryMode
  /** 证据来源：nudge（Nudge 候选阈值触发）、session（L4 记录完成） */
  source: 'nudge' | 'session'
  /** 会话 id */
  sessionId: string
  /** Nudge 候选（仅 source=nudge 时有值） */
  nudgeCandidate?: NudgeCandidate
  /** 会话标题（仅 source=session 时有值） */
  sessionTitle?: string
  /** 会话摘要（仅 source=session 时有值） */
  sessionSummary?: string
  /** 使用的工具（仅 source=session 时有值） */
  toolsUsed?: string[]
}

// ===== 配置 =====

/** pending_evidence.jsonl 最大行数（超出后截断旧条目，保留最近 MAX_ENTRIES 条） */
const MAX_ENTRIES = 500

// ===== 工具函数 =====

/**
 * 获取 pending_evidence.jsonl 路径
 */
function getEvidenceFilePath(mode: MemoryMode): string {
  const isDev = !app.isPackaged
  const baseDir = isDev
    ? path.join(app.getPath('home'), '.tagent-dev')
    : path.join(app.getPath('home'), '.tagent')
  const dir = mode === 'general' ? path.join(baseDir, 'memory') : path.join(baseDir, 'ta', 'memory')
  return path.join(dir, 'pending_evidence.jsonl')
}

/**
 * 获取 dirty flag 文件路径
 *
 * 用一个简单的 JSON 文件记录每个模式是否有未处理证据。
 * Phase 2 MemoryConsolidationService 消费后会清除此标记。
 */
function getDirtyFilePath(mode: MemoryMode): string {
  const isDev = !app.isPackaged
  const baseDir = isDev
    ? path.join(app.getPath('home'), '.tagent-dev')
    : path.join(app.getPath('home'), '.tagent')
  const dir = mode === 'general' ? path.join(baseDir, 'memory') : path.join(baseDir, 'ta', 'memory')
  return path.join(dir, 'dirty_state.json')
}

// ===== MemoryEvidenceSink =====

class MemoryEvidenceSink {
  /** 内存中缓存的 dirty 状态（避免每次读磁盘） */
  private dirtyFlags: Map<MemoryMode, boolean> = new Map()

  /**
   * 写入 Nudge 证据（Nudge 候选达到阈值时调用）
   *
   * 不调用 LLM，只将候选追加到 pending_evidence.jsonl。
   * Phase 2 由 MemoryConsolidationService 消费。
   */
  writeNudgeEvidence(mode: MemoryMode, sessionId: string, candidate: NudgeCandidate): void {
    const entry: MemoryEvidenceEntry = {
      id: `ev-nudge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      mode,
      source: 'nudge',
      sessionId,
      nudgeCandidate: candidate,
    }
    this.appendEntry(mode, entry)
    this.markModeDirty(mode)
  }

  /**
   * 写入会话记录证据（recordSessionToMemory 写 L4 后调用）
   *
   * 不调用 backfillKeyFacts LLM，只记录 session 元数据。
   * Phase 2 由 MemoryConsolidationService 批量提取 keyFacts。
   */
  writeSessionEvidence(
    mode: MemoryMode,
    sessionId: string,
    title: string,
    summary: string,
    toolsUsed: string[]
  ): void {
    const entry: MemoryEvidenceEntry = {
      id: `ev-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      mode,
      source: 'session',
      sessionId,
      sessionTitle: title,
      sessionSummary: summary,
      toolsUsed,
    }
    this.appendEntry(mode, entry)
    this.markModeDirty(mode)
  }

  /**
   * 追加条目到 pending_evidence.jsonl
   *
   * 文件不存在时自动创建。超出 MAX_ENTRIES 时截断旧条目。
   */
  private appendEntry(mode: MemoryMode, entry: MemoryEvidenceEntry): void {
    const filePath = getEvidenceFilePath(mode)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    try {
      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8')

      // 截断检查：如果行数超出 MAX_ENTRIES，保留最近的条目
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter((l) => l.trim())
      if (lines.length > MAX_ENTRIES) {
        const trimmed = lines.slice(-MAX_ENTRIES)
        fs.writeFileSync(filePath, trimmed.join('\n') + '\n', 'utf-8')
        console.log(
          `[MemoryEvidenceSink] 截断 ${mode} 证据文件：${lines.length} → ${MAX_ENTRIES} 条`
        )
      }
    } catch (e) {
      console.warn(`[MemoryEvidenceSink] 写入证据失败:`, e)
    }
  }

  /**
   * 标记模式为 dirty（有未处理证据）
   */
  markModeDirty(mode: MemoryMode): void {
    this.dirtyFlags.set(mode, true)
    const filePath = getDirtyFilePath(mode)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    try {
      fs.writeFileSync(
        filePath,
        JSON.stringify({ dirty: true, updatedAt: Date.now() }) + '\n',
        'utf-8'
      )
    } catch (e) {
      console.warn(`[MemoryEvidenceSink] 标记 dirty 失败:`, e)
    }
  }

  /**
   * 检查模式是否有未处理证据
   */
  isModeDirty(mode: MemoryMode): boolean {
    if (this.dirtyFlags.has(mode)) {
      return this.dirtyFlags.get(mode)!
    }
    // 从磁盘读取
    const filePath = getDirtyFilePath(mode)
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8').trim()
        if (content) {
          const state = JSON.parse(content) as { dirty?: boolean }
          const dirty = state.dirty === true
          this.dirtyFlags.set(mode, dirty)
          return dirty
        }
      }
    } catch {
      // 忽略解析错误
    }
    return false
  }

  /**
   * 清除模式的 dirty 标记（Phase 2 批量整理完成后调用）
   */
  markModeClean(mode: MemoryMode): void {
    this.dirtyFlags.set(mode, false)
    const filePath = getDirtyFilePath(mode)
    try {
      if (fs.existsSync(filePath)) {
        fs.writeFileSync(
          filePath,
          JSON.stringify({ dirty: false, updatedAt: Date.now() }) + '\n',
          'utf-8'
        )
      }
    } catch (e) {
      console.warn(`[MemoryEvidenceSink] 清除 dirty 失败:`, e)
    }
  }

  /**
   * 读取待处理证据（Phase 2 MemoryConsolidationService 调用）
   *
   * 返回所有 pending 证据，调用方处理后需调用 clearPendingEvidence 清理。
   */
  getPendingEvidence(mode: MemoryMode): MemoryEvidenceEntry[] {
    const filePath = getEvidenceFilePath(mode)
    if (!fs.existsSync(filePath)) {
      return []
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const entries: MemoryEvidenceEntry[] = []
      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        try {
          entries.push(JSON.parse(line) as MemoryEvidenceEntry)
        } catch {
          // 单行解析失败跳过
        }
      }
      return entries
    } catch (e) {
      console.warn(`[MemoryEvidenceSink] 读取证据失败:`, e)
      return []
    }
  }

  /**
   * 清理已消费的证据（Phase 2 批量整理完成后调用）
   *
   * 可选择性清理：传入已处理的 sessionId 集合，只删除这些条目。
   * 不传则清空全部。
   */
  clearPendingEvidence(mode: MemoryMode, processedSessionIds?: Set<string>): void {
    const filePath = getEvidenceFilePath(mode)
    if (!fs.existsSync(filePath)) return

    if (!processedSessionIds) {
      // 清空全部
      try {
        fs.writeFileSync(filePath, '', 'utf-8')
      } catch (e) {
        console.warn(`[MemoryEvidenceSink] 清空证据失败:`, e)
      }
      return
    }

    // 选择性清理：只删除已处理的 sessionId 对应条目
    try {
      const entries = this.getPendingEvidence(mode)
      const remaining = entries.filter(
        (e) => !processedSessionIds.has(e.sessionId)
      )
      const content =
        remaining.map((e) => JSON.stringify(e)).join('\n') +
        (remaining.length > 0 ? '\n' : '')
      fs.writeFileSync(filePath, content, 'utf-8')
      console.log(
        `[MemoryEvidenceSink] 清理 ${mode} 证据：${entries.length} → ${remaining.length} 条`
      )
    } catch (e) {
      console.warn(`[MemoryEvidenceSink] 选择性清理证据失败:`, e)
    }
  }

  /**
   * 获取证据统计（UI / Memory Monitor 用）
   */
  getEvidenceStats(mode: MemoryMode): {
    pendingCount: number
    oldestEntryAt: number | null
    dirty: boolean
  } {
    const entries = this.getPendingEvidence(mode)
    const dirty = this.isModeDirty(mode)
    if (entries.length === 0) {
      return { pendingCount: 0, oldestEntryAt: null, dirty }
    }
    const oldest = entries.reduce(
      (min, e) => (e.createdAt < min ? e.createdAt : min),
      entries[0]!.createdAt
    )
    return { pendingCount: entries.length, oldestEntryAt: oldest, dirty }
  }
}

// 导出类（供测试注入独立实例）+ 单例
export { MemoryEvidenceSink }
export const memoryEvidenceSink = new MemoryEvidenceSink()
