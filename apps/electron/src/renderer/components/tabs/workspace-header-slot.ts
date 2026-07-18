import { useSyncExternalStore } from 'react'

type SlotListener = () => void

let workspaceHeaderSlot: HTMLDivElement | null = null
const slotListeners = new Set<SlotListener>()

export function setWorkspaceHeaderSlot(nextSlot: HTMLDivElement | null): void {
  if (workspaceHeaderSlot === nextSlot) return
  workspaceHeaderSlot = nextSlot
  slotListeners.forEach((listener) => listener())
}

function subscribe(listener: SlotListener): () => void {
  slotListeners.add(listener)
  return () => slotListeners.delete(listener)
}

function getSnapshot(): HTMLDivElement | null {
  return workspaceHeaderSlot
}

export function useWorkspaceHeaderSlot(): HTMLDivElement | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
