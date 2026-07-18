// @vitest-environment jsdom

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, test } from 'vitest'

import { InertRegion } from './InertRegion'

function region(inactive: boolean): React.ReactElement {
  return React.createElement(InertRegion, { inactive, id: 'region' }, 'content')
}

describe('InertRegion', () => {
  test('adds inert and aria-hidden while inactive', () => {
    const { container } = render(region(true))

    const element = container.querySelector<HTMLElement>('#region')!
    expect(element.hasAttribute('inert')).toBe(true)
    expect(element).toHaveAttribute('aria-hidden', 'true')
  })

  test('removes inert and aria-hidden when reactivated', () => {
    const { container, rerender } = render(region(true))
    rerender(region(false))

    const element = container.querySelector<HTMLElement>('#region')!
    expect(element.hasAttribute('inert')).toBe(false)
    expect(element).not.toHaveAttribute('aria-hidden')
  })
})
