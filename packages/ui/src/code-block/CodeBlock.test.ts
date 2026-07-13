import { describe, expect, test } from 'vitest'

import { shouldUsePlainTextColors } from './CodeBlock'

describe('CodeBlock plain-text colors', () => {
  test.each(['', 'text', 'plaintext', 'txt', 'TEXT'])(
    'uses the active theme foreground for %j fences',
    (language) => {
      expect(shouldUsePlainTextColors(language)).toBe(true)
    }
  )

  test.each(['typescript', 'python', 'bash', 'mermaid'])(
    'keeps Shiki token colors for %s fences',
    (language) => {
      expect(shouldUsePlainTextColors(language)).toBe(false)
    }
  )
})
