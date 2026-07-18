import { describe, expect, it } from 'vitest'

import { escapePsLike } from './dev-kill-shared'

describe('escapePsLike', () => {
  it('keeps Windows path separators unchanged', () => {
    expect(escapePsLike('F:\\TAgent_General\\node_modules\\vite')).toBe(
      'F:\\TAgent_General\\node_modules\\vite'
    )
  })

  it('escapes single quotes inside PowerShell string literals', () => {
    expect(escapePsLike("F:\\O'Brien\\project")).toBe("F:\\O''Brien\\project")
  })
})
