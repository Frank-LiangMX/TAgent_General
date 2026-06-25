/**
 * Automation 定时任务 Jotai atoms
 *
 * 管理定时任务列表和状态，订阅主进程推送的变更事件。
 */

import { atom } from 'jotai'
import type { Automation, CreateAutomationInput, UpdateAutomationInput } from '@tagent/shared'

/** 定时任务列表 atom */
export const automationsAtom = atom<Automation[]>([])

/** 是否正在加载 */
export const automationsLoadingAtom = atom<boolean>(true)

/** 按状态分组的定时任务 */
export const automationsGroupedAtom = atom((get) => {
  const all = get(automationsAtom)
  const enabled: Automation[] = []
  const paused: Automation[] = []
  const completed: Automation[] = []

  for (const a of all) {
    if (!a.enabled && a.completedAt) {
      completed.push(a)
    } else if (!a.enabled) {
      paused.push(a)
    } else {
      enabled.push(a)
    }
  }

  return { enabled, paused, completed }
})

/** 定时任务数量摘要 */
export const automationsCountAtom = atom((get) => {
  const all = get(automationsAtom)
  return {
    total: all.length,
    enabled: all.filter((a) => a.enabled).length,
    paused: all.filter((a) => !a.enabled && !a.completedAt).length,
    completed: all.filter((a) => !a.enabled && !!a.completedAt).length,
  }
})

// ===== 操作函数 =====

/** 加载定时任务列表 */
export async function loadAutomations(): Promise<Automation[]> {
  const automations = await window.electronAPI.automation.list()
  return automations
}

/** 创建定时任务 */
export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
  const automation = await window.electronAPI.automation.create(input)
  return automation
}

/** 更新定时任务 */
export async function updateAutomation(input: UpdateAutomationInput): Promise<Automation> {
  const automation = await window.electronAPI.automation.update(input)
  return automation
}

/** 删除定时任务 */
export async function deleteAutomation(id: string): Promise<void> {
  await window.electronAPI.automation.delete(id)
}

/** 切换启用/暂停 */
export async function toggleAutomation(id: string): Promise<Automation> {
  const automation = await window.electronAPI.automation.toggle(id)
  return automation
}

/** 立即运行一次 */
export async function runAutomationNow(id: string): Promise<void> {
  await window.electronAPI.automation.runNow(id)
}
