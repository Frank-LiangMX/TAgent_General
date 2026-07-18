import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

describe('development command contract', () => {
  it('cleans stale processes before starting parallel dev services', () => {
    expect(packageJson.scripts.dev).toMatch(/^bun run dev:kill && concurrently /)
  })

  it('does not clean processes from inside the electron branch', () => {
    expect(packageJson.scripts['dev:electron']).not.toContain('dev:kill')
  })
})
