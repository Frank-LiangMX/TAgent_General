import { useAtomValue, useStore } from 'jotai'
import { Building2, ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react'
import * as React from 'react'

import { OfficeSessionView } from './OfficeSessionView'

import {
  agentSessionIndicatorMapAtom,
  agentSessionsAtom,
  type SessionIndicatorStatus,
} from '@/atoms/agent-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { sessionPresentationAtomFamily } from '@/atoms/session-presentation-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { cn } from '@/lib/utils'

import './office-immersive-shell.css'

interface OfficeImmersiveShellProps {
  sessionId: string
}

function roomStatusTone(status: SessionIndicatorStatus | undefined): string {
  if (status === 'blocked') return 'office-room-status--blocked'
  if (status === 'running') return 'office-room-status--running'
  if (status === 'completed') return 'office-room-status--completed'
  return 'office-room-status--idle'
}

export function OfficeImmersiveShell({ sessionId }: OfficeImmersiveShellProps): React.ReactElement {
  const store = useStore()
  const sessions = useAtomValue(agentSessionsAtom)
  const indicatorMap = useAtomValue(agentSessionIndicatorMapAtom)
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const openSession = useOpenSession()
  const roomListRef = React.useRef<HTMLDivElement>(null)
  const roomButtonRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const focusSwitchedRoomRef = React.useRef(false)

  const rooms = React.useMemo(
    () =>
      sessions
        .filter(
          (session) =>
            !session.archived &&
            !session.sourceKanbanTaskId &&
            (session.mode ?? 'general') === topLevelMode
        )
        .sort(
          (a, b) =>
            Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt
        ),
    [sessions, topLevelMode]
  )

  const switchRoom = React.useCallback(
    (targetSessionId: string) => {
      const room = rooms.find((session) => session.id === targetSessionId)
      if (!room || room.id === sessionId) return
      store.set(sessionPresentationAtomFamily(room.id), 'office')
      openSession('agent', room.id, room.title, room.mode)
    },
    [openSession, rooms, sessionId, store]
  )

  const returnToClassic = React.useCallback(() => {
    store.set(sessionPresentationAtomFamily(sessionId), 'classic')
  }, [sessionId, store])

  const moveRooms = React.useCallback((direction: -1 | 1) => {
    roomListRef.current?.scrollBy({ left: direction * 280, behavior: 'smooth' })
  }, [])

  const handleRoomKeys = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const currentIndex = rooms.findIndex((room) => room.id === sessionId)
      const direction = event.key === 'ArrowRight' ? 1 : -1
      const target = rooms[currentIndex + direction]
      if (!target) return
      event.preventDefault()
      focusSwitchedRoomRef.current = true
      switchRoom(target.id)
    },
    [rooms, sessionId, switchRoom]
  )

  React.useEffect(() => {
    const activeRoom = roomButtonRefs.current.get(sessionId)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    activeRoom?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
    if (!focusSwitchedRoomRef.current) return
    focusSwitchedRoomRef.current = false
    activeRoom?.focus()
  }, [sessionId])

  return (
    <main className="office-immersive-shell h-screen w-screen overflow-hidden">
      <a className="office-room-skip-link" href="#office-canvas-main">
        跳到办公室场景
      </a>

      <div id="office-canvas-main" className="h-full w-full" role="tabpanel" tabIndex={-1}>
        <OfficeSessionView key={sessionId} sessionId={sessionId} />
      </div>

      <nav className="office-room-switcher" aria-label="切换办公室房间" onKeyDown={handleRoomKeys}>
        <div className="office-room-brand" aria-label="AI Office 房间">
          <Building2 className="size-4" aria-hidden />
          <span>Office</span>
        </div>

        <button
          type="button"
          className="office-room-scroll-button"
          onClick={() => moveRooms(-1)}
          aria-label="查看左侧房间"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>

        <div ref={roomListRef} className="office-room-list" role="tablist">
          {rooms.map((room) => {
            const active = room.id === sessionId
            const status = indicatorMap.get(room.id)
            return (
              <button
                key={room.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="office-canvas-main"
                tabIndex={active ? 0 : -1}
                ref={(element) => {
                  if (element) roomButtonRefs.current.set(room.id, element)
                  else roomButtonRefs.current.delete(room.id)
                }}
                className={cn('office-room-tab', active && 'office-room-tab--active')}
                onClick={() => switchRoom(room.id)}
                title={room.title || '未命名办公室'}
              >
                <span className={cn('office-room-status', roomStatusTone(status))} aria-hidden />
                <span className="office-room-name">{room.title || '未命名办公室'}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="office-room-scroll-button"
          onClick={() => moveRooms(1)}
          aria-label="查看右侧房间"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          className="office-room-classic-button"
          onClick={returnToClassic}
          aria-label="返回经典工作台"
          title="返回经典工作台"
        >
          <LayoutDashboard className="size-4" aria-hidden />
          <span>经典工作台</span>
        </button>
      </nav>
    </main>
  )
}
