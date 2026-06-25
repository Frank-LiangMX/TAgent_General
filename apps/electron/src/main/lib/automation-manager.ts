/**
 * Automation 持久化管理器
 *
 * 负责定时任务的 CRUD、启停、运行历史追加和持久化。
 * 数据存储在 ~/.tagent[-dev]/automations.json。
 */

import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
  RunStatus,
} from '@tagent/shared'
import {
  AUTOMATION_MAX_HISTORY,
  AUTOMATION_MAX_CONSECUTIVE_FAILURES,
  AUTOMATION_DEFAULT_SESSION_MODE,
  AUTOMATION_DEFAULT_PERMISSION_MODE,
  computeNextRunAt,
  formatScheduleLabel,
  isSameLocalDay,
} from '@tagent/shared'

export { computeNextRunAt, formatScheduleLabel, isSameLocalDay }

import { getConfigDir } from './config-paths'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'

// ===== 持久化 =====

interface AutomationStore {
  version: number
  automations: Automation[]
}

const STORE_VERSION = 1

function getStorePath(): string {
  return join(getConfigDir(), 'automations.json')
}

function readStore(): AutomationStore {
  const path = getStorePath()
  const data = readJsonFileSafe<AutomationStore>(path)
  if (data && data.version === STORE_VERSION) return data
  return { version: STORE_VERSION, automations: [] }
}

function writeStore(store: AutomationStore): void {
  writeJsonFileAtomic(getStorePath(), store)
}

// ===== CRUD =====

/** 获取全部定时任务 */
export function listAutomations(): Automation[] {
  return readStore().automations
}

/** 按 ID 获取单个定时任务 */
export function getAutomation(id: string): Automation | undefined {
  return readStore().automations.find((a) => a.id === id)
}

/** 创建定时任务 */
export function createAutomation(input: CreateAutomationInput): Automation {
  const store = readStore()
  const now = Date.now()

  const automation: Automation = {
    id: randomUUID(),
    name: input.name,
    prompt: input.prompt,
    enabled: input.active ?? true,
    scheduleType: input.scheduleType,
    intervalMinutes: input.intervalMinutes,
    timeOfDay: input.timeOfDay,
    dayOfWeek: input.dayOfWeek,
    dayOfMonth: input.dayOfMonth,
    scheduledAt: input.scheduledAt,
    maxRuns: input.maxRuns,
    channelId: input.channelId,
    modelId: input.modelId,
    workspaceId: input.workspaceId,
    sessionMode: input.sessionMode ?? AUTOMATION_DEFAULT_SESSION_MODE,
    permissionMode: input.permissionMode ?? AUTOMATION_DEFAULT_PERMISSION_MODE,
    notification: input.notification ?? { system: true },
    sourceSessionId: input.sourceSessionId,
    createdAt: now,
    updatedAt: now,
    nextRunAt: computeNextRunAt(
      {
        scheduleType: input.scheduleType,
        intervalMinutes: input.intervalMinutes,
        timeOfDay: input.timeOfDay,
        dayOfWeek: input.dayOfWeek,
        dayOfMonth: input.dayOfMonth,
        scheduledAt: input.scheduledAt,
        enabled: true,
        runCount: 0,
      } as Automation,
      now
    ),
    consecutiveFailures: 0,
    runCount: 0,
    runHistory: [],
  }

  store.automations.push(automation)
  writeStore(store)
  return automation
}

/** 更新定时任务 */
export function updateAutomation(input: UpdateAutomationInput): Automation {
  const store = readStore()
  const idx = store.automations.findIndex((a) => a.id === input.id)
  if (idx === -1) throw new Error(`定时任务不存在: ${input.id}`)

  const existing = store.automations[idx]!
  const updated: Automation = {
    ...existing,
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
    updatedAt: Date.now(),
  }

  // 如果调度配置变了，重新计算 nextRunAt
  if (
    input.scheduleType !== undefined ||
    input.intervalMinutes !== undefined ||
    input.timeOfDay !== undefined ||
    input.dayOfWeek !== undefined ||
    input.dayOfMonth !== undefined ||
    input.scheduledAt !== undefined
  ) {
    updated.nextRunAt = computeNextRunAt(updated, Date.now())
  }

  store.automations[idx] = updated
  writeStore(store)
  return updated
}

/** 删除定时任务 */
export function deleteAutomation(id: string): void {
  const store = readStore()
  store.automations = store.automations.filter((a) => a.id !== id)
  writeStore(store)
}

/** 切换启用/暂停 */
export function toggleAutomation(id: string): Automation {
  const store = readStore()
  const automation = store.automations.find((a) => a.id === id)
  if (!automation) throw new Error(`定时任务不存在: ${id}`)

  automation.enabled = !automation.enabled
  automation.updatedAt = Date.now()

  // 重新启用时重置 completedAt
  if (automation.enabled) {
    automation.completedAt = undefined
    automation.nextRunAt = computeNextRunAt(automation, Date.now())
  }

  writeStore(store)
  return automation
}

// ===== 运行历史 =====

/** 追加运行历史（截断 AUTOMATION_MAX_HISTORY） */
export function appendRun(automationId: string, run: AutomationRun): void {
  const store = readStore()
  const automation = store.automations.find((a) => a.id === automationId)
  if (!automation) return

  automation.runHistory.push(run)
  // 截断保留最新 N 条
  if (automation.runHistory.length > AUTOMATION_MAX_HISTORY) {
    automation.runHistory = automation.runHistory.slice(-AUTOMATION_MAX_HISTORY)
  }

  automation.updatedAt = Date.now()
  writeStore(store)
}

/** 更新运行后状态（失败退避 + maxRuns 检查） */
export function updateAfterRun(
  automationId: string,
  run: { status: RunStatus; error?: string }
): void {
  const store = readStore()
  const automation = store.automations.find((a) => a.id === automationId)
  if (!automation) return

  const now = Date.now()
  automation.runCount = (automation.runCount ?? 0) + 1
  automation.lastRunAt = now
  automation.nextRunAt = computeNextRunAt(automation, now)

  if (run.status === 'failed') {
    automation.consecutiveFailures = (automation.consecutiveFailures ?? 0) + 1
    // 连续失败达上限自动暂停
    if (automation.consecutiveFailures >= AUTOMATION_MAX_CONSECUTIVE_FAILURES) {
      automation.enabled = false
      console.warn(
        `[定时任务] ${automation.name} 连续失败 ${automation.consecutiveFailures} 次，已自动暂停`
      )
    }
  } else {
    automation.consecutiveFailures = 0
  }

  // maxRuns 检查（once 模式语义上等价于 maxRuns=1）
  if (automation.maxRuns && automation.runCount >= automation.maxRuns) {
    automation.enabled = false
    automation.completedAt = now
  }

  automation.updatedAt = now
  writeStore(store)
}

/** 设置下次运行时间 */
export function setNextRunAt(id: string, nextRunAt: number): void {
  const store = readStore()
  const automation = store.automations.find((a) => a.id === id)
  if (!automation) return
  automation.nextRunAt = nextRunAt
  automation.updatedAt = Date.now()
  writeStore(store)
}

/** 设置最近一次运行的会话 ID */
export function setLastSessionId(id: string, sessionId: string): void {
  const store = readStore()
  const automation = store.automations.find((a) => a.id === id)
  if (!automation) return
  automation.lastSessionId = sessionId
  automation.updatedAt = Date.now()
  writeStore(store)
}

