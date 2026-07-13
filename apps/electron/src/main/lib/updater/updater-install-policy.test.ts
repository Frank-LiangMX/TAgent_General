import { describe, expect, test } from 'bun:test'

import { shouldUseSilentInstall } from './updater-install-policy'

describe('shouldUseSilentInstall', () => {
  test('所有平台统一静默安装', () => {
    expect(shouldUseSilentInstall()).toBe(true)
  })
})
