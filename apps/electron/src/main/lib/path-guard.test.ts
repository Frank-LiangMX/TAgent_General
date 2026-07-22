import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { isPathInside, isPathInsideResolved } from './path-guard'

describe('isPathInsideResolved', () => {
  test('同路径视为在内', () => {
    const root = resolve('/tmp/tagent-project')
    expect(isPathInsideResolved(root, root)).toBe(true)
  })

  test('子路径在内', () => {
    const root = resolve('/tmp/tagent-project')
    const child = resolve('/tmp/tagent-project/src/a.ts')
    expect(isPathInsideResolved(child, root)).toBe(true)
  })

  test('兄弟路径不在内（防止前缀误匹配）', () => {
    const root = resolve('/tmp/tagent-project')
    const sibling = resolve('/tmp/tagent-project-other/a.ts')
    expect(isPathInsideResolved(sibling, root)).toBe(false)
  })

  test('父路径不在内', () => {
    const root = resolve('/tmp/tagent-project/src')
    const parent = resolve('/tmp/tagent-project')
    expect(isPathInsideResolved(parent, root)).toBe(false)
  })
})

describe('isPathInside', () => {
  test('resolve 后判断子路径', () => {
    expect(isPathInside('/tmp/proj/a.ts', '/tmp/proj')).toBe(true)
    expect(isPathInside('/tmp/other/a.ts', '/tmp/proj')).toBe(false)
  })
})

// Windows 大小写：仅在 win32 上验证（path.relative 在此平台大小写不敏感）
if (process.platform === 'win32') {
  describe('isPathInsideResolved (win32 大小写)', () => {
    test('盘符大小写不同仍判定在内', () => {
      const root = 'F:\\TAgent_General'
      const child = 'f:\\TAgent_General\\packages\\shared\\src\\utils\\file-path.ts'
      expect(isPathInsideResolved(child, root)).toBe(true)
    })

    test('正斜杠 / 反斜杠混用且盘符大小写不同', () => {
      const root = 'F:/TAgent_General'
      const child = 'f:\\TAgent_General\\Claude.md'
      expect(isPathInsideResolved(resolve(child), resolve(root))).toBe(true)
    })

    test('不同盘符不在内', () => {
      expect(isPathInsideResolved('C:\\Windows\\System32', 'F:\\TAgent_General')).toBe(false)
    })
  })
}
