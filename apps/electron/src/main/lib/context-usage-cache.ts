import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

import type { ContextUsageSnapshot } from '@tagent/shared'
import { normalizeContextUsageSnapshot } from '@tagent/shared'

import { getAgentSessionContextUsagePath } from './config-paths'

/** 会话级 Context 分项：内存缓存 + 磁盘持久化（重启后可恢复 Popover 分项） */
const contextUsageCache = new Map<string, ContextUsageSnapshot>()

function isContextUsageSnapshot(value: unknown): value is ContextUsageSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<ContextUsageSnapshot>
  return (
    Array.isArray(snapshot.categories) &&
    typeof snapshot.totalTokens === 'number' &&
    typeof snapshot.maxTokens === 'number' &&
    typeof snapshot.percentage === 'number'
  )
}

function loadContextUsageFromDisk(sessionId: string): ContextUsageSnapshot | undefined {
  const filePath = getAgentSessionContextUsagePath(sessionId)
  if (!existsSync(filePath)) return undefined

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'))
    if (!isContextUsageSnapshot(parsed)) {
      console.warn(`[Context 分项] 磁盘快照格式无效，已忽略: ${sessionId}`)
      return undefined
    }
    return normalizeContextUsageSnapshot(parsed)
  } catch (error) {
    console.warn(`[Context 分项] 读取磁盘快照失败: ${sessionId}`, error)
    return undefined
  }
}

function persistContextUsageToDisk(sessionId: string, snapshot: ContextUsageSnapshot): void {
  const filePath = getAgentSessionContextUsagePath(sessionId)
  try {
    writeFileSync(filePath, JSON.stringify(snapshot), 'utf-8')
  } catch (error) {
    console.warn(`[Context 分项] 写入磁盘快照失败: ${sessionId}`, error)
  }
}

export function setContextUsageCache(sessionId: string, snapshot: ContextUsageSnapshot): void {
  contextUsageCache.set(sessionId, snapshot)
  persistContextUsageToDisk(sessionId, snapshot)
}

export function getContextUsageCache(sessionId: string): ContextUsageSnapshot | undefined {
  const memory = contextUsageCache.get(sessionId)
  if (memory) return memory

  const disk = loadContextUsageFromDisk(sessionId)
  if (disk) {
    contextUsageCache.set(sessionId, disk)
    return disk
  }

  return undefined
}

export function clearContextUsageCache(sessionId: string): void {
  contextUsageCache.delete(sessionId)

  const filePath = getAgentSessionContextUsagePath(sessionId)
  if (!existsSync(filePath)) return

  try {
    unlinkSync(filePath)
  } catch (error) {
    console.warn(`[Context 分项] 删除磁盘快照失败: ${sessionId}`, error)
  }
}

/** 供单测使用的快照校验 */
export function validateContextUsageSnapshot(value: unknown): value is ContextUsageSnapshot {
  return isContextUsageSnapshot(value)
}
