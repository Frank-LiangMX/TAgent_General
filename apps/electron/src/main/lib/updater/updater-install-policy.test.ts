import { describe, expect, test } from 'bun:test'

import { shouldUseSilentInstall } from './updater-install-policy'

describe('shouldUseSilentInstall', () => {
  test('Windows NSIS 向导安装包不使用静默安装', () => {
    const original = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })
    expect(shouldUseSilentInstall()).toBe(false)
    Object.defineProperty(process, 'platform', { value: original })
  })

  test('macOS / Linux 可使用静默安装', () => {
    const original = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    expect(shouldUseSilentInstall()).toBe(true)
    Object.defineProperty(process, 'platform', { value: 'linux' })
    expect(shouldUseSilentInstall()).toBe(true)
    Object.defineProperty(process, 'platform', { value: original })
  })
})
