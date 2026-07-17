import { afterEach, describe, expect, test } from 'bun:test'

import { isPortableBuild } from './is-portable-build'

describe('isPortableBuild', () => {
  const original = process.env.PORTABLE_EXECUTABLE_DIR

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PORTABLE_EXECUTABLE_DIR
    } else {
      process.env.PORTABLE_EXECUTABLE_DIR = original
    }
  })

  test('未设置 PORTABLE_EXECUTABLE_DIR 时返回 false', () => {
    delete process.env.PORTABLE_EXECUTABLE_DIR
    expect(isPortableBuild()).toBe(false)
  })

  test('设置 PORTABLE_EXECUTABLE_DIR 时返回 true', () => {
    process.env.PORTABLE_EXECUTABLE_DIR = 'C:\\Users\\demo\\Downloads'
    expect(isPortableBuild()).toBe(true)
  })
})
