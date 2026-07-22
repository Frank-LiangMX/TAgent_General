/**
 * CSV 看板产物记忆
 *
 * 按 Agent 会话持久化最近生成的 CSV 看板摘要，
 * 供 buildDynamicContext 注入，避免后续轮次 Read HTML。
 */

import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { getAgentSessionCsvArtifactsPath } from './config-paths'
import { stopCsvLiveServer } from './tools/csv-live-server'
import { getCsvCacheRoot } from './tools/csv-shared'

/** 单个 CSV 看板产物摘要 */
export interface CsvArtifact {
  csvSessionId: string
  title: string
  byte_unit: string
  views: string[]
  file_path: string
  last_action: string
  updatedAt: string
}

/** 每个 Agent 会话最多保留的产物条数 */
const MAX_ARTIFACTS = 5

/** 动态上下文 ops 提示（与工具返回值一致） */
export const CSV_ARTIFACT_OPS_HINT =
  '改单位→patch；专注页→live_tab/slice(默认内存)；固化切片→slice(persist=true)；改底盘→replace_view；禁止 Read HTML'

function readArtifactStore(agentSessionId: string): CsvArtifact[] {
  const filePath = getAgentSessionCsvArtifactsPath(agentSessionId)

  if (!existsSync(filePath)) {
    return []
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item): item is CsvArtifact =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as CsvArtifact).csvSessionId === 'string'
    )
  } catch (error) {
    console.error(`[CSV 产物记忆] 读取失败 (${agentSessionId}):`, error)
    return []
  }
}

function writeArtifactStore(agentSessionId: string, artifacts: CsvArtifact[]): void {
  const filePath = getAgentSessionCsvArtifactsPath(agentSessionId)

  try {
    writeFileSync(filePath, JSON.stringify(artifacts, null, 2), 'utf-8')
  } catch (error) {
    console.error(`[CSV 产物记忆] 写入失败 (${agentSessionId}):`, error)
    throw new Error('写入 CSV 产物记忆失败')
  }
}

/**
 * 列出 Agent 会话下已记录的 CSV 看板产物（按 updatedAt 降序）
 */
export function listCsvArtifacts(agentSessionId: string): CsvArtifact[] {
  return readArtifactStore(agentSessionId).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * 记录或更新 CSV 看板产物
 *
 * 同 csvSessionId 则更新；超出 MAX_ARTIFACTS 时丢弃最旧条目。
 */
export function recordCsvArtifact(
  agentSessionId: string,
  artifact: Omit<CsvArtifact, 'updatedAt'> & { updatedAt?: string }
): void {
  const now = artifact.updatedAt ?? new Date().toISOString()
  const entry: CsvArtifact = { ...artifact, updatedAt: now }

  const existing = readArtifactStore(agentSessionId)
  const withoutSame = existing.filter((a) => a.csvSessionId !== entry.csvSessionId)
  const next = [entry, ...withoutSame]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_ARTIFACTS)

  writeArtifactStore(agentSessionId, next)
}

/**
 * 构建注入 user message 的紧凑 csv_artifacts 块（≤10 行）
 */
export function buildCsvArtifactsContextBlock(agentSessionId: string): string | null {
  const artifacts = listCsvArtifacts(agentSessionId)
  if (artifacts.length === 0) {
    return null
  }

  const lines: string[] = [
    `本会话已有 ${artifacts.length} 个 CSV 看板（保留最近 ${MAX_ARTIFACTS} 个）：`,
  ]

  for (const a of artifacts) {
    const viewStr = a.views.length > 0 ? a.views.join(',') : '(无)'
    lines.push(
      `- session_id=${a.csvSessionId} | 「${a.title}」| 单位: ${a.byte_unit} | 视图: ${viewStr} | 最近: ${a.last_action}`
    )
    lines.push(`  路径: ${a.file_path}`)
  }

  lines.push(CSV_ARTIFACT_OPS_HINT)

  // 硬限制行数，避免动态上下文膨胀
  const trimmed = lines.slice(0, 10)
  if (lines.length > 10) {
    trimmed.push('…（更多产物已省略，请用 csv_dashboard 工具操作，勿 Read HTML）')
  }

  return `<csv_artifacts>\n${trimmed.join('\n')}\n</csv_artifacts>`
}

/**
 * 删除 Agent 会话时清理其绑定的 CSV 缓存与产物索引。
 *
 * 仅处理 artifacts 列表中记录的 csvSessionId，不扫描整个 csv-cache，
 * 避免误删其他 Agent 会话或未索引的缓存。
 */
export function clearAgentSessionCsvCache(agentSessionId: string): void {
  const artifactsPath = getAgentSessionCsvArtifactsPath(agentSessionId)
  const artifacts = listCsvArtifacts(agentSessionId)
  const csvSessionIds = [...new Set(artifacts.map((a) => a.csvSessionId))]

  if (csvSessionIds.length === 0 && !existsSync(artifactsPath)) {
    return
  }

  const cacheRoot = getCsvCacheRoot()

  for (const csvSessionId of csvSessionIds) {
    stopCsvLiveServer(csvSessionId)

    const sessionDir = join(cacheRoot, csvSessionId)
    if (existsSync(sessionDir)) {
      try {
        rmSync(sessionDir, { recursive: true, force: true })
        console.log(`[CSV 缓存] 已删除会话数据目录: ${sessionDir}`)
      } catch (error) {
        console.warn(`[CSV 缓存] 删除会话数据目录失败 (${csvSessionId}):`, error)
      }
    }

    const dashboardDir = join(cacheRoot, `${csvSessionId}-dashboard`)
    if (existsSync(dashboardDir)) {
      try {
        rmSync(dashboardDir, { recursive: true, force: true })
        console.log(`[CSV 缓存] 已删除看板目录: ${dashboardDir}`)
      } catch (error) {
        console.warn(`[CSV 缓存] 删除看板目录失败 (${csvSessionId}):`, error)
      }
    }
  }

  if (existsSync(artifactsPath)) {
    try {
      unlinkSync(artifactsPath)
      console.log(`[CSV 缓存] 已删除产物索引: ${artifactsPath}`)
    } catch (error) {
      console.warn(`[CSV 缓存] 删除产物索引失败 (${agentSessionId}):`, error)
    }
  }
}
