import { useAtomValue, useStore } from 'jotai'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  LayoutDashboard,
  Layers3,
  Plus,
} from 'lucide-react'
import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@tagent/ui'

import { OfficeSessionView } from './OfficeSessionView'
import {
  countOfficeRoomsByFloor,
  resolveDefaultOfficeFloorId,
  resolveOfficeSessionFloorId,
  selectOfficeRooms,
} from './officeNavigationModel'

import {
  agentSessionIndicatorMapAtom,
  agentSessionsAtom,
  type SessionIndicatorStatus,
} from '@/atoms/agent-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { sessionPresentationAtomFamily } from '@/atoms/session-presentation-atoms'
import { useCreateSession } from '@/hooks/useCreateSession'
import { useOpenSession } from '@/hooks/useOpenSession'
import { useWorkspaceActions } from '@/hooks/useWorkspaceActions'
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
  const { createAgent } = useCreateSession()
  const { workspaces, currentWorkspaceId, selectWorkspace, createWorkspace } = useWorkspaceActions()
  const roomListRef = React.useRef<HTMLDivElement>(null)
  const roomButtonRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const focusSwitchedRoomRef = React.useRef(false)
  const [floorDialogOpen, setFloorDialogOpen] = React.useState(false)
  const [floorName, setFloorName] = React.useState('')
  const [creatingFloor, setCreatingFloor] = React.useState(false)
  const [creatingRoom, setCreatingRoom] = React.useState(false)

  const defaultFloorId = React.useMemo(
    () => resolveDefaultOfficeFloorId(workspaces, currentWorkspaceId),
    [currentWorkspaceId, workspaces]
  )
  const session = sessions.find((item) => item.id === sessionId)
  const sessionFloorId = session
    ? resolveOfficeSessionFloorId(session, defaultFloorId)
    : defaultFloorId
  const [selectedFloorId, setSelectedFloorId] = React.useState<string | null>(sessionFloorId)

  React.useEffect(() => {
    if (sessionFloorId) setSelectedFloorId(sessionFloorId)
  }, [sessionId, sessionFloorId])

  React.useEffect(() => {
    if (selectedFloorId && workspaces.some((workspace) => workspace.id === selectedFloorId)) return
    setSelectedFloorId(defaultFloorId)
  }, [defaultFloorId, selectedFloorId, workspaces])

  const rooms = React.useMemo(
    () => selectOfficeRooms(sessions, selectedFloorId, defaultFloorId, topLevelMode),
    [defaultFloorId, selectedFloorId, sessions, topLevelMode]
  )
  const roomCounts = React.useMemo(
    () => countOfficeRoomsByFloor(sessions, workspaces, defaultFloorId, topLevelMode),
    [defaultFloorId, sessions, topLevelMode, workspaces]
  )
  const selectedFloor = workspaces.find((workspace) => workspace.id === selectedFloorId)
  const renderedRoom = rooms.find((room) => room.id === sessionId)

  const openOfficeRoom = React.useCallback(
    (roomId: string) => {
      const room = sessions.find((item) => item.id === roomId)
      if (!room) return
      store.set(sessionPresentationAtomFamily(room.id), 'office')
      openSession('agent', room.id, room.title, room.mode)
    },
    [openSession, sessions, store]
  )

  const switchRoom = React.useCallback(
    (targetSessionId: string) => {
      if (targetSessionId === sessionId) return
      openOfficeRoom(targetSessionId)
    },
    [openOfficeRoom, sessionId]
  )

  const switchFloor = React.useCallback(
    (floorId: string) => {
      setSelectedFloorId(floorId)
      selectWorkspace(floorId)
      const targetRooms = selectOfficeRooms(sessions, floorId, defaultFloorId, topLevelMode)
      if (targetRooms[0]) openOfficeRoom(targetRooms[0].id)
    },
    [defaultFloorId, openOfficeRoom, selectWorkspace, sessions, topLevelMode]
  )

  const createFloor = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!floorName.trim() || creatingFloor) return
      setCreatingFloor(true)
      const floor = await createWorkspace(floorName)
      setCreatingFloor(false)
      if (!floor) return
      setSelectedFloorId(floor.id)
      setFloorName('')
      setFloorDialogOpen(false)
    },
    [createWorkspace, creatingFloor, floorName]
  )

  const createRoom = React.useCallback(async () => {
    if (!selectedFloorId || creatingRoom) return
    setCreatingRoom(true)
    const room = await createAgent({
      mode: topLevelMode,
      workspaceId: selectedFloorId,
      beforeOpen: (createdRoom) =>
        store.set(sessionPresentationAtomFamily(createdRoom.id), 'office'),
    })
    setCreatingRoom(false)
    if (!room) return
  }, [createAgent, creatingRoom, selectedFloorId, store, topLevelMode])

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
      const target =
        currentIndex < 0
          ? direction === 1
            ? rooms[0]
            : rooms.at(-1)
          : rooms[currentIndex + direction]
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
        {renderedRoom ? (
          <OfficeSessionView key={renderedRoom.id} sessionId={renderedRoom.id} />
        ) : (
          <div className="office-empty-floor" role="status">
            <div className="office-empty-floor__card">
              <div className="office-empty-floor__icon" aria-hidden>
                <DoorOpen className="size-6" />
              </div>
              <p className="office-empty-floor__eyebrow">{selectedFloor?.name || '当前楼层'}</p>
              <h1>这一层还没有办公室</h1>
              <p>创建一个办公室后，总监会进入房间，后续看板 worker 也会在这里协作。</p>
              <button
                type="button"
                className="office-empty-floor__action"
                onClick={() => void createRoom()}
                disabled={!selectedFloorId || creatingRoom}
              >
                <Plus className="size-4" aria-hidden />
                {creatingRoom ? '正在创建…' : '新建办公室'}
              </button>
            </div>
          </div>
        )}
      </div>

      <nav
        className="office-room-switcher"
        aria-label="楼层与办公室导航"
        onKeyDown={handleRoomKeys}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="office-floor-trigger" aria-label="切换楼层">
              <span className="office-floor-trigger__icon" aria-hidden>
                <Layers3 className="size-4" />
              </span>
              <span className="office-floor-trigger__copy">
                <span>楼层</span>
                <strong>{selectedFloor?.name || '选择工作区'}</strong>
              </span>
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="office-floor-menu w-[280px]">
            <DropdownMenuLabel className="office-floor-menu__label">工作区楼层</DropdownMenuLabel>
            {workspaces.map((workspace) => {
              const selected = workspace.id === selectedFloorId
              return (
                <DropdownMenuItem
                  key={workspace.id}
                  className="office-floor-menu__item"
                  onSelect={() => switchFloor(workspace.id)}
                >
                  <Building2 className="size-4" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  <span className="office-floor-menu__count">
                    {roomCounts.get(workspace.id) ?? 0}
                  </span>
                  {selected ? (
                    <Check className="size-4 text-primary" aria-label="当前楼层" />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setFloorDialogOpen(true)}>
              <Plus className="size-4" aria-hidden />
              新建楼层
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          className="office-room-scroll-button"
          onClick={() => moveRooms(-1)}
          aria-label="查看左侧办公室"
          disabled={rooms.length < 2}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>

        <div ref={roomListRef} className="office-room-list" role="tablist" aria-label="办公室">
          {rooms.map((room, index) => {
            const active = room.id === sessionId
            const status = indicatorMap.get(room.id)
            return (
              <button
                key={room.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="office-canvas-main"
                tabIndex={active || (!renderedRoom && index === 0) ? 0 : -1}
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
          aria-label="查看右侧办公室"
          disabled={rooms.length < 2}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          className="office-room-add-button"
          onClick={() => void createRoom()}
          disabled={!selectedFloorId || creatingRoom}
          aria-label="在当前楼层新建办公室"
          title="新建办公室"
        >
          <Plus className="size-4" aria-hidden />
          <span>办公室</span>
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

      <Dialog open={floorDialogOpen} onOpenChange={setFloorDialogOpen}>
        <DialogContent className="office-floor-dialog max-w-sm gap-0 overflow-hidden p-0">
          <DialogHeader className="px-5 pb-3 pt-5 text-left">
            <DialogTitle>新建楼层</DialogTitle>
            <DialogDescription>
              楼层对应一个工作区，其中的会话会显示为独立办公室。
            </DialogDescription>
          </DialogHeader>
          <form className="office-floor-dialog__form" onSubmit={(event) => void createFloor(event)}>
            <label htmlFor="office-floor-name">楼层名称</label>
            <Input
              id="office-floor-name"
              value={floorName}
              onChange={(event) => setFloorName(event.target.value)}
              placeholder="例如：产品研发"
              autoFocus
              maxLength={48}
            />
            <div className="office-floor-dialog__actions">
              <button type="button" onClick={() => setFloorDialogOpen(false)}>
                取消
              </button>
              <button type="submit" disabled={!floorName.trim() || creatingFloor}>
                {creatingFloor ? '正在创建…' : '创建楼层'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
