/**
 * 看板同一角色多实例编号
 *
 * 同一看板上同一 roleId 出现 ≥ 2 次时，按 createdAt（再按 id）顺序显示为
 * 「通用执行者 01」「通用执行者 02」；只出现 1 次则不加编号。
 */

import type { KanbanTask } from '@tagent/shared'

/**
 * 为看板任务列表生成「角色显示名 + 可选实例编号」映射（taskId → label）
 *
 * @param tasks 同一看板下的全部任务（不要只传当前状态分组）
 * @param roleMap roleId → displayName
 */
export function buildKanbanRoleInstanceLabels(
  tasks: KanbanTask[],
  roleMap: Map<string, string>
): Map<string, string> {
  const sorted = [...tasks].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    return a.id.localeCompare(b.id)
  })

  const counts = new Map<string, number>()
  for (const task of sorted) {
    if (!task.roleId) continue
    counts.set(task.roleId, (counts.get(task.roleId) ?? 0) + 1)
  }

  const nextIndex = new Map<string, number>()
  const labels = new Map<string, string>()

  for (const task of sorted) {
    if (!task.roleId) continue
    const displayName = roleMap.get(task.roleId) ?? task.roleId
    const total = counts.get(task.roleId) ?? 0
    if (total < 2) {
      labels.set(task.id, displayName)
      continue
    }
    const n = (nextIndex.get(task.roleId) ?? 0) + 1
    nextIndex.set(task.roleId, n)
    labels.set(task.id, `${displayName} ${String(n).padStart(2, '0')}`)
  }

  return labels
}
