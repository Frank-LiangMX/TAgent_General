/**
 * Idle memory consolidation scheduler tests
 *
 * No vi.mock() calls — the IdleConsolidationScheduler class accepts injected
 * dependencies so the test creates its own instance with a manual timer queue
 * and a mock ConsolidationService.
 *
 * vitest's vi.advanceTimersByTime fires callbacks synchronously, but our
 * callback is async. The `await` inside the callback suspends and the next
 * setTimeout is not registered before assertions run, causing flaky overlap
 * tests.  Instead we use an injected ManualTimerQueue that collects timers
 * and lets the test control exactly when callbacks fire and when microtasks
 * drain.
 */

import { describe, expect, test, afterEach, vi } from 'vitest'
import {
  IdleConsolidationScheduler,
  resolveIdleConsolidationFlag,
} from './idle-memory-consolidation-scheduler'

// =========================================================================
// Manual timer queue — injected into the scheduler
// =========================================================================

interface PendingTimer {
  id: number
  cb: () => void
  delay: number
  registeredAt: number
}

class ManualTimerQueue {
  private nextId = 1
  private pending: PendingTimer[] = []
  private _now = 0

  /** Mimics setTimeout — records the callback for later firing. */
  setTimeout = (cb: () => void, ms: number): number => {
    const id = this.nextId++
    this.pending.push({ id, cb, delay: ms, registeredAt: this._now })
    return id
  }

  /** Mimics clearTimeout — removes a pending timer. */
  clearTimeout = (id: number): void => {
    this.pending = this.pending.filter((t) => t.id !== id)
  }

  /**
   * Advance the virtual clock by `ms` and fire all callbacks whose deadline
   * has been reached, in registration order.  Each callback is `await`ed
   * (if async) before the next fires, so microtasks have a chance to settle
   * and the next setTimeout gets registered by the scheduler's recursion.
   *
   * This also drains microtasks after each callback via Promise.resolve().
   */
  async advance(ms: number): Promise<void> {
    const target = this._now + ms
    // Fire timers in registration order, one at a time.
    while (true) {
      // Find the earliest pending timer whose deadline ≤ target.
      const idx = this.pending.findIndex((t) => t.registeredAt + t.delay <= target)
      if (idx === -1) break
      const timer = this.pending.splice(idx, 1)[0]
      if (!timer) continue
      // Move clock forward to the timer's firing point.
      this._now = timer.registeredAt + timer.delay
      // Execute the callback (may be async — await it).
      await timer.cb()
      // Drain microtasks after each callback.
      await Promise.resolve()
    }
    // Always advance the clock to target, even if no timers fired.
    this._now = target
  }

  /** Number of timers still waiting to fire. */
  get pendingCount(): number {
    return this.pending.length
  }
}

// =========================================================================
// Helpers
// =========================================================================

/** Build a clean test instance with the given ManualTimerQueue. */
function createTestScheduler(queue: ManualTimerQueue) {
  const runIfEligible = vi.fn().mockResolvedValue({ outcome: 'skipped_clean', requestsUsed: 0 })
  const scheduler = new IdleConsolidationScheduler(
    {
      createService: async () => ({ runIfEligible }),
      setTimeout: queue.setTimeout,
      clearTimeout: queue.clearTimeout,
    },
    60_000
  )
  return { scheduler, runIfEligible }
}

// =========================================================================
// Tests
// =========================================================================

describe('idle-memory-consolidation-scheduler', () => {
  // ---------------------------------------------------------------
  // 1. resolveIdleConsolidationFlag
  // ---------------------------------------------------------------
  describe('resolveIdleConsolidationFlag', () => {
    const originalEnv = process.env.TAGENT_IDLE_MEMORY_CONSOLIDATION

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.TAGENT_IDLE_MEMORY_CONSOLIDATION
      } else {
        process.env.TAGENT_IDLE_MEMORY_CONSOLIDATION = originalEnv
      }
    })

    test('TAGENT_IDLE_MEMORY_CONSOLIDATION=1 forces on even in packaged', () => {
      process.env.TAGENT_IDLE_MEMORY_CONSOLIDATION = '1'
      expect(resolveIdleConsolidationFlag(true)).toBe(true)
    })

    test('TAGENT_IDLE_MEMORY_CONSOLIDATION=0 forces off even in dev', () => {
      process.env.TAGENT_IDLE_MEMORY_CONSOLIDATION = '0'
      expect(resolveIdleConsolidationFlag(false)).toBe(false)
    })

    test('unset + !isPackaged => on (dev default)', () => {
      delete process.env.TAGENT_IDLE_MEMORY_CONSOLIDATION
      expect(resolveIdleConsolidationFlag(false)).toBe(true)
    })

    test('unset + isPackaged => off (prod default)', () => {
      delete process.env.TAGENT_IDLE_MEMORY_CONSOLIDATION
      expect(resolveIdleConsolidationFlag(true)).toBe(false)
    })
  })

  // ---------------------------------------------------------------
  // 2. Delayed first tick
  // ---------------------------------------------------------------
  test('first tick fires after TICK_MS, not immediately', async () => {
    const queue = new ManualTimerQueue()
    const { scheduler, runIfEligible } = createTestScheduler(queue)

    await scheduler.start()

    // Immediately after start — no calls yet, one timer pending
    expect(runIfEligible).not.toHaveBeenCalled()
    expect(queue.pendingCount).toBe(1)

    // Advance just short of TICK_MS
    await queue.advance(59_999)
    expect(runIfEligible).not.toHaveBeenCalled()

    // Advance past TICK_MS — now it fires
    await queue.advance(1)
    expect(runIfEligible).toHaveBeenCalledTimes(2) // general + ta
  })

  // ---------------------------------------------------------------
  // 3. Serial order: general then ta
  // ---------------------------------------------------------------
  test('runs general before ta', async () => {
    const callOrder: string[] = []
    const queue = new ManualTimerQueue()
    const runIfEligible = vi.fn().mockImplementation(async (mode: string) => {
      callOrder.push(mode)
      return { outcome: 'skipped_clean', requestsUsed: 0 }
    })
    const scheduler = new IdleConsolidationScheduler(
      {
        createService: async () => ({ runIfEligible }),
        setTimeout: queue.setTimeout,
        clearTimeout: queue.clearTimeout,
      },
      60_000
    )

    await scheduler.start()
    await queue.advance(60_000)

    expect(callOrder).toEqual(['general', 'ta'])
  })

  // ---------------------------------------------------------------
  // 4. No overlap: second scan waits for first
  // ---------------------------------------------------------------
  test('no overlap when scan takes longer than tick interval', async () => {
    let deferredResolve!: () => void
    const deferred = new Promise<void>((r) => {
      deferredResolve = r
    })

    const queue = new ManualTimerQueue()
    const runIfEligible = vi.fn().mockImplementation(async (mode: string) => {
      if (mode === 'general') {
        await deferred
      }
      return { outcome: 'success', requestsUsed: 1 }
    })
    const scheduler = new IdleConsolidationScheduler(
      {
        createService: async () => ({ runIfEligible }),
        setTimeout: queue.setTimeout,
        clearTimeout: queue.clearTimeout,
      },
      60_000
    )

    await scheduler.start()

    // First tick fires at 60s — scan starts, blocks on deferred.
    // advance() awaits the callback, so it blocks here too.
    const firstScanPromise = queue.advance(60_000)

    // Let a microtask tick so the scan's `await deferred` is registered.
    await Promise.resolve()
    expect(runIfEligible).toHaveBeenCalledTimes(1) // 'general' started, blocked

    // No new timer registered yet (scan hasn't finished)
    expect(queue.pendingCount).toBe(0)

    // Unblock the first scan — this lets advance() complete.
    deferredResolve!()
    await firstScanPromise

    // First scan done (general + ta), next tick now scheduled
    expect(runIfEligible).toHaveBeenCalledTimes(2)
    expect(queue.pendingCount).toBe(1)

    // Advance past next tick interval — second scan fires
    await queue.advance(60_000)
    expect(runIfEligible).toHaveBeenCalledTimes(4) // general + ta again
  })

  // ---------------------------------------------------------------
  // 5. Foreground dependency wiring
  // ---------------------------------------------------------------
  test('isForegroundActive is called during scan', async () => {
    const queue = new ManualTimerQueue()
    const foregroundDetector = vi.fn().mockReturnValue(false)
    const runIfEligible = vi.fn().mockImplementation(async () => {
      foregroundDetector()
      return { outcome: 'skipped_clean', requestsUsed: 0 }
    })
    const scheduler = new IdleConsolidationScheduler(
      {
        createService: async () => ({ runIfEligible }),
        setTimeout: queue.setTimeout,
        clearTimeout: queue.clearTimeout,
      },
      60_000
    )

    await scheduler.start()
    await queue.advance(60_000)

    // Called once per mode (general + ta)
    expect(foregroundDetector).toHaveBeenCalledTimes(2)
  })

  // ---------------------------------------------------------------
  // 6. Stop cleanup
  // ---------------------------------------------------------------
  test('stop clears timer and prevents future ticks', async () => {
    const queue = new ManualTimerQueue()
    const { scheduler, runIfEligible } = createTestScheduler(queue)

    await scheduler.start()
    expect(scheduler.isRunning()).toBe(true)

    scheduler.stop()
    expect(scheduler.isRunning()).toBe(false)
    expect(queue.pendingCount).toBe(0)

    // Advance well past tick — no calls
    await queue.advance(300_000)
    expect(runIfEligible).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------
  // 7. Idempotent start
  // ---------------------------------------------------------------
  test('calling start twice does not create duplicate timers', async () => {
    const queue = new ManualTimerQueue()
    const { scheduler, runIfEligible } = createTestScheduler(queue)

    await scheduler.start()
    await scheduler.start()

    expect(queue.pendingCount).toBe(1) // only one timer
    await queue.advance(60_000)
    // Should only be 2 calls (general + ta), not 4
    expect(runIfEligible).toHaveBeenCalledTimes(2)
  })

  // ---------------------------------------------------------------
  // 8. isRunning reflects state
  // ---------------------------------------------------------------
  test('isRunning returns false before start and after stop', () => {
    const queue = new ManualTimerQueue()
    const { scheduler } = createTestScheduler(queue)
    expect(scheduler.isRunning()).toBe(false)
  })

  test('isRunning returns true after start', async () => {
    const queue = new ManualTimerQueue()
    const { scheduler } = createTestScheduler(queue)

    await scheduler.start()
    expect(scheduler.isRunning()).toBe(true)
  })

  // ---------------------------------------------------------------
  // 9. Start failure resets started flag
  // ---------------------------------------------------------------
  test('start failure resets started flag so retry is possible', async () => {
    const queue = new ManualTimerQueue()
    const alwaysFail = new IdleConsolidationScheduler(
      {
        createService: async () => {
          throw new Error('service creation failed')
        },
        setTimeout: queue.setTimeout,
        clearTimeout: queue.clearTimeout,
      },
      60_000
    )

    await alwaysFail.start()
    expect(alwaysFail.isRunning()).toBe(false)

    // A fresh instance with working deps should start fine
    const queue2 = new ManualTimerQueue()
    const { scheduler, runIfEligible } = createTestScheduler(queue2)
    await scheduler.start()
    expect(scheduler.isRunning()).toBe(true)

    await queue2.advance(60_000)
    expect(runIfEligible).toHaveBeenCalled()
  })

  // ---------------------------------------------------------------
  // 10. Stop during async start prevents timer arming
  // ---------------------------------------------------------------
  test('stop during async start prevents timer from being armed', async () => {
    let resolveCreate!: () => void
    const queue = new ManualTimerQueue()
    const runIfEligible = vi.fn().mockResolvedValue({ outcome: 'skipped_clean', requestsUsed: 0 })

    const scheduler = new IdleConsolidationScheduler(
      {
        createService: async () => {
          await new Promise<void>((r) => {
            resolveCreate = r
          })
          return { runIfEligible }
        },
        setTimeout: queue.setTimeout,
        clearTimeout: queue.clearTimeout,
      },
      60_000
    )

    // Start — createService blocks
    const startPromise = scheduler.start()

    // Stop while createService is pending
    scheduler.stop()
    expect(scheduler.isRunning()).toBe(false)

    // Resolve createService
    resolveCreate!()
    await startPromise

    // Timer should NOT have been armed
    expect(queue.pendingCount).toBe(0)
    await queue.advance(60_000)
    expect(runIfEligible).not.toHaveBeenCalled()
  })
})
