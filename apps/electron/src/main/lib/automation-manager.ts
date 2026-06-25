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
} from '@tagent/shared'

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

// ===== 调度时间计算 =====

/**
 * 计算下次运行时间
 *
 * 调度策略：
 * - interval: 上次运行时间 + intervalMinutes
 * - daily: 今天/明天的 timeOfDay
 * - weekly: 本周/下周的 dayOfWeek + timeOfDay
 * - monthly: 下月的 dayOfMonth + timeOfDay（短月落到月末）
 * - once: 返回 scheduledAt（一次性）
 */
export function computeNextRunAt(
  automation: Pick<
    Automation,
    | 'scheduleType'
    | 'intervalMinutes'
    | 'timeOfDay'
    | 'dayOfWeek'
    | 'dayOfMonth'
    | 'scheduledAt'
    | 'enabled'
    | 'lastRunAt'
    | 'runCount'
    | 'maxRuns'
  >,
  now: number
): number {
  if (!automation.enabled) return 0
  if (automation.maxRuns && (automation.runCount ?? 0) >= automation.maxRuns) return 0

  const nowDate = new Date(now)

  switch (automation.scheduleType) {
    case 'interval': {
      const last = automation.lastRunAt ?? now
      return last + (automation.intervalMinutes ?? 60) * 60_000
    }
    case 'daily': {
      return nextTimeOfDay(nowDate, automation.timeOfDay ?? '09:00').getTime()
    }
    case 'weekly': {
      return nextWeeklyTime(nowDate, automation.dayOfWeek ?? 1, automation.timeOfDay ?? '09:00').getTime()
    }
    case 'monthly': {
      return nextMonthlyTime(nowDate, automation.dayOfMonth ?? 1, automation.timeOfDay ?? '09:00').getTime()
    }
    case 'once': {
      return automation.scheduledAt ? new Date(automation.scheduledAt).getTime() : 0
    }
    default:
      return 0
  }
}

/** 判断两个时间戳是否落在同一个本地自然日 */
export function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

// ===== 调度辅助函数 =====

function nextTimeOfDay(now: Date, timeOfDay: string): Date {
  const [h, m] = timeOfDay.split(':').map(Number)
  const next = new Date(now)
  next.setHours(h!, m!, 0, 0)
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

function nextWeeklyTime(now: Date, dayOfWeek: number, timeOfDay: string): Date {
  const [h, m] = timeOfDay.split(':').map(Number)
  const next = new Date(now)
  next.setHours(h!, m!, 0, 0)

  const currentDay = next.getDay()
  let daysUntil = dayOfWeek - currentDay
  if (daysUntil < 0 || (daysUntil === 0 && next.getTime() <= now.getTime())) {
    daysUntil += 7
  }
  next.setDate(next.getDate() + daysUntil)
  return next
}

function nextMonthlyTime(now: Date, dayOfMonth: number, timeOfDay: string): Date {
  const [h, m] = timeOfDay.split(':').map(Number)
  const next = new Date(now)
  next.setHours(h!, m!, 0, 0)

  // 如果本月还没到，先尝试本月
  const thisMonth = new Date(next.getFullYear(), next.getMonth(), Math.min(dayOfMonth, daysInMonth(next.getFullYear(), next.getMonth() + 1)))
  thisMonth.setHours(h!, m!, 0, 0)
  if (thisMonth.getTime() > now.getTime()) {
    return thisMonth
  }

  // 否则下个月
  const nextMonth = new Date(next.getFullYear(), next.getMonth() + 1, Math.min(dayOfMonth, daysInMonth(next.getFullYear(), next.getMonth() + 2)))
  nextMonth.setHours(h!, m!, 0, 0)
  return nextMonth
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 生成调度文案（用于 UI 显示） */
export function formatScheduleLabel(automation: Automation): string {
  if (automation.scheduleType === 'once') {
    const when = automation.scheduledAt
      ? new Date(automation.scheduledAt).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '指定时间'
    return `仅运行一次（${when}）`
  }
  if (automation.scheduleType === 'daily') return `每天 ${automation.timeOfDay ?? '09:00'}`
  if (automation.scheduleType === 'weekly') {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `每${names[automation.dayOfWeek ?? 1]} ${automation.timeOfDay ?? '09:00'}`
  }
  if (automation.scheduleType === 'monthly') return `每月 ${automation.dayOfMonth ?? 1} 号 ${automation.timeOfDay ?? '09:00'}`
  const min = automation.intervalMinutes
  if (min < 60) return `每 ${min} 分钟`
  if (min < 1440) return `每 ${min / 60} 小时`
  return `每 ${min / 1440} 天`
}
