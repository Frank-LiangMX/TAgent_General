/**
 * Skill 固化扫描入口：从近期会话 JSONL 抽工具序列 → 识别 → 自动创建
 *
 * 在 Reflect 完成后 / App 启动后异步调用（不阻塞 UI）。
 */

import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { getAgentSessionsDir, getAgentSessionMessagesPath } from './config-paths'
import { getAgentSessionMessages, listAgentSessions } from './agent-session-manager'
import {
  applyWorkflowPatterns,
  detectRepeatedWorkflows,
  extractToolSequenceFromMessages,
  type SessionToolTrace,
} from './skill-workflow-detector'

export interface SkillCurationScanResult {
  sessionsScanned: number
  tracesUsed: number
  patterns: number
  skillsCreated: string[]
  candidatesWritten: number
  skipped: Array<{ slug: string; reason: string }>
  error?: string
}

/**
 * 扫描近期会话并自动固化达门槛的工作流
 *
 * @param options.limitSessions 最多扫描会话数，默认 80
 * @param options.autoCreate 是否自动 createSkill，默认 true
 */
export function runSkillCurationScan(options?: {
  limitSessions?: number
  autoCreate?: boolean
}): SkillCurationScanResult {
  const limit = options?.limitSessions ?? 80
  const result: SkillCurationScanResult = {
    sessionsScanned: 0,
    tracesUsed: 0,
    patterns: 0,
    skillsCreated: [],
    candidatesWritten: 0,
    skipped: [],
  }

  try {
    let sessionIds: string[] = []
    try {
      const metas = listAgentSessions()
      sessionIds = metas
        .slice()
        .sort((a, b) => {
          const ta = a.updatedAt ?? a.createdAt ?? 0
          const tb = b.updatedAt ?? b.createdAt ?? 0
          return tb - ta
        })
        .slice(0, limit)
        .map((m) => m.id)
    } catch {
      // listAgentSessions 失败时回退扫目录
      const dir = getAgentSessionsDir()
      if (existsSync(dir)) {
        sessionIds = readdirSync(dir)
          .filter((f) => f.endsWith('.jsonl'))
          .map((f) => f.replace(/\.jsonl$/, ''))
          .slice(0, limit)
      }
    }

    const titleById = new Map<string, string | undefined>()
    try {
      for (const m of listAgentSessions()) {
        titleById.set(m.id, m.title)
      }
    } catch {
      // ignore
    }

    const traces: SessionToolTrace[] = []
    for (const sessionId of sessionIds) {
      result.sessionsScanned++
      try {
        // 确认文件存在，避免无意义 IO
        const path = getAgentSessionMessagesPath(sessionId)
        if (!existsSync(path)) continue
        const messages = getAgentSessionMessages(sessionId)
        const tools = extractToolSequenceFromMessages(messages as unknown[])
        if (tools.length === 0) continue
        traces.push({
          sessionId,
          tools,
          title: titleById.get(sessionId),
        })
      } catch (err) {
        console.warn(`[SkillCuration] 跳过会话 ${sessionId}:`, err)
      }
    }

    result.tracesUsed = traces.length
    const patterns = detectRepeatedWorkflows(traces)
    result.patterns = patterns.length
    const applied = applyWorkflowPatterns(patterns, {
      autoCreate: options?.autoCreate !== false,
    })
    result.skillsCreated = applied.skillsCreated
    result.candidatesWritten = applied.candidatesWritten
    result.skipped = applied.skipped

    console.log(
      `[SkillCuration] 扫描会话 ${result.sessionsScanned}，轨迹 ${result.tracesUsed}，模式 ${result.patterns}，新建 skill ${result.skillsCreated.length}`
    )
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[SkillCuration] 扫描失败:', err)
  }

  return result
}

/** fire-and-forget 后台扫描（启动 / Reflect 后） */
export function scheduleSkillCurationScan(delayMs = 8000): void {
  setTimeout(() => {
    try {
      runSkillCurationScan({ autoCreate: true })
    } catch (err) {
      console.error('[SkillCuration] 后台扫描异常:', err)
    }
  }, delayMs)
}
