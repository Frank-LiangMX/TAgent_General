// @ts-nocheck
// Spine loading disabled — using vector fallback characters

export type SpineCharacterPack = 'chibi-stickers'

let loaded = false

export async function loadSpineAssets(): Promise<boolean> {
  // Skip Spine, use vector characters
  loaded = true
  return false // return false = not Spine, use vector
}

export function isSpineReady(): boolean { return false }
export function getSpineCharacterPack(): SpineCharacterPack | null { return null }
export function createSpineFromCache(): null { return null }
