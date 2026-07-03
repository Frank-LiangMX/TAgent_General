/**
 * Automation Prompt 拦截日志持久化
 *
 * 拦截日志独立存放在 ~/.tagent[-dev]/automation/logs/ 下，
 * 不混入 automations.json，避免运行历史膨胀影响主索引读写性能。
 *
 * 每次拦截写一个 JSON 文件：{automationId}_{timestamp}.json
 * 同时维护一个 index.json 索引（按时间倒序），便于 UI 列表加载。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { getConfigDir } from './config-paths'
import type { BlockedLogEntry, BlockedLogSummary } from './automation-prompt-scanner'

/** 单个 automation 拦截日志保留上限（避免无限膨胀） */
const MAX_LOGS_PER_AUTOMATION = 50

/** 全局拦截日志保留上限（所有 automation 合计） */
const MAX_TOTAL_LOGS = 500

/**
 * 获取拦截日志目录路径
 *
 * 如果目录不存在则自动创建。
 * @returns ~/.tagent[-dev]/automation/logs/
 */
export function getAutomationBlockedLogsDir(): string {
  const dir = join(getConfigDir(), 'automation', 'logs')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[定时任务拦截] 已创建拦截日志目录: ${dir}`)
  }
  return dir
}

/**
 * 写入一条拦截日志
 *
 * 文件名格式：{automationId}_{timestamp}.json
 * 同时更新 index.json（按时间倒序，最多保留 MAX_TOTAL_LOGS 条）
 */
export function writeBlockedLog(entry: BlockedLogEntry): string {
  const dir = getAutomationBlockedLogsDir()
  const fileName = `${entry.automationId}_${entry.timestamp}.json`
  const filePath = join(dir, fileName)

  writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8')

  // 维护单 automation 上限：删除该 automation 的旧日志
  pruneLogsForAutomation(dir, entry.automationId, MAX_LOGS_PER_AUTOMATION)
  // 维护全局上限：删除最旧的全局日志
  pruneGlobalLogs(dir, MAX_TOTAL_LOGS)

  return filePath
}

/**
 * 列出所有拦截日志摘要（按时间倒序）
 *
 * 不返回完整 originalPrompt，避免 UI 列表加载时一次性拉取大量文本。
 * 详情通过 getBlockedLogDetail(fileName) 单独取。
 */
export function listBlockedLogs(): BlockedLogSummary[] {
  const dir = getAutomationBlockedLogsDir()
  if (!existsSync(dir)) return []

  const entries = readdirSync(dir, { withFileTypes: true })
  const summaries: BlockedLogSummary[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.json')) continue
    if (entry.name === 'index.json') continue

    try {
      const raw = readFileSync(join(dir, entry.name), 'utf-8')
      const parsed = JSON.parse(raw) as BlockedLogEntry
      summaries.push({
        fileName: entry.name,
        timestamp: parsed.timestamp,
        automationId: parsed.automationId,
        automationName: parsed.automationName,
        reasons: parsed.reasons,
        patterns: parsed.patterns,
        stage: parsed.stage,
        strippedInvisibleCount: parsed.strippedInvisibleCount,
      })
    } catch {
      // 损坏的日志文件跳过，不阻塞列表加载
      console.warn(`[定时任务拦截] 日志文件解析失败，跳过: ${entry.name}`)
    }
  }

  // 按时间倒序（最新在前）
  summaries.sort((a, b) => b.timestamp - a.timestamp)
  return summaries
}

/**
 * 获取单条拦截日志完整内容（含 originalPrompt / sanitizedPrompt）
 */
export function getBlockedLogDetail(fileName: string): BlockedLogEntry | null {
  const dir = getAutomationBlockedLogsDir()
  const filePath = join(dir, fileName)

  // 防止路径穿越：fileName 必须是纯文件名，不含分隔符
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return null
  }
  if (!filePath.startsWith(dir)) {
    return null
  }

  if (!existsSync(filePath)) return null

  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as BlockedLogEntry
  } catch {
    return null
  }
}

/**
 * 删除单条拦截日志
 */
export function deleteBlockedLog(fileName: string): boolean {
  const dir = getAutomationBlockedLogsDir()
  // 路径穿越防护
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return false
  }
  const filePath = join(dir, fileName)
  if (!filePath.startsWith(dir)) return false
  if (!existsSync(filePath)) return false

  try {
    unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 清空指定 automation 的所有拦截日志
 */
export function clearBlockedLogsForAutomation(automationId: string): number {
  const dir = getAutomationBlockedLogsDir()
  if (!existsSync(dir)) return 0

  let count = 0
  const prefix = `${automationId}_`
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.json')) {
      try {
        unlinkSync(join(dir, entry.name))
        count++
      } catch {
        // 单条删除失败不阻塞
      }
    }
  }
  return count
}

/**
 * 维护单 automation 拦截日志数量上限
 * 删除该 automation 最旧的日志，直到数量 <= maxLogs
 */
function pruneLogsForAutomation(dir: string, automationId: string, maxLogs: number): void {
  const prefix = `${automationId}_`
  const files: Array<{ name: string; timestamp: number }> = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.startsWith(prefix) || !entry.name.endsWith('.json')) continue
    // 从文件名提取 timestamp（格式：{automationId}_{timestamp}.json）
    const match = entry.name.match(/_(\d+)\.json$/)
    if (!match) continue
    files.push({ name: entry.name, timestamp: Number(match[1]) })
  }

  if (files.length <= maxLogs) return

  // 按 timestamp 升序（最旧在前），删除超出部分
  files.sort((a, b) => a.timestamp - b.timestamp)
  const toDelete = files.slice(0, files.length - maxLogs)
  for (const f of toDelete) {
    try {
      unlinkSync(join(dir, f.name))
    } catch {
      // 单条删除失败不阻塞
    }
  }
}

/**
 * 维护全局拦截日志数量上限
 * 删除最旧的日志（所有 automation 合并排序），直到总数 <= maxLogs
 */
function pruneGlobalLogs(dir: string, maxLogs: number): void {
  const files: Array<{ name: string; timestamp: number }> = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const match = entry.name.match(/_(\d+)\.json$/)
    if (!match) continue
    files.push({ name: entry.name, timestamp: Number(match[1]) })
  }

  if (files.length <= maxLogs) return

  files.sort((a, b) => a.timestamp - b.timestamp)
  const toDelete = files.slice(0, files.length - maxLogs)
  for (const f of toDelete) {
    try {
      unlinkSync(join(dir, f.name))
    } catch {
      // 单条删除失败不阻塞
    }
  }
}
