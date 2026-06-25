/**
 * Automation 定时任务 Jotai atoms
 */

import { atom } from 'jotai'
import type { Automation, CreateAutomationInput, UpdateAutomationInput } from '@tagent/shared'

/** 定时任务列表 */
export const automationsAtom = atom<Automation[]>([])

/** 是否正在加载 */
export const automationsLoadingAtom = atom<boolean>(true)

/** 侧栏选中的任务 ID（null = 未选中） */
export const selectedAutomationIdAtom = atom<string | null>(null)

/** 编辑器模式：浏览已有 / 新建 */
export const automationEditorModeAtom = atom<'edit' | 'create'>('edit')

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
