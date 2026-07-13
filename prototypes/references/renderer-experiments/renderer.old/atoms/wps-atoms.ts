import { atom } from 'jotai'

import type { WpsBridgeState } from '@tagent/shared'

export const wpsBridgeStateAtom = atom<WpsBridgeState>({ status: 'disconnected' })

export const wpsConnectedAtom = atom((get) => get(wpsBridgeStateAtom).status === 'connected')
