/**
 * MemoryConsolidationService 单测 — ADR-0006 Phase 2
 *
 * 覆盖：0 请求跳过、静默/debounce、force 边界、单并发、模式隔离、
 * 预算、一次重试、失败游标、成功清理、batch 上限、幂等、
 * 默认 executor 只调用一次 streamSSE、kscc 零请求、insight 本地应用零 LLM。
 */

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'

// =========================================================================
// Electron mock — must be set before ANY module imports
// reflect-service imports electron at the top level.
// =========================================================================

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/tmp',
  },
  safeStorage: {
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}))

// =========================================================================
// Imports after vi.mock
// =========================================================================

import type { MemoryEvidenceEntry } from './memory-evidence-sink'
import type { MemoryMode } from './memory-layer-service'
import type { BatchOutput, ConsolidationDeps } from './memory-consolidation-service'

const {
  ConsolidationService,
  todayStr,
  filterAfterCursor,
  ConsolidationError,
  defaultApplier,
  sanitizeBatchOutput,
  computeBatchId,
} = await import('./memory-consolidation-service')

// =========================================================================
// Helpers
// =========================================================================

let testCounter = 0
const runNonce = globalThis.crypto.randomUUID()

/** Returns a stable unique path for a deps instance */
function makeStatePath(): string {
  testCounter++
  const pid = process.pid
  return `/tmp/test-consolidation-${pid}-${runNonce}-${testCounter}.json`
}

function makeEvidence(
  overrides: Partial<MemoryEvidenceEntry> & { id: string; createdAt: number; mode: MemoryMode }
): MemoryEvidenceEntry {
  return {
    source: 'session',
    sessionId: 'sess-test',
    sessionTitle: 'Test Session',
    sessionSummary: 'Test summary',
    toolsUsed: [],
    ...overrides,
  }
}

interface MakeDepsOpts extends Omit<Partial<ConsolidationDeps>, 'now'> {
  /** Fixed timestamp for the test clock. Defaults to Date.now() frozen. */
  frozenNow?: number
  /** Override clock; mutually exclusive with frozenNow. */
  now?: () => number
}

/**
 * Create ConsolidationDeps with a STABLE state path and frozen clock.
 *
 * Rules:
 * - getStatePath always returns the same path (stableStatePath).
 * - now() returns the fixed frozenNow value (or Date.now() frozen once).
 * - All skip-inducing fns return false/empty by default.
 */
function makeDeps(opts: MakeDepsOpts = {}): ConsolidationDeps {
  const stableStatePath = makeStatePath()
  const stableLeasePath = makeStatePath()
  const frozenNow = opts.frozenNow ?? Date.now()
  const { frozenNow: _fn, ...rest } = opts

  return {
    getPendingEvidence: () => [],
    isModeDirty: () => false,
    markModeClean: () => {},
    consumeProcessedEvidence: () => 0,
    executeConsolidation: async () => ({
      sessionKeyFacts: [],
      memoryCandidates: [],
      insights: [],
      contradictions: [],
    }),
    applyBatchOutput: async () => {},
    now: () => frozenNow,
    isForegroundActive: () => false,
    getStatePath: () => stableStatePath,
    getLeasePath: () => stableLeasePath,
    ...rest,
  }
}

// =========================================================================
// Tests
// =========================================================================

describe('ConsolidationService — ADR-0006 Phase 2', () => {
  // ---------------------------------------------------------------
  // 1. 0 请求跳过
  // ---------------------------------------------------------------
  describe('跳过分支无请求', () => {
    test('无 dirty 时返回 skipped_clean 且 requestsUsed=0', async () => {
      const svc = new ConsolidationService(makeDeps())
      const r = await svc.runIfEligible('general')
      expect(r.outcome).toBe('skipped_clean')
      expect(r.requestsUsed).toBe(0)
    })

    test('dirty 但证据为空时返回 skipped_clean', async () => {
      const svc = new ConsolidationService(
        makeDeps({ isModeDirty: () => true, getPendingEvidence: () => [] })
      )
      const r = await svc.runIfEligible('general')
      expect(r.outcome).toBe('skipped_clean')
      expect(r.requestsUsed).toBe(0)
    })

    test('证据无有效内容时返回 skipped_insufficient_evidence', async () => {
      const now = Date.now()
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 5 * 60 * 1000,
              mode: 'general',
              sessionTitle: '',
              sessionSummary: '',
            }),
          ],
        })
      )
      const r = await svc.runIfEligible('general')
      expect(r.outcome).toBe('skipped_insufficient_evidence')
      expect(r.requestsUsed).toBe(0)
    })
  })

  // ---------------------------------------------------------------
  // 2. 静默窗 / debounce
  // ---------------------------------------------------------------
  describe('静默窗与 debounce', () => {
    test('最新证据在 10 分钟静默窗内时跳过', async () => {
      const now = Date.now()
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
        })
      )
      const r = await svc.runIfEligible('general')
      expect(r.outcome).toBe('skipped_silence_window')
      expect(r.requestsUsed).toBe(0)
    })

    test('证据在静默窗外但在 debounce 内时跳过', async () => {
      const now = Date.now()
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 15 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
        })
      )
      const r = await svc.runIfEligible('general')
      expect(r.outcome).toBe('skipped_debounce')
      expect(r.requestsUsed).toBe(0)
    })

    test('静默窗和 debounce 都不满足时正常执行', async () => {
      const now = Date.now()
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const r = await svc.runIfEligible('general')
      expect(r.outcome).toBe('success')
      expect(mockExec).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------
  // 3. Force 边界
  // ---------------------------------------------------------------
  describe('force 跳过时间等待但不能跳过程序约束', () => {
    test('force 跳过静默窗', async () => {
      const now = Date.now()
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const r = await svc.runIfEligible('general', { force: true })
      expect(r.outcome).toBe('success')
      expect(mockExec).toHaveBeenCalledOnce()
    })

    test('force 不能跳过前台互斥', async () => {
      const now = Date.now()
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => true,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
        })
      )
      const r = await svc.runIfEligible('general', { force: true })
      expect(r.outcome).toBe('skipped_foreground_active')
      expect(r.requestsUsed).toBe(0)
    })

    test('force 不能跳过单并发', async () => {
      const now = Date.now()
      let release: () => void
      const held = new Promise<void>((r) => {
        release = r
      })
      const mockExec = vi.fn().mockImplementation(async () => {
        await held
        return { sessionKeyFacts: [], memoryCandidates: [], insights: [], contradictions: [] }
      })
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const p1 = svc.runIfEligible('general', { force: true })
      await new Promise((r) => setTimeout(r, 10))
      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('skipped_locked')
      release!()
      await p1
    })

    test('force 不能跳过预算', async () => {
      const now = Date.now()
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [{ sessionId: 'sess-1', facts: ['fact1'] }],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      let callCount = 0
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => {
            callCount++
            if (callCount === 1) {
              return [
                makeEvidence({
                  id: 'ev-1',
                  createdAt: now - 35 * 60 * 1000,
                  mode: 'general',
                  sessionTitle: 'T',
                  sessionSummary: 'S',
                }),
              ]
            }
            // 第二次返回真正晚于 cursor 的新 evidence
            return [
              makeEvidence({
                id: 'ev-2',
                createdAt: now - 60 * 1000,
                mode: 'general',
                sessionTitle: 'T2',
                sessionSummary: 'S2',
              }),
            ]
          },
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const r1 = await svc.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('success')
      expect(r1.requestsUsed).toBe(1)

      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('skipped_budget')
      expect(r2.requestsUsed).toBe(0)
    })
  })

  // ---------------------------------------------------------------
  // 4. 单并发
  // ---------------------------------------------------------------
  describe('全局单并发', () => {
    test('general 运行中时 ta 也被锁住', async () => {
      const now = Date.now()
      let release: () => void
      const held = new Promise<void>((r) => {
        release = r
      })
      const mockExec = vi.fn().mockImplementation(async () => {
        await held
        return { sessionKeyFacts: [], memoryCandidates: [], insights: [], contradictions: [] }
      })
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const p1 = svc.runIfEligible('general', { force: true })
      await new Promise((r) => setTimeout(r, 10))

      const r2 = await svc.runIfEligible('ta', { force: true })
      expect(r2.outcome).toBe('skipped_locked')

      release!()
      await p1
    })
  })

  // ---------------------------------------------------------------
  // 5. 模式隔离
  // ---------------------------------------------------------------
  describe('模式隔离', () => {
    test('general 和 ta 各自独立运行状态', async () => {
      const now = Date.now()
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      // Each mode gets its own state path via separate deps instances
      const depsG = makeDeps({
        frozenNow: now,
        isModeDirty: () => true,
        isForegroundActive: () => false,
        getPendingEvidence: () => [
          makeEvidence({
            id: 'ev-g',
            createdAt: now - 35 * 60 * 1000,
            mode: 'general',
            sessionTitle: 'T',
            sessionSummary: 'S',
          }),
        ],
        executeConsolidation: mockExec,
        applyBatchOutput: async () => {},
      })
      const svcG = new ConsolidationService(depsG)
      const r1 = await svcG.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('success')

      const depsT = makeDeps({
        frozenNow: now,
        isModeDirty: () => true,
        isForegroundActive: () => false,
        getPendingEvidence: () => [
          makeEvidence({
            id: 'ev-t',
            createdAt: now - 35 * 60 * 1000,
            mode: 'ta',
            sessionTitle: 'TT',
            sessionSummary: 'TS',
          }),
        ],
        executeConsolidation: mockExec,
        applyBatchOutput: async () => {},
      })
      const svcT = new ConsolidationService(depsT)
      const r2 = await svcT.runIfEligible('ta', { force: true })
      expect(r2.outcome).toBe('success')

      expect(svcT.getState('ta').requestsUsedToday).toBe(1)
    })
  })

  // ---------------------------------------------------------------
  // 6. 预算
  // ---------------------------------------------------------------
  describe('预算控制', () => {
    test('一次成功运行后 budget 耗尽，再次调用返回 skipped_budget', async () => {
      const now = Date.now()
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      let callCount = 0
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => {
            callCount++
            if (callCount === 1) {
              return [
                makeEvidence({
                  id: 'ev-1',
                  createdAt: now - 35 * 60 * 1000,
                  mode: 'general',
                  sessionTitle: 'T',
                  sessionSummary: 'S',
                }),
              ]
            }
            return [
              makeEvidence({
                id: 'ev-2',
                createdAt: now - 60 * 1000,
                mode: 'general',
                sessionTitle: 'T2',
                sessionSummary: 'S2',
              }),
            ]
          },
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const r1 = await svc.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('success')
      expect(r1.requestsUsed).toBe(1)

      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('skipped_budget')
      expect(r2.requestsUsed).toBe(0)
    })
  })

  // ---------------------------------------------------------------
  // 7. 网络失败：单次 run executor 只调用 1 次
  // ---------------------------------------------------------------
  describe('网络失败单次 run executor 只 1 次', () => {
    test('单次 runIfEligible executor 抛错后不再调用，outcome=failed requestsUsed=1', async () => {
      const now = Date.now()
      const mockExec = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const result = await svc.runIfEligible('general', { force: true })
      expect(result.outcome).toBe('failed')
      expect(result.requestsUsed).toBe(1)
      expect(mockExec).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------
  // 8. 退避后第二 run 允许重试且总请求 2
  // ---------------------------------------------------------------
  describe('失败退避后第二 run 允许重试', () => {
    test('第一次失败后退避，时钟前进后第二 run 允许重试，总请求 2', async () => {
      const now = Date.now()
      let callCount = 0
      const mockExec = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) throw new Error('API 暂时不可用')
        return {
          sessionKeyFacts: [{ sessionId: 'sess-1', facts: ['fact1'] }],
          memoryCandidates: [],
          insights: [],
          contradictions: [],
        }
      })
      let clock = now
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
          now: () => clock,
        })
      )

      // 第一次 run：失败
      const r1 = await svc.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('failed')
      expect(r1.requestsUsed).toBe(1)
      expect(callCount).toBe(1)

      // 退避期间再调用 → skipped_retry_backoff
      const r1b = await svc.runIfEligible('general', { force: true })
      expect(r1b.outcome).toBe('skipped_retry_backoff')
      expect(r1b.requestsUsed).toBe(0)
      expect(callCount).toBe(1)

      // 时钟前进 31 分钟（超过退避 30 分钟）
      clock = now + 31 * 60 * 1000

      // 第二次 run：重试成功
      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('success')
      expect(r2.requestsUsed).toBe(1)
      expect(callCount).toBe(2)
    })
  })

  // ---------------------------------------------------------------
  // 9. 失败游标
  describe('失败游标不推进', () => {
    test('失败后 cursor 不变，证据不清除', async () => {
      const now = Date.now()
      const consumeSpy = vi.fn()
      const markCleanSpy = vi.fn()
      const mockExec = vi.fn().mockRejectedValue(new Error('API 错误'))
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
          consumeProcessedEvidence: consumeSpy,
          markModeClean: markCleanSpy,
        })
      )
      const result = await svc.runIfEligible('general', { force: true })
      expect(result.outcome).toBe('failed')

      const state = svc.getState('general')
      expect(state.cursor).toBeNull()
      expect(consumeSpy).not.toHaveBeenCalled()
      expect(markCleanSpy).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------
  // 9. 成功清理
  // ---------------------------------------------------------------
  describe('成功推进 cursor 并清理', () => {
    test('成功后 cursor 正确推进，证据清理', async () => {
      const now = Date.now()
      const consumeSpy = vi.fn(() => 0)
      const markCleanSpy = vi.fn()
      const evidence: MemoryEvidenceEntry[] = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 35 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T1',
          sessionSummary: 'S1',
        }),
        makeEvidence({
          id: 'ev-2',
          createdAt: now - 34 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T2',
          sessionSummary: 'S2',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: async () => ({
            sessionKeyFacts: [],
            memoryCandidates: [],
            insights: [],
            contradictions: [],
          }),
          applyBatchOutput: async () => {},
          consumeProcessedEvidence: consumeSpy,
          markModeClean: markCleanSpy,
        })
      )
      const result = await svc.runIfEligible('general', { force: true })
      expect(result.outcome).toBe('success')

      const state = svc.getState('general')
      // cursor points to last evidence in batch
      expect(state.cursor).toContain('_ev-2')
      expect(consumeSpy).toHaveBeenCalledWith('general', ['ev-1', 'ev-2'])
      expect(markCleanSpy).toHaveBeenCalledWith('general')
    })
  })

  // ---------------------------------------------------------------
  // 10. Batch 上限
  // ---------------------------------------------------------------
  describe('batch 上限 100 条', () => {
    test('超过 100 条证据时只处理前 100 条', async () => {
      const now = Date.now()
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      const manyEvidence: MemoryEvidenceEntry[] = Array.from({ length: 150 }, (_, i) =>
        makeEvidence({
          id: `ev-${i}`,
          createdAt: now - (60 + i) * 60 * 1000,
          mode: 'general',
          sessionTitle: `T${i}`,
          sessionSummary: `S${i}`,
        })
      )
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => manyEvidence,
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const result = await svc.runIfEligible('general', { force: true })
      expect(result.outcome).toBe('success')
      expect(mockExec).toHaveBeenCalledOnce()
      const callArg = mockExec.mock.calls[0]![0]!
      expect(callArg.evidence).toHaveLength(100)
    })
  })

  // ---------------------------------------------------------------
  // 11. 幂等
  // ---------------------------------------------------------------
  describe('幂等写入', () => {
    test('重复应用相同 keyFacts 不抛异常', async () => {
      const output: BatchOutput = {
        sessionKeyFacts: [{ sessionId: 'sess-dup', facts: ['fact1'] }],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      }
      // defaultApplier calls memoryLayerService.updateSessionKeyFacts which is
      // an UPDATE (idempotent). With the electron mock it shows "db uninitialized"
      // but doesn't throw.
      await expect(defaultApplier(output, 'general')).resolves.toBeUndefined()
      await expect(defaultApplier(output, 'general')).resolves.toBeUndefined()
    })
  })

  // ---------------------------------------------------------------
  // 12. 自定义 executor 被调用一次
  // ---------------------------------------------------------------
  describe('executor 被调用一次', () => {
    test('自定义 executor 被调用一次', async () => {
      const now = Date.now()
      const mockFn = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockFn,
          applyBatchOutput: async () => {},
        })
      )
      const r = await svc.runIfEligible('general', { force: true })
      expect(r.outcome).toBe('success')
      expect(mockFn).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------
  // 13. kscc 零请求
  // ---------------------------------------------------------------
  describe('kscc 渠道不发出请求', () => {
    test('kscc 抛出 KSCC_UNSUPPORTED 且 requestsUsed=0', async () => {
      const now = Date.now()
      const mockExec = vi
        .fn()
        .mockRejectedValue(new ConsolidationError('KSCC_UNSUPPORTED', 'kscc 不支持'))
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
        })
      )
      const r = await svc.runIfEligible('general', { force: true })
      expect(r.outcome).toBe('failed')
      expect(r.requestsUsed).toBe(0)
      expect(mockExec).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------
  // 14. Insight 本地应用零 LLM
  // ---------------------------------------------------------------
  describe('insight 本地应用不调 LLM', () => {
    test('applyConsolidationInsights 不调用 LLM 方法', async () => {
      const { reflectService } = await import('./reflect-service')
      const llmSpy = vi.spyOn(
        reflectService as unknown as Record<string, unknown>,
        'callLLM' as never
      )
      const extractSpy = vi.spyOn(
        reflectService as unknown as Record<string, unknown>,
        'extractInsightsWithLLM' as never
      )

      const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const tmpDir = mkdtempSync(join(tmpdir(), 'tagent-insight-no-llm-'))
      const memDir = join(tmpDir, '.tagent-dev', 'memory')
      mkdirSync(memDir, { recursive: true })
      writeFileSync(
        join(memDir, 'L5_insights.md'),
        '# L5 提炼洞察\n\n- [2026-07-13] 用户偏好 TypeScript\n',
        'utf-8'
      )

      const origGetMemoryDir = (reflectService as unknown as Record<string, unknown>).getMemoryDir
      ;(reflectService as unknown as Record<string, unknown>).getMemoryDir = () => memDir

      try {
        const result = await reflectService.applyConsolidationInsights(
          'general',
          [{ content: '用户喜欢 Python', confidence: 0.8, evidenceIds: ['ev-1'] }],
          [{ existingId: 'insight-1', content: '矛盾1', evidenceIds: ['ev-2'] }]
        )
        expect(result.insightsApplied).toBe(1)
        expect(result.contradictionsApplied).toBe(1)
        expect(llmSpy).not.toHaveBeenCalled()
        expect(extractSpy).not.toHaveBeenCalled()
      } finally {
        ;(reflectService as unknown as Record<string, unknown>).getMemoryDir = origGetMemoryDir
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  // ---------------------------------------------------------------
  // 15. filterAfterCursor
  // ---------------------------------------------------------------
  describe('filterAfterCursor', () => {
    const entries: MemoryEvidenceEntry[] = [
      makeEvidence({
        id: 'a',
        createdAt: 100,
        mode: 'general',
        sessionTitle: 'A',
        sessionSummary: 'A',
      }),
      makeEvidence({
        id: 'b',
        createdAt: 200,
        mode: 'general',
        sessionTitle: 'B',
        sessionSummary: 'B',
      }),
      makeEvidence({
        id: 'c',
        createdAt: 200,
        mode: 'general',
        sessionTitle: 'C',
        sessionSummary: 'C',
      }),
      makeEvidence({
        id: 'd',
        createdAt: 300,
        mode: 'general',
        sessionTitle: 'D',
        sessionSummary: 'D',
      }),
    ]

    test('返回 cursor 之后的条目', () => {
      expect(filterAfterCursor(entries, '150_a')).toHaveLength(3)
    })
    test('同一 createdAt 按 id 区分', () => {
      const r = filterAfterCursor(entries, '200_b')
      expect(r).toHaveLength(2)
      expect(r[0]!.id).toBe('c')
      expect(r[1]!.id).toBe('d')
    })
    test('无效 cursor 返回全部', () => {
      expect(filterAfterCursor(entries, 'invalid')).toHaveLength(4)
    })
    test('cursor 在最后之后返回空', () => {
      expect(filterAfterCursor(entries, '300_d')).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------
  // 16. todayStr
  // ---------------------------------------------------------------
  describe('todayStr', () => {
    test('格式 YYYY-MM-DD', () => expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/))
    test('固定时间戳', () => {
      expect(todayStr(new Date('2026-07-13T12:00:00Z').getTime())).toBe('2026-07-13')
    })
  })

  // ---------------------------------------------------------------
  // 17. 状态持久化与跨天重置
  // ---------------------------------------------------------------
  describe('状态持久化与跨天重置', () => {
    test('跨天时 requestsUsedToday 重置为 0', async () => {
      const day1 = new Date('2026-07-13T12:00:00Z').getTime()
      const day2 = new Date('2026-07-14T12:00:00Z').getTime()

      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
      const tmpDir = mkdtempSync(join(tmpdir(), 'tagent-consolidation-budget-reset-'))
      const statePath = join(tmpDir, 'consolidation_state.json')

      writeFileSync(
        statePath,
        JSON.stringify({
          lastAttemptTime: day1,
          lastSuccessTime: day1,
          lastOutcome: 'success',
          lastErrorCode: null,
          cursor: '100_ev-1',
          requestsUsedToday: 2,
          budgetDate: '2026-07-13',
          leaseUntil: null,
          inputCounts: { sessions: 1, evidenceCount: 1 },
          outputCounts: { keyFacts: 1, memoryCandidates: 0, insights: 0, contradictions: 0 },
        }),
        'utf-8'
      )

      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: day2,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-new',
              createdAt: day2 - 35 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: async () => ({
            sessionKeyFacts: [],
            memoryCandidates: [],
            insights: [],
            contradictions: [],
          }),
          applyBatchOutput: async () => {},
          getStatePath: () => statePath,
        })
      )

      const result = await svc.runIfEligible('general', { force: true })
      expect(result.outcome).toBe('success')

      const state = svc.getState('general')
      expect(state.budgetDate).toBe('2026-07-14')
      expect(state.requestsUsedToday).toBe(1)
    })
  })

  // ---------------------------------------------------------------
  // 18. apply/consume 失败后本地重放（pending replay）
  // ---------------------------------------------------------------
  describe('apply 失败后本地重放', () => {
    test('apply 持续失败 → pending 保留，重放不调用 executor', async () => {
      const now = Date.now()
      let clock = now
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [{ sessionId: 'sess-1', facts: ['fact1'] }],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      const mockApply = vi.fn().mockRejectedValue(new Error('disk full'))
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: mockExec,
          applyBatchOutput: mockApply,
          now: () => clock,
        })
      )

      // 第一次：executor 成功，apply 失败，pending 保留
      const r1 = await svc.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('failed')
      expect(r1.requestsUsed).toBe(1)
      expect(mockExec).toHaveBeenCalledOnce()

      // 时钟前进超过退避
      clock = now + 31 * 60 * 1000

      // 第二次：pending 重放，apply 再次失败，executor 不再调用
      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('failed')
      expect(r2.requestsUsed).toBe(0) // replay 不计请求
      expect(mockExec).toHaveBeenCalledOnce() // 仍然只调用 1 次
      expect(mockApply).toHaveBeenCalledTimes(2) // 两次 apply
    })

    test('apply 失败后成功重放，总 executor 调用 1 次', async () => {
      const now = Date.now()
      let clock = now
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [{ sessionId: 'sess-1', facts: ['fact1'] }],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      let applyCallCount = 0
      const mockApply = vi.fn().mockImplementation(async () => {
        applyCallCount++
        if (applyCallCount === 1) throw new Error('disk full')
      })
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: mockExec,
          applyBatchOutput: mockApply,
          now: () => clock,
        })
      )

      // 第一次：executor 成功，apply 失败
      const r1 = await svc.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('failed')
      expect(r1.requestsUsed).toBe(1)
      expect(mockExec).toHaveBeenCalledOnce()

      // 时钟前进超过退避
      clock = now + 31 * 60 * 1000

      // 第二次：pending 重放，apply 成功，executor 不再调用
      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('success')
      expect(r2.requestsUsed).toBe(0) // replay 不计请求
      expect(mockExec).toHaveBeenCalledOnce() // 仍然只调用 1 次
      expect(mockApply).toHaveBeenCalledTimes(2) // 第一次失败 + 重放成功
    })

    test('consume 失败后成功重放，总 executor 调用 1 次，精确 ID', async () => {
      const now = Date.now()
      let clock = now
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [{ sessionId: 'sess-1', facts: ['fact1'] }],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      let consumeCallCount = 0
      const mockConsume = vi.fn().mockImplementation((_mode: string, _ids: string[]) => {
        consumeCallCount++
        if (consumeCallCount === 1) throw new Error('file locked')
        return 0
      })
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
          consumeProcessedEvidence: mockConsume,
          now: () => clock,
        })
      )

      // 第一次：executor 成功，apply 成功，consume 失败
      const r1 = await svc.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('failed')
      expect(r1.requestsUsed).toBe(1)
      expect(mockExec).toHaveBeenCalledOnce()

      // 时钟前进超过退避
      clock = now + 31 * 60 * 1000

      // 第二次：pending 重放，apply 成功，consume 成功，精确 ID
      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('success')
      expect(r2.requestsUsed).toBe(0)
      expect(mockExec).toHaveBeenCalledOnce() // 仍然只调用 1 次
      // consume 被调用两次，每次都传精确 ID
      expect(mockConsume).toHaveBeenCalledWith('general', ['ev-1'])
    })

    test('新实例重放持久化的 pending output', async () => {
      const now = Date.now()
      let clock = now
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const { mkdtempSync, rmSync, readFileSync } = await import('node:fs')
      const tmpDir = mkdtempSync(join(tmpdir(), 'tagent-consolidation-pending-replay-'))
      const statePath = join(tmpDir, 'consolidation_state.json')
      const leasePath = join(tmpDir, 'consolidation_lease.json')

      // 第一次实例：executor 成功，apply 失败 → pending 持久化
      let applyCallCount = 0
      const mockApply = vi.fn().mockImplementation(async () => {
        applyCallCount++
        if (applyCallCount === 1) throw new Error('disk full')
      })
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]

      const svc1 = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: async () => ({
            sessionKeyFacts: [{ sessionId: 'sess-1', facts: ['fact1'] }],
            memoryCandidates: [],
            insights: [],
            contradictions: [],
          }),
          applyBatchOutput: mockApply,
          now: () => clock,
          getStatePath: () => statePath,
          getLeasePath: () => leasePath,
        })
      )
      await svc1.runIfEligible('general', { force: true })

      // 验证 pending 已持久化
      const savedState = JSON.parse(readFileSync(statePath, 'utf-8'))
      expect(savedState.pendingApplication).not.toBeNull()
      expect(savedState.pendingApplication.batchId).toBeDefined()
      expect(savedState.pendingApplication.evidenceIds).toEqual(['ev-1'])

      // 第二次实例（模拟重启）：读取持久化状态，重放
      clock = now + 31 * 60 * 1000
      const svc2 = new ConsolidationService(
        makeDeps({
          frozenNow: clock,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: vi.fn(), // 不应被调用
          applyBatchOutput: async () => {}, // 重放成功
          now: () => clock,
          getStatePath: () => statePath,
          getLeasePath: () => leasePath,
        })
      )
      const r2 = await svc2.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('success')
      expect(r2.requestsUsed).toBe(0)

      rmSync(tmpDir, { recursive: true, force: true })
    })

    test('pending replay 绕过 daily budget 和跨天重置', async () => {
      const day1 = new Date('2026-07-13T12:00:00Z').getTime()
      const day2 = new Date('2026-07-14T12:00:00Z').getTime()
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const { mkdtempSync, rmSync } = await import('node:fs')
      const tmpDir = mkdtempSync(join(tmpdir(), 'tagent-consolidation-pending-budget-'))
      const statePath = join(tmpDir, 'consolidation_state.json')
      const leasePath = join(tmpDir, 'consolidation_lease.json')

      // Day 1：executor 成功，apply 失败 → pending，budget=1
      let applyCallCount = 0
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: day1 - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc1 = new ConsolidationService(
        makeDeps({
          frozenNow: day1,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: async () => ({
            sessionKeyFacts: [{ sessionId: 'sess-1', facts: ['fact1'] }],
            memoryCandidates: [],
            insights: [],
            contradictions: [],
          }),
          applyBatchOutput: async () => {
            applyCallCount++
            if (applyCallCount === 1) throw new Error('disk full')
          },
          now: () => day1,
          getStatePath: () => statePath,
          getLeasePath: () => leasePath,
        })
      )
      await svc1.runIfEligible('general', { force: true })

      // Day 2：budget 重置，pending 仍然存在，重放绕过 budget
      const svc2 = new ConsolidationService(
        makeDeps({
          frozenNow: day2,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: vi.fn(), // 不应被调用
          applyBatchOutput: async () => {}, // 重放成功
          now: () => day2,
          getStatePath: () => statePath,
          getLeasePath: () => leasePath,
        })
      )
      const r2 = await svc2.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('success')
      expect(r2.requestsUsed).toBe(0) // replay 绕过 budget

      rmSync(tmpDir, { recursive: true, force: true })
    })
  })

  // ---------------------------------------------------------------
  // 19. 同 timestamp ID 精确消费
  // ---------------------------------------------------------------
  describe('同 timestamp ID 精确消费', () => {
    test('两个 evidence 相同 createdAt 不同 ID，精确按 ID 消费', async () => {
      const now = Date.now()
      const consumedIds: string[] = []
      const evidence: MemoryEvidenceEntry[] = [
        makeEvidence({
          id: 'aaa',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'A',
          sessionSummary: 'A',
        }),
        makeEvidence({
          id: 'zzz',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'Z',
          sessionSummary: 'Z',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: async () => ({
            sessionKeyFacts: [],
            memoryCandidates: [],
            insights: [],
            contradictions: [],
          }),
          applyBatchOutput: async () => {},
          consumeProcessedEvidence: (_mode, ids) => {
            consumedIds.push(...ids)
            return 0
          },
        })
      )
      const r = await svc.runIfEligible('general', { force: true })
      expect(r.outcome).toBe('success')

      // cursor 应指向 zzz（按 ID 字典序更大）
      const state = svc.getState('general')
      expect(state.cursor).toContain('_zzz')

      // 消费的 ID 包含两个
      expect(consumedIds).toContain('aaa')
      expect(consumedIds).toContain('zzz')
    })
  })

  // ---------------------------------------------------------------
  // 20. 解析畸形字段部分保留
  // ---------------------------------------------------------------
  describe('parseBatchOutput 容错', () => {
    test('部分无效 insight 被丢弃，有效部分保留', async () => {
      // defaultApplier 中没有 parseBatchOutput 导出，但 ConsolidationService 内部会用
      // 这里测试 parseBatchOutput 的容错行为通过构造畸形 executor 输出间接验证
      const now = Date.now()
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [
          { sessionId: 'valid', facts: ['fact1'] },
          { noSessionId: true }, // 无效
        ],
        memoryCandidates: [
          { targetLayer: 'L2', content: 'valid candidate', confidence: 0.8, evidenceIds: [] },
          { targetLayer: 'INVALID', content: 'bad layer' }, // 无效 layer
        ],
        insights: [
          { content: '有效洞察', confidence: 0.9, evidenceIds: ['ev-1'] },
          { content: '', confidence: 0.5, evidenceIds: [] }, // 空 content
          { noContent: true }, // 完全无效
        ],
        contradictions: [],
      })
      const appliedOutputs: BatchOutput[] = []
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 60 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async (output) => {
            appliedOutputs.push(output)
          },
        })
      )
      const r = await svc.runIfEligible('general', { force: true })
      expect(r.outcome).toBe('success')

      // sanitizeBatchOutput 在 executeOnce 中过滤了畸形项，保留有效部分
      expect(appliedOutputs).toHaveLength(1)
      expect(appliedOutputs[0]!.sessionKeyFacts).toHaveLength(1)
      expect(appliedOutputs[0]!.memoryCandidates).toHaveLength(1)
      expect(appliedOutputs[0]!.insights).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------
  // 21. 跨实例跨 mode lease
  // ---------------------------------------------------------------
  describe('跨实例跨 mode lease', () => {
    test('不同 ConsolidationService 实例共享 lease 文件，general 运行时 ta 被锁', async () => {
      const now = Date.now()
      const leasePath = `/tmp/test-lease-shared-${Date.now()}.json`
      let release: () => void
      const held = new Promise<void>((r) => {
        release = r
      })
      const mockExec = vi.fn().mockImplementation(async () => {
        await held
        return { sessionKeyFacts: [], memoryCandidates: [], insights: [], contradictions: [] }
      })

      // 实例 1（general）
      const svc1 = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 60 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
          getLeasePath: () => leasePath,
        })
      )
      const p1 = svc1.runIfEligible('general', { force: true })
      await new Promise((r) => setTimeout(r, 10))

      // 实例 2（ta）— 不同实例但共享 lease 文件
      const svc2 = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-2',
              createdAt: now - 60 * 60 * 1000,
              mode: 'ta',
              sessionTitle: 'T',
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: vi.fn(),
          applyBatchOutput: async () => {},
          getLeasePath: () => leasePath,
        })
      )
      const r2 = await svc2.runIfEligible('ta', { force: true })
      expect(r2.outcome).toBe('skipped_locked')

      release!()
      await p1
    })
  })

  // ---------------------------------------------------------------
  // 22. batch 超限保留：超过 100 条的证据不丢失
  // ---------------------------------------------------------------
  describe('batch 超限保留', () => {
    test('150 条证据只处理 100 条，剩余保留供下次处理', async () => {
      const now = Date.now()
      const consumedIds: string[] = []
      const manyEvidence: MemoryEvidenceEntry[] = Array.from({ length: 150 }, (_, i) =>
        makeEvidence({
          id: `ev-${String(i).padStart(3, '0')}`,
          createdAt: now - (60 + i) * 60 * 1000,
          mode: 'general',
          sessionTitle: `T${i}`,
          sessionSummary: `S${i}`,
        })
      )
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => manyEvidence,
          executeConsolidation: async () => ({
            sessionKeyFacts: [],
            memoryCandidates: [],
            insights: [],
            contradictions: [],
          }),
          applyBatchOutput: async () => {},
          consumeProcessedEvidence: (_mode, ids) => {
            consumedIds.push(...ids)
            return 0
          },
        })
      )
      const r = await svc.runIfEligible('general', { force: true })
      expect(r.outcome).toBe('success')
      expect(r.evidenceProcessed).toBe(100)
      // 只消费 100 条
      expect(consumedIds).toHaveLength(100)
      // cursor 指向排序后的第 100 条（ev-050：i 越大 createdAt 越小，asc 排序后 ev-050 在第 100 位）
      const state = svc.getState('general')
      expect(state.cursor).toContain('ev-050')
      // consumedIds 是排序后的 100 条（按 createdAt,id 升序）
      const sortedIds = [...manyEvidence]
        .sort((a, b) => {
          if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
          return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
        })
        .slice(0, 100)
        .map((e) => e.id)
      expect(consumedIds).toEqual(sortedIds)
    })
  })

  // ---------------------------------------------------------------
  // 23. compact deterministic batchId
  // ---------------------------------------------------------------
  describe('compact deterministic batchId', () => {
    test('batchId 是 16 位 hex，相同输入产生相同 ID', () => {
      const id1 = computeBatchId('general', ['ev-1', 'ev-2', 'ev-3'])
      const id2 = computeBatchId('general', ['ev-1', 'ev-2', 'ev-3'])
      expect(id1).toBe(id2)
      expect(id1).toMatch(/^[0-9a-f]{16}$/)
      expect(id1.length).toBeLessThanOrEqual(32) // 紧凑
    })

    test('不同 mode 产生不同 batchId', () => {
      const idG = computeBatchId('general', ['ev-1'])
      const idT = computeBatchId('ta', ['ev-1'])
      expect(idG).not.toBe(idT)
    })

    test('不同 evidence IDs 产生不同 batchId', () => {
      const id1 = computeBatchId('general', ['ev-1', 'ev-2'])
      const id2 = computeBatchId('general', ['ev-1', 'ev-3'])
      expect(id1).not.toBe(id2)
    })

    test('内部排序：不同传入顺序产生相同 batchId', () => {
      const id1 = computeBatchId('general', ['ev-2', 'ev-1'])
      const id2 = computeBatchId('general', ['ev-1', 'ev-2'])
      expect(id1).toBe(id2)
    })

    test('不修改原数组', () => {
      const ids = ['ev-c', 'ev-a', 'ev-b']
      computeBatchId('general', ids)
      expect(ids).toEqual(['ev-c', 'ev-a', 'ev-b'])
    })
  })

  // ---------------------------------------------------------------
  // 24. 空 batch（文本裁剪后）0 请求
  // ---------------------------------------------------------------
  describe('空 batch 文本裁剪后跳过', () => {
    test('超长文本裁剪后 batch 为空，返回 skipped_clean 且 0 请求', async () => {
      const now = Date.now()
      const mockExec = vi.fn()
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => [
            makeEvidence({
              id: 'ev-1',
              createdAt: now - 60 * 60 * 1000,
              mode: 'general',
              sessionTitle: 'x'.repeat(50000),
              sessionSummary: 'S',
            }),
          ],
          executeConsolidation: mockExec,
        })
      )
      const r = await svc.runIfEligible('general', { force: true })
      expect(r.outcome).toBe('skipped_insufficient_evidence')
      expect(r.requestsUsed).toBe(0)
      expect(mockExec).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------
  // 25. 退避期间重复 tick 不提前重试
  // ---------------------------------------------------------------
  describe('退避期间重复 tick 不提前重试', () => {
    test('apply 失败后连续 tick 不调用 executor，直到退避期过', async () => {
      const now = Date.now()
      let clock = now
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      let applyCallCount = 0
      const mockApply = vi.fn().mockImplementation(async () => {
        applyCallCount++
        if (applyCallCount === 1) throw new Error('disk full')
      })
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: mockExec,
          applyBatchOutput: mockApply,
          now: () => clock,
        })
      )

      // 第一次 tick：executor 成功，apply 失败 → 退避
      const r1 = await svc.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('failed')
      expect(mockExec).toHaveBeenCalledOnce()

      // 退避期间连续 tick（时钟前进 5 分钟，仍在 30 分钟退避内）
      clock = now + 5 * 60 * 1000
      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('skipped_retry_backoff')
      expect(mockExec).toHaveBeenCalledOnce() // 未调用

      // 再 tick（时钟前进 10 分钟，仍在退避内）
      clock = now + 10 * 60 * 1000
      const r3 = await svc.runIfEligible('general', { force: true })
      expect(r3.outcome).toBe('skipped_retry_backoff')
      expect(mockExec).toHaveBeenCalledOnce() // 仍未调用

      // 退避期过后（31 分钟），重放成功
      clock = now + 31 * 60 * 1000
      const r4 = await svc.runIfEligible('general', { force: true })
      expect(r4.outcome).toBe('success')
      expect(mockExec).toHaveBeenCalledOnce() // 仍然只有 1 次 executor 调用
    })

    test('executor 失败后连续 tick 不提前重试', async () => {
      const now = Date.now()
      let clock = now
      let callCount = 0
      const mockExec = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) throw new Error('network error')
        return { sessionKeyFacts: [], memoryCandidates: [], insights: [], contradictions: [] }
      })
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
          now: () => clock,
        })
      )

      // 第一次 tick：executor 失败
      const r1 = await svc.runIfEligible('general', { force: true })
      expect(r1.outcome).toBe('failed')
      expect(callCount).toBe(1)

      // 退避期间 tick
      clock = now + 5 * 60 * 1000
      const r2 = await svc.runIfEligible('general', { force: true })
      expect(r2.outcome).toBe('skipped_retry_backoff')
      expect(callCount).toBe(1) // 未重试

      // 退避期过后重试
      clock = now + 31 * 60 * 1000
      const r3 = await svc.runIfEligible('general', { force: true })
      expect(r3.outcome).toBe('success')
      expect(callCount).toBe(2)
    })
  })

  // ---------------------------------------------------------------
  // 26. 状态版本 v1 → v2 迁移
  // ---------------------------------------------------------------
  describe('状态版本迁移', () => {
    test('v1 状态加载时迁移为 v2，pendingApplication 为 null', async () => {
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const { mkdtempSync, rmSync, writeFileSync, readFileSync } = await import('node:fs')
      const tmpDir = mkdtempSync(join(tmpdir(), 'tagent-consolidation-version-migrate-'))
      const statePath = join(tmpDir, 'consolidation_state.json')

      // 写入 v1 格式状态
      writeFileSync(
        statePath,
        JSON.stringify({
          lastAttemptTime: null,
          lastSuccessTime: null,
          lastOutcome: null,
          lastErrorCode: null,
          cursor: null,
          requestsUsedToday: 0,
          budgetDate: '2026-07-13',
          leaseUntil: null,
          inputCounts: { sessions: 0, evidenceCount: 0 },
          outputCounts: { keyFacts: 0, memoryCandidates: 0, insights: 0, contradictions: 0 },
          version: 1,
        }),
        'utf-8'
      )

      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: new Date('2026-07-13T12:00:00Z').getTime(),
          getStatePath: () => statePath,
        })
      )
      const state = svc.getState('general')
      expect(state.version).toBe(2)
      expect(state.pendingApplication).toBeNull()

      rmSync(tmpDir, { recursive: true, force: true })
    })

    test('无 version 字段的状态加载时迁移为 v2', async () => {
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
      const tmpDir = mkdtempSync(join(tmpdir(), 'tagent-consolidation-no-version-'))
      const statePath = join(tmpDir, 'consolidation_state.json')

      // 写入无 version 字段的旧格式状态
      writeFileSync(
        statePath,
        JSON.stringify({
          lastAttemptTime: null,
          lastSuccessTime: null,
          lastOutcome: null,
          lastErrorCode: null,
          cursor: null,
          requestsUsedToday: 0,
          budgetDate: '2026-07-13',
          leaseUntil: null,
          inputCounts: { sessions: 0, evidenceCount: 0 },
          outputCounts: { keyFacts: 0, memoryCandidates: 0, insights: 0, contradictions: 0 },
        }),
        'utf-8'
      )

      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: new Date('2026-07-13T12:00:00Z').getTime(),
          getStatePath: () => statePath,
        })
      )
      const state = svc.getState('general')
      expect(state.version).toBe(2)
      expect(state.pendingApplication).toBeNull()

      rmSync(tmpDir, { recursive: true, force: true })
    })

    test('v1 状态迁移保留已有的 pendingApplication（不丢失 paid Provider 结果）', async () => {
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const { mkdtempSync, rmSync, writeFileSync, readFileSync } = await import('node:fs')
      const tmpDir = mkdtempSync(join(tmpdir(), 'tagent-consolidation-v1-pending-'))
      const statePath = join(tmpDir, 'consolidation_state.json')

      // v1 状态中已写入 pendingApplication（模拟 executor 成功后、apply 前持久化的场景）
      const pendingOutput = {
        sessionKeyFacts: [{ sessionId: 'sess-paid', facts: ['paid fact'] }],
        memoryCandidates: [],
        insights: [{ content: 'paid insight', confidence: 0.9, evidenceIds: ['ev-paid'] }],
        contradictions: [],
      }
      writeFileSync(
        statePath,
        JSON.stringify({
          lastAttemptTime: null,
          lastSuccessTime: null,
          lastOutcome: null,
          lastErrorCode: null,
          cursor: null,
          requestsUsedToday: 1,
          budgetDate: '2026-07-13',
          leaseUntil: null,
          inputCounts: { sessions: 1, evidenceCount: 1 },
          outputCounts: { keyFacts: 1, memoryCandidates: 0, insights: 1, contradictions: 0 },
          version: 1,
          pendingApplication: {
            batchId: 'batch-paid-001',
            evidenceIds: ['ev-paid'],
            cursor: '1000_ev-paid',
            output: pendingOutput,
            counts: {
              inputSessions: 1,
              inputEvidenceCount: 1,
              outputKeyFacts: 1,
              outputMemoryCandidates: 0,
              outputInsights: 1,
              outputContradictions: 0,
            },
            createdAt: 1000000,
          },
        }),
        'utf-8'
      )

      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: new Date('2026-07-13T12:00:00Z').getTime(),
          getStatePath: () => statePath,
        })
      )
      const state = svc.getState('general')

      // version upgraded
      expect(state.version).toBe(2)
      // pendingApplication preserved (not cleared to null)
      expect(state.pendingApplication).not.toBeNull()
      expect(state.pendingApplication!.batchId).toBe('batch-paid-001')
      expect(state.pendingApplication!.evidenceIds).toEqual(['ev-paid'])
      expect(state.pendingApplication!.output.insights).toHaveLength(1)
      expect(state.pendingApplication!.output.insights[0]!.content).toBe('paid insight')

      rmSync(tmpDir, { recursive: true, force: true })
    })
  })

  // ---------------------------------------------------------------
  // 27. replayPending 区分 apply/consume 错误码
  // ---------------------------------------------------------------
  describe('replayPending 错误码区分', () => {
    test('apply 失败 → lastErrorCode 为 APPLY_FAILED', async () => {
      const now = Date.now()
      let clock = now
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      const mockApply = vi.fn()
      let applyCallCount = 0
      const applyFn = vi.fn().mockImplementation(async () => {
        applyCallCount++
        if (applyCallCount <= 1) throw new Error('disk full')
        // 第二次（replay）也失败，但用不同错误
        throw new ConsolidationError('APPLY_FAILED', 'apply still broken')
      })
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: mockExec,
          applyBatchOutput: applyFn,
          now: () => clock,
        })
      )

      // 第一次：executor 成功，apply 失败
      await svc.runIfEligible('general', { force: true })

      // 退避后 replay
      clock = now + 31 * 60 * 1000
      await svc.runIfEligible('general', { force: true })

      const state = svc.getState('general')
      expect(state.lastErrorCode).toBe('APPLY_FAILED')
      expect(state.pendingApplication).not.toBeNull() // pending 保留
    })

    test('consume 失败 → lastErrorCode 为 CONSUME_FAILED', async () => {
      const now = Date.now()
      let clock = now
      const mockExec = vi.fn().mockResolvedValue({
        sessionKeyFacts: [],
        memoryCandidates: [],
        insights: [],
        contradictions: [],
      })
      let consumeCallCount = 0
      const consumeFn = vi.fn().mockImplementation((_mode: string, _ids: string[]) => {
        consumeCallCount++
        if (consumeCallCount === 1) {
          // 第一次在 executeBatch 中失败
          throw new Error('file locked')
        }
        // 第二次在 replayPending 中也失败
        throw new ConsolidationError('CONSUME_FAILED', 'consume still broken')
      })
      const evidence = [
        makeEvidence({
          id: 'ev-1',
          createdAt: now - 60 * 60 * 1000,
          mode: 'general',
          sessionTitle: 'T',
          sessionSummary: 'S',
        }),
      ]
      const svc = new ConsolidationService(
        makeDeps({
          frozenNow: now,
          isModeDirty: () => true,
          isForegroundActive: () => false,
          getPendingEvidence: () => evidence,
          executeConsolidation: mockExec,
          applyBatchOutput: async () => {},
          consumeProcessedEvidence: consumeFn,
          now: () => clock,
        })
      )

      // 第一次：executor 成功，apply 成功，consume 失败
      await svc.runIfEligible('general', { force: true })

      // 退避后 replay
      clock = now + 31 * 60 * 1000
      await svc.runIfEligible('general', { force: true })

      const state = svc.getState('general')
      expect(state.lastErrorCode).toBe('CONSUME_FAILED')
      expect(state.pendingApplication).not.toBeNull() // pending 保留
    })
  })
})
