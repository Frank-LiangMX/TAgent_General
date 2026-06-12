/**
 * tray-menu-model 单测
 *
 * 构建系统托盘菜单的数据 model: 把 Agent 会话 + 工作区分类成
 * runningSessions / recentSessions / moreSessions 三段。
 */

import { describe, expect, test } from 'vitest'

import {
  createTrayMenuModel,
  TRAY_RECENT_LIMIT,
  TRAY_MORE_LIMIT,
} from './tray-menu-model'

import type { AgentSessionMeta, AgentWorkspace } from '@tagent/shared'

// ============================================
// 测试 fixture
// ============================================

function ws(id: string, name: string): AgentWorkspace {
  return { id, name } as AgentWorkspace
}

function sess(
  id: string,
  title: string,
  updatedAt: number,
  opts: { workspaceId?: string; archived?: boolean } = {},
): AgentSessionMeta {
  return {
    id,
    title,
    updatedAt,
    workspaceId: opts.workspaceId,
    archived: opts.archived,
  } as AgentSessionMeta
}

// ============================================
// 常量 sanity
// ============================================

describe('TRAY_*_LIMIT 常量', () => {
  test('Given TRAY_RECENT_LIMIT When 读 Then 是 3 (显示用)', () => {
    expect(TRAY_RECENT_LIMIT).toBe(3)
  })

  test('Given TRAY_MORE_LIMIT When 读 Then 是 10 (候选池大小)', () => {
    expect(TRAY_MORE_LIMIT).toBe(10)
  })
})

// ============================================
// 空输入
// ============================================

describe('createTrayMenuModel - 空输入', () => {
  test('Given 空 sessions When create Then 三段都空', () => {
    const m = createTrayMenuModel([], [])
    expect(m.runningSessions).toEqual([])
    expect(m.recentSessions).toEqual([])
    expect(m.moreSessions).toEqual([])
  })

  test('Given 空 sessions + 有 workspaces When create Then 三段都空 (workspaces 不影响空 case)', () => {
    const m = createTrayMenuModel([], [ws('w1', 'Project')])
    expect(m.runningSessions).toEqual([])
    expect(m.recentSessions).toEqual([])
    expect(m.moreSessions).toEqual([])
  })
})

// ============================================
// runningSessions
// ============================================

describe('createTrayMenuModel - runningSessions', () => {
  test('Given 1 个 running + 2 个非 running When create Then 只 running 进 runningSessions', () => {
    const sessions = [
      sess('s1', 'A', 300, { workspaceId: 'w1' }),
      sess('s2', 'B', 200, { workspaceId: 'w1' }),
      sess('s3', 'C', 100, { workspaceId: 'w1' }),
    ]
    const m = createTrayMenuModel(sessions, [ws('w1', 'P')], new Set(['s2']))
    expect(m.runningSessions.map((r) => r.id)).toEqual(['s2'])
  })

  test('Given running session 工作区不存在 When create Then subtitle 是 "未知工作区"', () => {
    const sessions = [sess('s1', 'A', 100, { workspaceId: 'missing-ws' })]
    const m = createTrayMenuModel(sessions, [], new Set(['s1']))
    expect(m.runningSessions[0]!.subtitle).toBe('未知工作区')
  })

  test('Given running session 没选工作区 When create Then subtitle 是 "未选择工作区"', () => {
    const sessions = [sess('s1', 'A', 100)]
    const m = createTrayMenuModel(sessions, [ws('w1', 'P')], new Set(['s1']))
    expect(m.runningSessions[0]!.subtitle).toBe('未选择工作区')
  })

  test('Given running session 有 workspaceId + 匹配 workspaces When create Then subtitle 用工作区 name', () => {
    const sessions = [sess('s1', 'A', 100, { workspaceId: 'w1' })]
    const m = createTrayMenuModel(sessions, [ws('w1', 'My Project')], new Set(['s1']))
    expect(m.runningSessions[0]!.subtitle).toBe('My Project')
  })
})

// ============================================
// recentSessions
// ============================================

describe('createTrayMenuModel - recentSessions', () => {
  test('Given 5 个非 running 会话 (按 updatedAt 降序) When create Then recent 取前 3', () => {
    const sessions = [
      sess('s1', 'Newest', 500),
      sess('s2', '2nd', 400),
      sess('s3', '3rd', 300),
      sess('s4', '4th', 200),
      sess('s5', '5th', 100),
    ]
    const m = createTrayMenuModel(sessions, [], new Set())
    expect(m.recentSessions.map((r) => r.id)).toEqual(['s1', 's2', 's3'])
  })

  test('Given 超过 10 个候选 (TRAY_MORE_LIMIT) When create Then 最多 10 个进候选池 (3+7)', () => {
    const sessions = Array.from({ length: 15 }, (_, i) => sess(`s${i}`, `T${i}`, 1000 - i))
    const m = createTrayMenuModel(sessions, [], new Set())
    // 候选池 = recentSessions(3) + moreSessions(7) = 10
    expect(m.recentSessions).toHaveLength(3)
    expect(m.moreSessions).toHaveLength(7)
    // 总数 10, 15 - 5 = 10 进候选池
    expect(m.recentSessions.length + m.moreSessions.length).toBe(TRAY_MORE_LIMIT)
  })

  test('Given 5 个非 running 会话 When create Then moreSessions 为空 (少于 4 个)', () => {
    const sessions = [
      sess('s1', 'a', 500),
      sess('s2', 'b', 400),
      sess('s3', 'c', 300),
    ]
    const m = createTrayMenuModel(sessions, [], new Set())
    expect(m.recentSessions).toHaveLength(3)
    expect(m.moreSessions).toEqual([])
  })
})

// ============================================
// moreSessions
// ============================================

describe('createTrayMenuModel - moreSessions', () => {
  test('Given 10 个非 running 会话 When create Then recent=3 + more=7', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => sess(`s${i}`, `T${i}`, 1000 - i))
    const m = createTrayMenuModel(sessions, [], new Set())
    expect(m.recentSessions).toHaveLength(3)
    expect(m.moreSessions).toHaveLength(7)
  })

  test('Given recent + more When 拼起来 Then 仍是 updatedAt 降序', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => sess(`s${i}`, `T${i}`, 1000 - i))
    const m = createTrayMenuModel(sessions, [], new Set())
    const combined = [...m.recentSessions, ...m.moreSessions]
    // s0 应该是最新的 (updatedAt=1000), s9 是最老的
    expect(combined[0]!.id).toBe('s0')
    expect(combined[combined.length - 1]!.id).toBe('s9')
  })
})

// ============================================
// 归档过滤
// ============================================

describe('createTrayMenuModel - 归档过滤', () => {
  test('Given 归档的非 running 会话 When create Then 不出现在任何段', () => {
    const sessions = [
      sess('s1', 'A', 300, { archived: true }),
      sess('s2', 'B', 200, { archived: false }),
    ]
    const m = createTrayMenuModel(sessions, [], new Set())
    expect(m.runningSessions).toEqual([])
    expect(m.recentSessions.map((r) => r.id)).toEqual(['s2'])
  })

  test('Given 归档但 running 的会话 When create Then 仍出现在 runningSessions', () => {
    const sessions = [sess('s1', 'A', 100, { archived: true })]
    const m = createTrayMenuModel(sessions, [], new Set(['s1']))
    expect(m.runningSessions.map((r) => r.id)).toEqual(['s1'])
  })
})

// ============================================
// 排序
// ============================================

describe('createTrayMenuModel - 排序', () => {
  test('Given sessions 乱序输入 When create Then recent 按 updatedAt 降序排', () => {
    const sessions = [
      sess('s_old', 'old', 100),
      sess('s_new', 'new', 500),
      sess('s_mid', 'mid', 300),
    ]
    const m = createTrayMenuModel(sessions, [], new Set())
    expect(m.recentSessions.map((r) => r.id)).toEqual(['s_new', 's_mid', 's_old'])
  })

  test('Given sessions updatedAt 相等 When create Then 保持输入顺序 (稳定排序)', () => {
    const sessions = [
      sess('a', 'A', 100),
      sess('b', 'B', 100),
      sess('c', 'C', 100),
    ]
    const m = createTrayMenuModel(sessions, [], new Set())
    // 稳定排序: 同样 updatedAt, 保留输入顺序
    expect(m.recentSessions.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

// ============================================
// 标题处理
// ============================================

describe('createTrayMenuModel - 标题处理', () => {
  test('Given 标题全空格 When create Then title 是 "未命名会话"', () => {
    const sessions = [sess('s1', '   ', 100)]
    const m = createTrayMenuModel(sessions, [], new Set())
    expect(m.recentSessions[0]!.title).toBe('未命名会话')
  })

  test('Given 标题前后有空格 When create Then title 被 trim', () => {
    const sessions = [sess('s1', '  hello  ', 100)]
    const m = createTrayMenuModel(sessions, [], new Set())
    expect(m.recentSessions[0]!.title).toBe('hello')
  })

  test('Given 正常标题 When create Then title 原样保留', () => {
    const sessions = [sess('s1', 'My Chat', 100)]
    const m = createTrayMenuModel(sessions, [], new Set())
    expect(m.recentSessions[0]!.title).toBe('My Chat')
  })
})

// ============================================
// 不修改输入
// ============================================

describe('createTrayMenuModel - 不可变性', () => {
  test('Given input sessions When create Then 原数组不被修改', () => {
    const sessions = [
      sess('s1', 'A', 100),
      sess('s2', 'B', 300),
    ]
    const before = JSON.stringify(sessions)
    createTrayMenuModel(sessions, [], new Set())
    expect(JSON.stringify(sessions)).toBe(before)
  })

  test('Given input sessions When create 返回的 item 是新对象 (不引用原 session)', () => {
    const s = sess('s1', 'A', 100)
    const m = createTrayMenuModel([s], [], new Set())
    expect(m.recentSessions[0]).not.toBe(s)
    // 但 id / title 字段相同
    expect(m.recentSessions[0]!.id).toBe(s.id)
  })
})
