import type { ChibiFacing, OfficeAgentState } from '../../types/office-agent'

export const WORKER_SPINE_SKINS = [
  'misaki',
  'erikari',
  'nate',
  'harri',
  'luke',
  'soeren',
  'mario',
  'sinisa',
  'spineboy',
] as const

/** The director uses one deliberate, recognisable professional appearance across rooms. */
export const DIRECTOR_SPINE_SKIN = 'nate'

/** Spine setup pose is 682.5px high; office workers should render near one desk width tall. */
export const CHIBI_SPINE_SETUP_HEIGHT = 682.5
export const OFFICE_CHARACTER_TARGET_HEIGHT = 102
export const OFFICE_CHARACTER_SCALE = OFFICE_CHARACTER_TARGET_HEIGHT / CHIBI_SPINE_SETUP_HEIGHT

export interface WorkerAnimationSpec {
  name: string
  loop: boolean
  settleTo?: string
}

function stableHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash, 31) + value.charCodeAt(i)
  }
  return Math.abs(hash)
}

export function getWorkerSpineSkin(appearanceKey: string): string {
  if (appearanceKey.startsWith('director:')) return DIRECTOR_SPINE_SKIN
  return WORKER_SPINE_SKINS[stableHash(appearanceKey) % WORKER_SPINE_SKINS.length]!
}

function directionalAnimation(kind: 'idle' | 'trot', facing: ChibiFacing): string {
  const assetFacing = facing === 'left' ? 'right' : facing === 'right' ? 'left' : facing
  return `movement/${kind}-${assetFacing}`
}

/**
 * 每种业务状态只选择有语义的动作。完成和撤岗是一次性动作，结束后回到稳定站姿。
 */
export function resolveWorkerAnimation(
  state: OfficeAgentState,
  facing: ChibiFacing
): WorkerAnimationSpec {
  switch (state) {
    case 'walking':
      return { name: directionalAnimation('trot', facing), loop: true }
    case 'waiting':
      return { name: directionalAnimation('idle', facing), loop: true }
    case 'working':
      return { name: directionalAnimation('idle', facing), loop: true }
    case 'talking':
      return { name: 'emotes/wave', loop: true }
    case 'thinking':
      return { name: 'emotes/thinking', loop: true }
    case 'reviewing':
      return { name: 'emotes/dramatic-stare', loop: true }
    case 'blocked':
      return { name: 'emotes/sweat', loop: true }
    case 'completed':
      return {
        name: 'emotes/just-right',
        loop: false,
        settleTo: directionalAnimation('idle', 'front'),
      }
    case 'failed':
      return { name: 'emotes/sulk', loop: true }
    case 'cancelled':
      return {
        name: 'emotes/shrug',
        loop: false,
        settleTo: directionalAnimation('idle', 'front'),
      }
  }
}

/** Director motion is intentionally restrained: posture changes communicate state without cheerleading. */
export function resolveDirectorAnimation(
  state: OfficeAgentState,
  facing: ChibiFacing
): WorkerAnimationSpec {
  switch (state) {
    case 'walking':
      return { name: directionalAnimation('trot', facing), loop: true }
    case 'thinking':
    case 'reviewing':
      return { name: 'emotes/thinking', loop: true }
    case 'blocked':
      return { name: 'emotes/sweat', loop: true }
    case 'waiting':
    case 'working':
      return { name: directionalAnimation('idle', facing), loop: true }
    case 'talking':
    case 'completed':
    case 'failed':
    case 'cancelled':
      return { name: directionalAnimation('idle', 'front'), loop: true }
  }
}
