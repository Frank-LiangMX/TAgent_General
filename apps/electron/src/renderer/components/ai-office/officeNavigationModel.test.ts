import { describe, expect, it } from 'vitest'

import type { AgentSessionMeta, AgentWorkspace } from '@tagent/shared'

import {
  countOfficeRoomsByFloor,
  resolveDefaultOfficeFloorId,
  selectOfficeRooms,
} from './officeNavigationModel'

const floors: AgentWorkspace[] = [
  { id: 'floor-a', name: '产品研发', slug: 'default', createdAt: 1, updatedAt: 1 },
  { id: 'floor-b', name: '视觉设计', slug: 'design', createdAt: 2, updatedAt: 2 },
]

function room(overrides: Partial<AgentSessionMeta> = {}): AgentSessionMeta {
  return {
    id: 'room-a',
    title: '办公室 A',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('AI Office floor navigation', () => {
  it('uses the default workspace as the legacy floor', () => {
    expect(resolveDefaultOfficeFloorId(floors, 'floor-b')).toBe('floor-a')
  })

  it('keeps the oldest floor stable when a legacy default slug is unavailable', () => {
    const withoutDefault = [
      { ...floors[1]!, slug: 'design' },
      { ...floors[0]!, slug: 'product' },
    ]
    expect(resolveDefaultOfficeFloorId(withoutDefault, 'floor-b')).toBe('floor-a')
  })

  it('shows only top-level rooms on the selected floor and mode', () => {
    const sessions = [
      room({ id: 'legacy', updatedAt: 2 }),
      room({ id: 'design', workspaceId: 'floor-b', updatedAt: 3 }),
      room({ id: 'worker', workspaceId: 'floor-b', sourceKanbanTaskId: 'task-1' }),
      room({ id: 'ta-room', workspaceId: 'floor-b', mode: 'ta' }),
      room({ id: 'archived', workspaceId: 'floor-b', archived: true }),
    ]

    expect(
      selectOfficeRooms(sessions, 'floor-b', 'floor-a', 'general').map((item) => item.id)
    ).toEqual(['design'])
    expect(
      selectOfficeRooms(sessions, 'floor-a', 'floor-a', 'general').map((item) => item.id)
    ).toEqual(['legacy'])
  })

  it('keeps pinned rooms first, then sorts by recent activity', () => {
    const sessions = [
      room({ id: 'recent', workspaceId: 'floor-a', updatedAt: 9 }),
      room({ id: 'pinned-old', workspaceId: 'floor-a', pinned: true, updatedAt: 2 }),
      room({ id: 'older', workspaceId: 'floor-a', updatedAt: 4 }),
    ]

    expect(
      selectOfficeRooms(sessions, 'floor-a', 'floor-a', 'general').map((item) => item.id)
    ).toEqual(['pinned-old', 'recent', 'older'])
  })

  it('counts rooms independently for each floor', () => {
    const sessions = [
      room({ id: 'legacy' }),
      room({ id: 'design-1', workspaceId: 'floor-b' }),
      room({ id: 'design-2', workspaceId: 'floor-b' }),
      room({ id: 'worker', workspaceId: 'floor-b', sourceKanbanTaskId: 'task-1' }),
    ]

    expect(countOfficeRoomsByFloor(sessions, floors, 'floor-a', 'general')).toEqual(
      new Map([
        ['floor-a', 1],
        ['floor-b', 2],
      ])
    )
  })
})
