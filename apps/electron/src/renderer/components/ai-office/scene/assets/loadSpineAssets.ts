// @ts-nocheck
import '@esotericsoftware/spine-pixi-v8'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Assets } from 'pixi.js'

export type SpineCharacterPack = 'chibi-stickers'

let loaded = false
let activePack: SpineCharacterPack | null = null
let skeletonAlias = ''
let atlasAlias = ''

const PACKS: { id: SpineCharacterPack; skeleton: string; atlas: string }[] = [
  {
    id: 'chibi-stickers',
    skeleton: '/assets/characters/chibi-stickers/chibi-stickers.json',
    atlas: '/assets/characters/chibi-stickers/chibi-stickers.atlas',
  },
]

export async function loadSpineAssets(): Promise<boolean> {
  if (loaded) return true

  for (const pack of PACKS) {
    const skeleton = `${pack.id}-skeleton`
    const atlas = `${pack.id}-atlas`
    try {
      Assets.add({ alias: skeleton, src: pack.skeleton })
      Assets.add({ alias: atlas, src: pack.atlas })
      await Assets.load([skeleton, atlas])
      skeletonAlias = skeleton
      atlasAlias = atlas
      activePack = pack.id
      loaded = true
      console.info(`[AI Office] Spine character pack loaded: ${pack.id}`)
      return true
    } catch (error) {
      console.warn(`[AI Office] Spine character pack failed: ${pack.id}`, error)
    }
  }

  console.error('[AI Office] Spine assets unavailable; using vector fallback characters')
  return false
}

export function isSpineReady(): boolean {
  return loaded && activePack != null
}

export function getSpineCharacterPack(): SpineCharacterPack | null {
  return activePack
}

export function createSpineFromCache(): Spine | null {
  if (!isSpineReady()) return null
  return Spine.from({
    skeleton: skeletonAlias,
    atlas: atlasAlias,
    scale: 1,
    autoUpdate: true,
  })
}
