import { describe, expect, test } from 'vitest'
import type { KanbanTask } from '@tagent/shared'
import { buildKanbanRoleInstanceLabels } from './kanban-role-labels'

function makeTask(overrides: Partial<KanbanTask> & Pick<KanbanTask, 'id' | 'roleId'>): KanbanTask {
  return {
    boardId: 'b1',
    title: 't',
    body: '',
    status: 'pending',
    channelId: 'c1',
    priority: 0,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  }
}

describe('buildKanbanRoleInstanceLabels', () => {
  const roleMap = new Map([
    ['generalist', '通用执行者'],
    ['coder', '后端架构师'],
  ])

  test('同一角色只出现一次时不加编号', () => {
    const tasks = [
      makeTask({ id: 't1', roleId: 'generalist', createdAt: 1 }),
      makeTask({ id: 't2', roleId: 'coder', createdAt: 2 }),
    ]
    const labels = buildKanbanRoleInstanceLabels(tasks, roleMap)
    expect(labels.get('t1')).toBe('通用执行者')
    expect(labels.get('t2')).toBe('后端架构师')
  })

  test('同一角色多次出现时按创建时间编号 01/02', () => {
    const tasks = [
      makeTask({ id: 't2', roleId: 'generalist', createdAt: 200 }),
      makeTask({ id: 't1', roleId: 'generalist', createdAt: 100 }),
      makeTask({ id: 't3', roleId: 'coder', createdAt: 150 }),
    ]
    const labels = buildKanbanRoleInstanceLabels(tasks, roleMap)
    expect(labels.get('t1')).toBe('通用执行者 01')
    expect(labels.get('t2')).toBe('通用执行者 02')
    expect(labels.get('t3')).toBe('后端架构师')
  })

  test('createdAt 相同时按 id 稳定排序', () => {
    const tasks = [
      makeTask({ id: 't-b', roleId: 'generalist', createdAt: 1 }),
      makeTask({ id: 't-a', roleId: 'generalist', createdAt: 1 }),
    ]
    const labels = buildKanbanRoleInstanceLabels(tasks, roleMap)
    expect(labels.get('t-a')).toBe('通用执行者 01')
    expect(labels.get('t-b')).toBe('通用执行者 02')
  })

  test('无 roleId 的任务不进入映射', () => {
    const tasks = [makeTask({ id: 't1', roleId: undefined, createdAt: 1 })]
    const labels = buildKanbanRoleInstanceLabels(tasks, roleMap)
    expect(labels.has('t1')).toBe(false)
  })

  test('roleMap 缺失时回退到 roleId 并编号', () => {
    const tasks = [
      makeTask({ id: 't1', roleId: 'custom-x', createdAt: 1 }),
      makeTask({ id: 't2', roleId: 'custom-x', createdAt: 2 }),
    ]
    const labels = buildKanbanRoleInstanceLabels(tasks, new Map())
    expect(labels.get('t1')).toBe('custom-x 01')
    expect(labels.get('t2')).toBe('custom-x 02')
  })
})
