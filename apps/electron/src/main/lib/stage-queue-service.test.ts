/**
 * StageQueueService 单测 — 幂等性与基础功能
 *
 * 覆盖：
 * - 重复确定性 ID 的幂等检查
 * - 不同 ID 正常入队
 * - 入队/读取/移除/stats 基础功能（smoke）
 */

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'

// ===== Electron mock (必须在导入前注册) =====
let mockHome = '/tmp/tagent-stage-test-home'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => mockHome,
  },
}))

// ===== 动态导入 =====
const { enqueueStage, readStageQueue, removeFromStage, acceptAll, rejectAll, getStageStats } =
  await import('./stage-queue-service')

import type { NudgeCandidate } from './nudge-service'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ===== Helper =====

function makeCandidate(overrides: Partial<NudgeCandidate> & { id: string }): NudgeCandidate {
  return {
    type: 'fact_repeat',
    targetLayer: 'L2',
    pattern: 'test pattern',
    evidence: ['test session content'],
    suggestedContent: 'test suggested content',
    userMessage: 'test message',
    ...overrides,
  }
}

// ===== Tests =====

describe('StageQueueService — 幂等性', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'tagent-stage-test-'))
    mockHome = tmpDir
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // ---------------------------------------------------------------
  // 1. ID 幂等
  // ---------------------------------------------------------------
  test('相同 deterministic ID 入队两次只写一条', () => {
    const cand = makeCandidate({ id: 'det-dup-001' })

    enqueueStage('general', cand)
    enqueueStage('general', cand)

    const entries = readStageQueue('general')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.id).toBe('det-dup-001')
  })

  test('不同 ID 正常分别入队', () => {
    enqueueStage('general', makeCandidate({ id: 'id-a' }))
    enqueueStage('general', makeCandidate({ id: 'id-b' }))

    const entries = readStageQueue('general')
    expect(entries).toHaveLength(2)
  })

  test('同 ID 在已有文件的队列中幂等', () => {
    // 先写两条不同 ID
    enqueueStage('general', makeCandidate({ id: 'existing-1' }))
    enqueueStage('general', makeCandidate({ id: 'existing-2' }))
    expect(readStageQueue('general')).toHaveLength(2)

    // 再写一个已存在的 ID
    enqueueStage('general', makeCandidate({ id: 'existing-1' }))

    const entries = readStageQueue('general')
    expect(entries).toHaveLength(2)
    expect(entries.filter((e) => e.id === 'existing-1')).toHaveLength(1)
  })

  // ---------------------------------------------------------------
  // 2. 基础功能 — smoke
  // ---------------------------------------------------------------
  test('removeFromStage 删除指定条目', () => {
    enqueueStage('general', makeCandidate({ id: 'rem-1' }))
    enqueueStage('general', makeCandidate({ id: 'rem-2' }))
    expect(readStageQueue('general')).toHaveLength(2)

    removeFromStage('general', 'rem-1')
    const entries = readStageQueue('general')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.id).toBe('rem-2')
  })

  test('acceptAll 返回所有条目并清空队列', () => {
    enqueueStage('general', makeCandidate({ id: 'acc-1' }))
    enqueueStage('general', makeCandidate({ id: 'acc-2' }))

    const accepted = acceptAll('general')
    expect(accepted).toHaveLength(2)
    expect(readStageQueue('general')).toHaveLength(0)
  })

  test('rejectAll 清空队列并写入 rejected.jsonl', () => {
    enqueueStage('general', makeCandidate({ id: 'rej-1' }))
    enqueueStage('general', makeCandidate({ id: 'rej-2' }))

    const rejected = rejectAll('general', 'test_reject')
    expect(rejected).toHaveLength(2)
    expect(readStageQueue('general')).toHaveLength(0)

    // 验证 rejected.jsonl 存在且有记录
    const rejectedPath = join(tmpDir, '.tagent-dev', 'memory', 'nudges', 'rejected.jsonl')
    expect(existsSync(rejectedPath)).toBe(true)
    const content = readFileSync(rejectedPath, 'utf-8')
    expect(content).toContain('rej-1')
    expect(content).toContain('rej-2')
  })

  test('getStageStats 返回正确统计', () => {
    expect(getStageStats('general')).toEqual({ count: 0, oldestEnqueuedAt: null })

    enqueueStage('general', makeCandidate({ id: 'stats-1' }))

    const stats = getStageStats('general')
    expect(stats.count).toBe(1)
    expect(stats.oldestEnqueuedAt).toBeTypeOf('number')
  })

  test('enqueueStage 在当前模式之外不交叉影响', () => {
    enqueueStage('general', makeCandidate({ id: 'only-g' }))
    enqueueStage('ta', makeCandidate({ id: 'only-t' }))

    expect(readStageQueue('general')).toHaveLength(1)
    expect(readStageQueue('general')[0]!.id).toBe('only-g')
    expect(readStageQueue('ta')).toHaveLength(1)
    expect(readStageQueue('ta')[0]!.id).toBe('only-t')
  })
})
