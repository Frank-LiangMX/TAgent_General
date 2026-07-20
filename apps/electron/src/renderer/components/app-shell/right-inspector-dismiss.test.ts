import { describe, expect, test } from 'vitest'

import { shouldDismissFloatInspector } from './right-inspector-dismiss'

function mockTarget(options: {
  insideRoot?: boolean
  closestMatch?: string | null
}): {
  target: { closest: (sel: string) => unknown }
  root: { contains: (node: unknown) => boolean }
} {
  const target = {
    closest: (sel: string) => {
      if (!options.closestMatch) return null
      // 选择器是逗号拼接；命中子串即可（与真实 closest 语义足够接近）
      return sel.includes(options.closestMatch) ? { matched: true } : null
    },
  }
  const root = {
    contains: () => Boolean(options.insideRoot),
  }
  return { target, root }
}

describe('shouldDismissFloatInspector', () => {
  test('returns false when click is inside inspector root', () => {
    const { target, root } = mockTarget({ insideRoot: true })
    expect(shouldDismissFloatInspector(target, root)).toBe(false)
  })

  test('returns true when click is outside inspector root', () => {
    const { target, root } = mockTarget({ insideRoot: false })
    expect(shouldDismissFloatInspector(target, root)).toBe(true)
  })

  test('ignores radix portaled popovers', () => {
    const { target, root } = mockTarget({
      insideRoot: false,
      closestMatch: 'data-radix-popper-content-wrapper',
    })
    expect(shouldDismissFloatInspector(target, root)).toBe(false)
  })

  test('ignores morph surface outside the stack', () => {
    const { target, root } = mockTarget({
      insideRoot: false,
      closestMatch: 'right-inspector-morph-surface',
    })
    expect(shouldDismissFloatInspector(target, root)).toBe(false)
  })

  test('returns false for non-element targets or missing root', () => {
    const { target, root } = mockTarget({ insideRoot: false })
    expect(shouldDismissFloatInspector(null, root)).toBe(false)
    expect(shouldDismissFloatInspector(target, null)).toBe(false)
    expect(shouldDismissFloatInspector('x' as unknown as EventTarget, root)).toBe(false)
  })
})
