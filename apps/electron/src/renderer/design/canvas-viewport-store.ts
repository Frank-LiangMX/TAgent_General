/**
 * canvas-viewport-store.ts — 视口/缩放/平移（v3）
 */

import { atom } from 'jotai'

export interface ViewportState {
  panX: number
  panY: number
  zoom: number
}

const DEFAULT_VIEWPORT: ViewportState = { panX: 0, panY: 0, zoom: 1 }

export const viewportAtom = atom<ViewportState>(DEFAULT_VIEWPORT)

export const zoomAtom = atom(
  (get) => get(viewportAtom).zoom,
  (_get, set, zoom: number) => {
    set(viewportAtom, (prev) => ({ ...prev, zoom: Math.max(0.1, Math.min(4, zoom)) }))
  }
)

export const panXAtom = atom(
  (get) => get(viewportAtom).panX,
  (_get, set, panX: number) => set(viewportAtom, (prev) => ({ ...prev, panX }))
)

export const panYAtom = atom(
  (get) => get(viewportAtom).panY,
  (_get, set, panY: number) => set(viewportAtom, (prev) => ({ ...prev, panY }))
)

export const resetViewportAtom = atom(null, (_get, set) => {
  set(viewportAtom, DEFAULT_VIEWPORT)
})
