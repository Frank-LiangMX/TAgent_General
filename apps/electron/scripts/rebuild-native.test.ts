import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { findNativeArtifact } from './rebuild-native'

const tempDirs: string[] = []

function makeFixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rebuild-native-'))
  tempDirs.push(dir)
  const releaseDir = join(dir, 'build', 'Release')
  mkdirSync(releaseDir, { recursive: true })
  return releaseDir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('findNativeArtifact', () => {
  it('picks the main product, not the small test extension', () => {
    const releaseDir = makeFixtureDir()
    writeFileSync(join(releaseDir, 'test_extension.node'), Buffer.alloc(15_280))
    writeFileSync(join(releaseDir, 'better_sqlite3.node'), Buffer.alloc(1_400_000))
    // 入参是模块根目录，build/Release 在内部拼接
    expect(findNativeArtifact(join(releaseDir, '..', '..'))).toBe(
      join(releaseDir, 'better_sqlite3.node')
    )
  })

  it('returns null when build/Release is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-native-'))
    tempDirs.push(dir)
    expect(findNativeArtifact(dir)).toBeNull()
  })

  it('returns null when no .node artifact is larger than 1KB', () => {
    const releaseDir = makeFixtureDir()
    writeFileSync(join(releaseDir, 'tiny.node'), Buffer.alloc(100))
    expect(findNativeArtifact(join(releaseDir, '..', '..'))).toBeNull()
  })
})
