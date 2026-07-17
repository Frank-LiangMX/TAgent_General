import type { AgentSessionMeta, AgentWorkspace } from '@tagent/shared'

export type OfficeTopLevelMode = 'general' | 'ta'

/** Legacy sessions without workspaceId live on the default (or first) floor. */
export function resolveDefaultOfficeFloorId(
  workspaces: AgentWorkspace[],
  currentWorkspaceId: string | null
): string | null {
  const oldestWorkspace = workspaces.reduce<AgentWorkspace | undefined>(
    (oldest, workspace) => (!oldest || workspace.createdAt < oldest.createdAt ? workspace : oldest),
    undefined
  )
  return (
    workspaces.find((workspace) => workspace.slug === 'default')?.id ??
    oldestWorkspace?.id ??
    currentWorkspaceId
  )
}

export function resolveOfficeSessionFloorId(
  session: AgentSessionMeta,
  defaultFloorId: string | null
): string | null {
  return session.workspaceId ?? defaultFloorId
}

export function selectOfficeRooms(
  sessions: AgentSessionMeta[],
  floorId: string | null,
  defaultFloorId: string | null,
  mode: OfficeTopLevelMode
): AgentSessionMeta[] {
  if (!floorId) return []

  return sessions
    .filter(
      (session) =>
        !session.archived &&
        !session.sourceKanbanTaskId &&
        (session.mode ?? 'general') === mode &&
        resolveOfficeSessionFloorId(session, defaultFloorId) === floorId
    )
    .sort(
      (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt
    )
}

export function countOfficeRoomsByFloor(
  sessions: AgentSessionMeta[],
  workspaces: AgentWorkspace[],
  defaultFloorId: string | null,
  mode: OfficeTopLevelMode
): Map<string, number> {
  const counts = new Map(workspaces.map((workspace) => [workspace.id, 0]))
  for (const session of sessions) {
    if (session.archived || session.sourceKanbanTaskId || (session.mode ?? 'general') !== mode) {
      continue
    }
    const floorId = resolveOfficeSessionFloorId(session, defaultFloorId)
    if (floorId && counts.has(floorId)) counts.set(floorId, (counts.get(floorId) ?? 0) + 1)
  }
  return counts
}
