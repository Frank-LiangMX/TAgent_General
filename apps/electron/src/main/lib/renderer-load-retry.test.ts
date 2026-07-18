import { describe, expect, it, vi } from 'vitest'

import { loadRendererWithRetry } from './renderer-load-retry'

describe('loadRendererWithRetry', () => {
  it('retries a transient dev load failure', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('network service restarted'))
      .mockResolvedValue(undefined)
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await loadRendererWithRetry({
      isDev: true,
      isDestroyed: () => false,
      load,
      retryDelaysMs: [25],
      sleep,
    })

    expect(result).toEqual({ success: true, attempts: 2 })
    expect(load).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(25)
  })

  it('does not retry a production load failure', async () => {
    const error = new Error('renderer missing')
    const load = vi.fn().mockRejectedValue(error)
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await loadRendererWithRetry({
      isDev: false,
      isDestroyed: () => false,
      load,
      sleep,
    })

    expect(result).toEqual({ success: false, attempts: 1, error })
    expect(sleep).not.toHaveBeenCalled()
  })

  it('stops retrying when the window is destroyed', async () => {
    let destroyed = false
    const load = vi.fn().mockImplementation(async () => {
      destroyed = true
      throw new Error('window closed')
    })

    const result = await loadRendererWithRetry({
      isDev: true,
      isDestroyed: () => destroyed,
      load,
      retryDelaysMs: [25],
      sleep: vi.fn().mockResolvedValue(undefined),
    })

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1)
    expect(load).toHaveBeenCalledTimes(1)
  })
})
