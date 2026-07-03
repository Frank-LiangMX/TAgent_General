/**
 * Automation 定时任务 Jotai atoms
 */

import { atom } from 'jotai'
import type {
  Automation,
  AutomationBlockedLogDetail,
  AutomationBlockedLogSummary,
  AutomationPromptBlockedEvent,
  CreateAutomationInput,
  UpdateAutomationInput,
} from '@tagent/shared'

/** 定时任务列表 */
export const automationsAtom = atom<Automation[]>([])

/** 是否正在加载 */
export const automationsLoadingAtom = atom<boolean>(true)

/** 侧栏选中的任务 ID（null = 未选中） */
export const selectedAutomationIdAtom = atom<string | null>(null)

/** 编辑器模式：浏览已有 / 新建 */
export const automationEditorModeAtom = atom<'edit' | 'create'>('edit')

/** 拦截日志列表（按时间倒序） */
export const blockedLogsAtom = atom<AutomationBlockedLogSummary[]>([])

/** 拦截日志是否正在加载 */
export const blockedLogsLoadingAtom = atom<boolean>(false)

/** 最近一次 runtime 拦截事件（用于触发 toast） */
export const lastBlockedEventAtom = atom<AutomationPromptBlockedEvent | null>(null)

/** 按状态分组 */
export const automationsGroupedAtom = atom((get) => {
  const all = get(automationsAtom)
  const enabled: Automation[] = []
  const paused: Automation[] = []
  const completed: Automation[] = []

  for (const a of all) {
    if (!a.enabled && a.completedAt) completed.push(a)
    else if (!a.enabled) paused.push(a)
    else enabled.push(a)
  }

  return { enabled, paused, completed }
})

export const automationsCountAtom = atom((get) => {
  const all = get(automationsAtom)
  return {
    total: all.length,
    enabled: all.filter((a) => a.enabled).length,
  }
})

export async function loadAutomations(): Promise<Automation[]> {
  return window.electronAPI.automation.list()
}

export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
  return window.electronAPI.automation.create(input)
}

export async function updateAutomation(input: UpdateAutomationInput): Promise<Automation> {
  return window.electronAPI.automation.update(input)
}

export async function deleteAutomation(id: string): Promise<void> {
  await window.electronAPI.automation.delete(id)
}

export async function toggleAutomation(id: string): Promise<Automation> {
  return window.electronAPI.automation.toggle(id)
}

export async function runAutomationNow(id: string): Promise<void> {
  await window.electronAPI.automation.runNow(id)
}

/** 加载拦截日志列表 */
export async function loadBlockedLogs(): Promise<AutomationBlockedLogSummary[]> {
  return window.electronAPI.automation.listBlockedLogs()
}

/** 获取单条拦截日志详情 */
export async function getBlockedLogDetail(
  fileName: string
): Promise<AutomationBlockedLogDetail | null> {
  return window.electronAPI.automation.getBlockedLogDetail(fileName)
}

/** 删除单条拦截日志 */
export async function deleteBlockedLog(fileName: string): Promise<boolean> {
  return window.electronAPI.automation.deleteBlockedLog(fileName)
}

/** 清空指定 automation 的所有拦截日志 */
export async function clearBlockedLogsForAutomation(automationId: string): Promise<number> {
  return window.electronAPI.automation.clearBlockedLogsForAutomation(automationId)
}
